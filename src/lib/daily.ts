// Daily rotation. All arithmetic is on calendar dates (a player's local date as shown by Intl),
// never on timestamps, so daylight saving time and time zones cannot shift a puzzle number.
// A new puzzle unlocks at the player's local midnight. Crowd data is keyed by puzzle number.

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** The earliest time zone on Earth (UTC+14, e.g. Pacific/Kiritimati). Used to gate the puzzle API. */
export const EARLIEST_TIME_ZONE = "Etc/GMT-14";

const MS_PER_DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The calendar date at instant `now` in `timeZone`. */
export function calendarDateIn(now: Date | number, timeZone: string): CalendarDate {
  const parts = formatter(timeZone).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Days since 1970-01-01 for a calendar date (proleptic Gregorian, no time zone involved). */
export function dayIndex(date: CalendarDate): number {
  const d = new Date(0);
  d.setUTCFullYear(date.year, date.month - 1, date.day);
  return Math.round(d.getTime() / MS_PER_DAY);
}

export function parseIsoDate(iso: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got "${iso}"`);
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const roundTrip = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (roundTrip.getUTCMonth() !== date.month - 1 || roundTrip.getUTCDate() !== date.day) {
    throw new Error(`Not a real date: "${iso}"`);
  }
  return date;
}

export function formatIsoDate(date: CalendarDate): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** The player's local calendar date as YYYY-MM-DD. */
export function localIsoDate(now: Date | number, timeZone: string): string {
  return formatIsoDate(calendarDateIn(now, timeZone));
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return dayIndex(parseIsoDate(to)) - dayIndex(parseIsoDate(from));
}

/**
 * The puzzle number for the player's local date: days since the launch date, plus 1.
 * Returns 0 or less before launch.
 */
export function puzzleNumber(launchDate: string, now: Date | number, timeZone: string): number {
  return dayIndex(calendarDateIn(now, timeZone)) - dayIndex(parseIsoDate(launchDate)) + 1;
}

/** The newest puzzle any player anywhere may see: the puzzle number in UTC+14. */
export function latestPuzzleNumber(launchDate: string, now: Date | number): number {
  return puzzleNumber(launchDate, now, EARLIEST_TIME_ZONE);
}

/**
 * The instant the player's local calendar date next changes (their next local midnight, or the
 * first instant of the next day when midnight itself is skipped by a DST or date-line change).
 * Binary search to the millisecond: the local date is non-decreasing over time.
 */
export function nextPuzzleAt(now: Date | number, timeZone: string): Date {
  const start = typeof now === "number" ? now : now.getTime();
  const today = dayIndex(calendarDateIn(start, timeZone));
  let lo = start; // local date at lo is today
  let hi = start + 2 * MS_PER_DAY; // local date at hi is later than today
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayIndex(calendarDateIn(mid, timeZone)) > today) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

export function msUntilNextPuzzle(now: Date | number, timeZone: string): number {
  const start = typeof now === "number" ? now : now.getTime();
  return nextPuzzleAt(start, timeZone).getTime() - start;
}

/** The device's IANA time zone, falling back to UTC. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Puzzle file names are zero-padded to four digits: 0001.json. */
export function puzzleFileName(n: number): string {
  return `${String(n).padStart(4, "0")}.json`;
}
