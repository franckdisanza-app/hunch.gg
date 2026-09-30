import { formatIsoDate } from "@/lib/format";

/** A record's date as the reveal shows it: "10 Jul 1913", "Sept 2026", "1913", "1991–2020". */
export function formatRecordDate(date: string): string {
  const format = (part: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return formatIsoDate(part);
    if (/^\d{4}-\d{2}$/.test(part)) {
      return formatIsoDate(`${part}-01`, undefined, {
        dateStyle: undefined,
        month: "short",
        year: "numeric",
      });
    }
    return part;
  };
  return date.split("/").map(format).join("–");
}
