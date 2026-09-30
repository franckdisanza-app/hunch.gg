import { formatRecordDate } from "./text";

describe("formatRecordDate", () => {
  it("formats days, months, years and periods", () => {
    expect(formatRecordDate("1913-07-10")).toBe("10 Jul 1913");
    expect(formatRecordDate("2026-09")).toMatch(/^Sept? 2026$/);
    expect(formatRecordDate("1913")).toBe("1913");
    expect(formatRecordDate("1991/2020")).toBe("1991–2020");
  });
});
