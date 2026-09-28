import { daysBetween } from "../daily";
import { RETURN_DAYS, type ReturnDay } from "./events";

/**
 * The return_day milestones to report now: each fires once, the first time the player is seen at
 * least that many calendar days after their first visit.
 */
export function dueReturnDays(
  firstVisit: string,
  today: string,
  alreadySent: readonly number[],
): ReturnDay[] {
  const elapsed = daysBetween(firstVisit, today);
  return RETURN_DAYS.filter((day) => elapsed >= day && !alreadySent.includes(day));
}
