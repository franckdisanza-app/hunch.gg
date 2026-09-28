import {
  calendarDateIn,
  daysBetween,
  latestPuzzleNumber,
  localIsoDate,
  msUntilNextPuzzle,
  nextPuzzleAt,
  parseIsoDate,
  puzzleFileName,
  puzzleNumber,
} from "./daily";

const HOUR = 3_600_000;
const at = (iso: string) => new Date(iso);

describe("calendar helpers", () => {
  it("parses and rejects ISO dates", () => {
    expect(parseIsoDate("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(() => parseIsoDate("2026-02-30")).toThrow();
    expect(() => parseIsoDate("26-2-3")).toThrow();
  });

  it("counts calendar days across leap years", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("pads puzzle file names", () => {
    expect(puzzleFileName(7)).toBe("0007.json");
    expect(puzzleFileName(1234)).toBe("1234.json");
  });
});

describe("puzzleNumber", () => {
  const launch = "2026-01-01";

  it("is 1 on launch day and counts up by calendar day", () => {
    expect(puzzleNumber(launch, at("2026-01-01T12:00:00Z"), "UTC")).toBe(1);
    expect(puzzleNumber(launch, at("2026-01-02T00:00:00Z"), "UTC")).toBe(2);
    expect(puzzleNumber(launch, at("2026-12-31T23:59:59.999Z"), "UTC")).toBe(365);
  });

  it("is 0 before launch", () => {
    expect(puzzleNumber(launch, at("2025-12-31T23:59:59Z"), "UTC")).toBe(0);
  });

  it("uses the local date in the earliest time zone (Pacific/Kiritimati, UTC+14)", () => {
    // 10:00 UTC on Jan 1 is already 00:00 on Jan 2 in Kiritimati.
    expect(puzzleNumber(launch, at("2026-01-01T10:00:00Z"), "Pacific/Kiritimati")).toBe(2);
    expect(puzzleNumber(launch, at("2026-01-01T09:59:59Z"), "Pacific/Kiritimati")).toBe(1);
  });

  it("uses the local date in one of the latest time zones (Pacific/Pago_Pago, UTC-11)", () => {
    // 10:00 UTC on Jan 1 is still 23:00 on Dec 31 in Pago Pago.
    expect(puzzleNumber(launch, at("2026-01-01T10:00:00Z"), "Pacific/Pago_Pago")).toBe(0);
    expect(puzzleNumber(launch, at("2026-01-01T11:00:00Z"), "Pacific/Pago_Pago")).toBe(1);
  });

  it("can differ by two across the date line at the same instant", () => {
    const instant = at("2026-01-02T10:30:00Z");
    expect(puzzleNumber(launch, instant, "Pacific/Kiritimati")).toBe(3); // Jan 3, 00:30
    expect(puzzleNumber(launch, instant, "Pacific/Pago_Pago")).toBe(1); // Jan 1, 23:30
  });

  it("is not shifted by DST in Los Angeles", () => {
    // Spring forward: 2026-03-08 02:00 PST -> 03:00 PDT. Fall back: 2026-11-01 02:00 PDT -> 01:00 PST.
    const la = "America/Los_Angeles";
    expect(puzzleNumber("2026-03-07", at("2026-03-08T07:59:00Z"), la)).toBe(1); // Mar 7, 23:59 PST
    expect(puzzleNumber("2026-03-07", at("2026-03-08T08:00:00Z"), la)).toBe(2); // Mar 8, 00:00 PST
    expect(puzzleNumber("2026-03-07", at("2026-03-09T06:59:00Z"), la)).toBe(2); // Mar 8, 23:59 PDT
    expect(puzzleNumber("2026-03-07", at("2026-03-09T07:00:00Z"), la)).toBe(3); // Mar 9, 00:00 PDT
    expect(puzzleNumber("2026-10-31", at("2026-11-01T09:30:00Z"), la)).toBe(2); // Nov 1, 01:30 PST
    expect(puzzleNumber("2026-10-31", at("2026-11-02T07:59:00Z"), la)).toBe(2); // Nov 1, 23:59 PST
    expect(puzzleNumber("2026-10-31", at("2026-11-02T08:00:00Z"), la)).toBe(3); // Nov 2, 00:00 PST
  });

  it("is not shifted by DST in Zurich", () => {
    // 2026-03-29 02:00 CET -> 03:00 CEST; 2026-10-25 03:00 CEST -> 02:00 CET.
    const zh = "Europe/Zurich";
    expect(puzzleNumber("2026-03-29", at("2026-03-28T23:00:00Z"), zh)).toBe(1); // Mar 29 00:00 CET
    expect(puzzleNumber("2026-03-29", at("2026-03-29T21:59:00Z"), zh)).toBe(1); // Mar 29 23:59 CEST
    expect(puzzleNumber("2026-03-29", at("2026-03-29T22:00:00Z"), zh)).toBe(2); // Mar 30 00:00 CEST
    expect(puzzleNumber("2026-10-25", at("2026-10-25T22:59:00Z"), zh)).toBe(1); // Oct 25 23:59 CET
    expect(puzzleNumber("2026-10-25", at("2026-10-25T23:00:00Z"), zh)).toBe(2); // Oct 26 00:00 CET
  });

  it("skips a number when a zone jumps over a whole day (Samoa, 2011-12-30)", () => {
    const apia = "Pacific/Apia";
    expect(localIsoDate(at("2011-12-30T09:59:00Z"), apia)).toBe("2011-12-29");
    expect(localIsoDate(at("2011-12-30T10:00:00Z"), apia)).toBe("2011-12-31");
    expect(puzzleNumber("2011-12-29", at("2011-12-30T09:59:00Z"), apia)).toBe(1);
    expect(puzzleNumber("2011-12-29", at("2011-12-30T10:00:00Z"), apia)).toBe(3);
  });
});

describe("latestPuzzleNumber", () => {
  it("gates on UTC+14", () => {
    expect(latestPuzzleNumber("2026-01-01", at("2026-01-01T09:59:59Z"))).toBe(1);
    expect(latestPuzzleNumber("2026-01-01", at("2026-01-01T10:00:00Z"))).toBe(2);
  });

  it("is never behind any real time zone", () => {
    const instant = at("2026-06-15T12:34:56Z");
    const latest = latestPuzzleNumber("2026-01-01", instant);
    for (const tz of ["Pacific/Kiritimati", "Pacific/Pago_Pago", "Europe/Zurich", "Asia/Tokyo"]) {
      expect(puzzleNumber("2026-01-01", instant, tz)).toBeLessThanOrEqual(latest);
    }
  });
});

describe("msUntilNextPuzzle", () => {
  it("counts down to local midnight", () => {
    expect(msUntilNextPuzzle(at("2026-06-15T23:00:00Z"), "UTC")).toBe(HOUR);
    expect(msUntilNextPuzzle(at("2026-06-15T00:00:00Z"), "UTC")).toBe(24 * HOUR);
    expect(msUntilNextPuzzle(at("2026-06-15T23:59:59.999Z"), "UTC")).toBe(1);
  });

  it("returns local midnight in Zurich summer time", () => {
    expect(nextPuzzleAt(at("2026-07-01T12:00:00Z"), "Europe/Zurich").toISOString()).toBe(
      "2026-07-01T22:00:00.000Z",
    );
  });

  it("handles the 23-hour and 25-hour DST days in Los Angeles", () => {
    const la = "America/Los_Angeles";
    expect(msUntilNextPuzzle(at("2026-03-08T08:00:00Z"), la)).toBe(23 * HOUR);
    expect(msUntilNextPuzzle(at("2026-11-01T07:00:00Z"), la)).toBe(25 * HOUR);
  });

  it("handles the 23-hour DST day in Zurich", () => {
    expect(msUntilNextPuzzle(at("2026-03-28T23:00:00Z"), "Europe/Zurich")).toBe(23 * HOUR);
  });

  it("handles the date line in Kiritimati and Pago Pago", () => {
    expect(nextPuzzleAt(at("2026-01-01T05:00:00Z"), "Pacific/Kiritimati").toISOString()).toBe(
      "2026-01-01T10:00:00.000Z",
    );
    expect(nextPuzzleAt(at("2026-01-01T05:00:00Z"), "Pacific/Pago_Pago").toISOString()).toBe(
      "2026-01-01T11:00:00.000Z",
    );
  });

  it("finds the next day when a zone skips a date (Samoa)", () => {
    expect(msUntilNextPuzzle(at("2011-12-30T09:00:00Z"), "Pacific/Apia")).toBe(HOUR);
  });

  it("finds 01:00 when a DST change skips midnight (Santiago, 2026-09-06)", () => {
    // Chile moves from 00:00 to 01:00 on the first Sunday of September.
    const santiago = "America/Santiago";
    const next = nextPuzzleAt(at("2026-09-05T12:00:00Z"), santiago);
    expect(localIsoDate(next, santiago)).toBe("2026-09-06");
    expect(localIsoDate(next.getTime() - 1, santiago)).toBe("2026-09-05");
    expect(calendarDateIn(next, santiago).day).toBe(6);
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: santiago,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(next);
    expect(hour).toBe("01:00");
  });
});
