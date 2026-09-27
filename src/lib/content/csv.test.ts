import { csvMappingSchema, groupDaily, parseCsv, rowsToObjects } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside cells", () => {
    const csv = 'a,b,c\n"x, y","say ""hi""","line 1\nline 2"\n';
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "line 1\nline 2"],
    ]);
  });

  it("handles CRLF, a byte-order mark, empty cells and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n1,\r\n\r\n,2")).toEqual([
      ["a", "b"],
      ["1", ""],
      ["", "2"],
    ]);
  });

  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a\n"open')).toThrow(/quoted/);
  });
});

const mapping = csvMappingSchema.parse({
  output: "daily",
  groupBy: "puzzle",
  columns: {
    puzzle: { path: "puzzle", type: "integer" },
    id: { path: "id" },
    amount: { path: "price.amount", type: "number" },
    featured: { path: "featured", type: "boolean", optional: true },
    checked: { path: "checkedOn", type: "date" },
  },
  ignore: ["notes"],
});

describe("rowsToObjects", () => {
  it("maps and converts columns, skipping ignored ones and empty optional cells", () => {
    const rows = parseCsv(
      "puzzle,id,amount,featured,checked,notes\n1,fake-a,12.5,yes,2026-01-01,editor note\n1,fake-b,3,,2026-01-02,\n",
    );
    expect(rowsToObjects(rows, mapping)).toEqual([
      { puzzle: 1, id: "fake-a", price: { amount: 12.5 }, featured: true, checkedOn: "2026-01-01" },
      { puzzle: 1, id: "fake-b", price: { amount: 3 }, checkedOn: "2026-01-02" },
    ]);
  });

  it("names the line and column of a bad value", () => {
    const rows = parseCsv("puzzle,id,amount,featured,checked,notes\n1,fake-a,lots,,2026-01-01,\n");
    expect(() => rowsToObjects(rows, mapping)).toThrow('Line 2, column "amount"');
  });

  it("rejects unmapped and missing columns", () => {
    expect(() =>
      rowsToObjects(parseCsv("puzzle,id,amount,featured,checked,surprise\n"), mapping),
    ).toThrow(/Unmapped CSV columns: surprise/);
    expect(() => rowsToObjects(parseCsv("puzzle,id\n"), mapping)).toThrow(/missing from the CSV/);
  });
});

describe("groupDaily", () => {
  it("writes one file per puzzle with its items", () => {
    const objects = [
      { puzzle: 2, id: "fake-c" },
      { puzzle: 1, id: "fake-a" },
      { puzzle: 1, id: "fake-b" },
    ];
    const files = groupDaily(objects, mapping);
    expect(files.get(1)).toEqual({ puzzle: 1, items: [{ id: "fake-a" }, { id: "fake-b" }] });
    expect(files.get(2)).toEqual({ puzzle: 2, items: [{ id: "fake-c" }] });
  });

  it("needs an integer group column", () => {
    const bad = csvMappingSchema.parse({ ...mapping, groupBy: "id" });
    expect(() => groupDaily([{ id: "x" }], bad)).toThrow(/groupBy/);
  });
});
