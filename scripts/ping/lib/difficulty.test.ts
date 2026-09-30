import { difficulty, formatDifficulty, median } from "./difficulty";

describe("difficulty", () => {
  it("takes medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("ranks questions by median first-pin distance", () => {
    const rows = [
      { puzzle: 1, item_id: "fake-a", value: 100 },
      { puzzle: 1, item_id: "fake-a", value: 300 },
      { puzzle: 2, item_id: "fake-b", value: 5000 },
      { puzzle: 9, item_id: "fake-a", value: 200 },
    ];
    const ranked = difficulty(rows);
    expect(ranked).toEqual([
      { itemId: "fake-b", puzzles: [2], n: 1, medianKm: 5000 },
      { itemId: "fake-a", puzzles: [1, 9], n: 3, medianKm: 200 },
    ]);
    expect(difficulty(rows, 2).map((r) => r.itemId)).toEqual(["fake-a"]);
    expect(formatDifficulty(ranked, new Map([["fake-a", "Fake question A"]]))).toContain(
      "200 km         3  Fake question A (#1, #9)",
    );
  });
});
