import { readFileSync } from "node:fs";
import { csvMappingSchema, parseCsv, rowsToObjects, type CsvMapping } from "@/lib/content/csv";

// prices.csv is the source of truth for Sticker Shock prices: one row per shelf price, edited in a
// spreadsheet. Its columns and types live in content/sticker-shock/csv-mapping.json (the format
// of src/lib/content/csv.ts); this module reads and writes it.

export const PRICE_COLUMNS = [
  "id",
  "itemId",
  "country",
  "currency",
  "priceLocal",
  "packQuantity",
  "packUnit",
  "fxToUsd",
  "fxDate",
  "store",
  "sourceUrl",
  "proofImage",
  "capturedOn",
  "licence",
  "regular",
  "taxIncluded",
  "notes",
  "sample",
] as const;

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(columns: readonly string[], rows: readonly Record<string, string>[]): string {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => cell(row[c] ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

export function readMapping(file: string): CsvMapping {
  return csvMappingSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/** Rows of prices.csv as objects (not yet validated: the content schema does that). */
export function readPricesCsv(csvFile: string, mappingFile: string): Record<string, unknown>[] {
  return rowsToObjects(parseCsv(readFileSync(csvFile, "utf8")), readMapping(mappingFile));
}
