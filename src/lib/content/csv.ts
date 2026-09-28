import * as z from "zod/mini";

// Spreadsheet import: an RFC 4180 CSV parser and a per-game column mapping that turns rows into
// JSON content. Used by scripts/csv-to-json.ts. No dependencies.

/** Parses CSV text (commas, double-quote escaping, CRLF or LF, optional BOM) into rows of cells. */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (inQuotes) throw new Error("CSV ends inside a quoted cell");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const columnSchema = z.strictObject({
  /** Dot path in the output object, e.g. "price.amount". */
  path: z.string().check(z.regex(/^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)*$/)),
  type: z._default(z.enum(["string", "number", "integer", "boolean", "date", "json"]), "string"),
  /** Empty cells are omitted instead of rejected. */
  optional: z._default(z.boolean(), false),
});

export const csvMappingSchema = z.strictObject({
  /** CSV header -> where and how to put the value. */
  columns: z.record(z.string(), columnSchema),
  /** CSV headers to skip (e.g. editor notes). Any other unmapped header is an error. */
  ignore: z._default(z.array(z.string()), []),
  /**
   * "daily": group rows by `groupBy` (a mapped integer column) and write one
   * content/<game>/daily/<nnnn>.json per group as { <groupBy path>: n, <itemsKey>: rows }.
   * "list": write all rows as one JSON array.
   */
  output: z.enum(["daily", "list"]),
  /** "list" output: file name in content/<game>/ (default items.json). */
  file: z.optional(z.string().check(z.regex(/^[a-z0-9][a-z0-9-]*\.json$/))),
  groupBy: z.optional(z.string()),
  itemsKey: z._default(z.string(), "items"),
});
export type CsvMapping = z.infer<typeof csvMappingSchema>;

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) {
    node[key] ??= {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
}

function convert(raw: string, type: z.infer<typeof columnSchema>["type"]): unknown {
  const value = raw.trim();
  switch (type) {
    case "string":
      return value;
    case "number": {
      const n = Number(value);
      if (value === "" || !Number.isFinite(n)) throw new Error(`"${value}" is not a number`);
      return n;
    }
    case "integer": {
      const n = Number(value);
      if (!Number.isInteger(n)) throw new Error(`"${value}" is not an integer`);
      return n;
    }
    case "boolean": {
      if (/^(true|yes|1)$/i.test(value)) return true;
      if (/^(false|no|0)$/i.test(value)) return false;
      throw new Error(`"${value}" is not a boolean`);
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error(`"${value}" is not a YYYY-MM-DD date`);
      return value;
    }
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`"${value}" is not valid JSON`);
      }
  }
}

/** Turns CSV rows (header first) into objects. Errors name the CSV line and column. */
export function rowsToObjects(rows: string[][], mapping: CsvMapping): Record<string, unknown>[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const unknown = header.filter((h) => !(h in mapping.columns) && !mapping.ignore.includes(h));
  if (unknown.length) throw new Error(`Unmapped CSV columns: ${unknown.join(", ")}`);
  const missing = Object.keys(mapping.columns).filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Mapped columns missing from the CSV: ${missing.join(", ")}`);

  return body.map((cells, r) => {
    const line = r + 2;
    const out: Record<string, unknown> = {};
    header.forEach((name, c) => {
      const column = mapping.columns[name];
      if (!column) return;
      const raw = cells[c] ?? "";
      if (raw.trim() === "") {
        if (column.optional) return;
        throw new Error(`Line ${line}, column "${name}": empty`);
      }
      try {
        setPath(out, column.path, convert(raw, column.type));
      } catch (error) {
        throw new Error(`Line ${line}, column "${name}": ${(error as Error).message}`);
      }
    });
    return out;
  });
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], source);
}

/** Groups objects into daily files: puzzle number -> file content. */
export function groupDaily(
  objects: Record<string, unknown>[],
  mapping: CsvMapping,
): Map<number, Record<string, unknown>> {
  const groupColumn = mapping.groupBy && mapping.columns[mapping.groupBy];
  if (!groupColumn || groupColumn.type !== "integer") {
    throw new Error('"daily" output needs groupBy naming a mapped integer column');
  }
  const files = new Map<number, Record<string, unknown>>();
  for (const object of objects) {
    const n = getPath(object, groupColumn.path);
    if (typeof n !== "number" || n < 1) throw new Error(`Invalid puzzle number: ${String(n)}`);
    const { [groupColumn.path.split(".")[0]!]: _drop, ...item } = object;
    const file = files.get(n) ?? { [groupColumn.path]: n, [mapping.itemsKey]: [] };
    (file[mapping.itemsKey] as unknown[]).push(item);
    files.set(n, file);
  }
  return files;
}
