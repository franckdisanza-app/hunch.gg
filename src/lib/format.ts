import { UI_LOCALE } from "./locale";

// Intl-based formatting. The locale defaults to the UI language (see locale.ts), never the
// browser's, so prerendered HTML and the client always agree.

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions) {
  const key = `n|${locale ?? ""}|${JSON.stringify(options)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

export function formatNumber(
  value: number,
  locale: string = UI_LOCALE,
  options: Intl.NumberFormatOptions = {},
) {
  return numberFormat(locale, options).format(value);
}

export function formatPercent(
  fraction: number,
  locale: string = UI_LOCALE,
  maximumFractionDigits = 0,
) {
  return numberFormat(locale, { style: "percent", maximumFractionDigits }).format(fraction);
}

export function formatCurrency(amount: number, currency: string, locale: string = UI_LOCALE) {
  return numberFormat(locale, { style: "currency", currency }).format(amount);
}

/** Formats a YYYY-MM-DD date without shifting it through a time zone. */
export function formatIsoDate(
  iso: string,
  locale: string = UI_LOCALE,
  options?: Intl.DateTimeFormatOptions,
) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const key = `d|${locale ?? ""}|${JSON.stringify(options ?? {})}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...options, timeZone: "UTC" });
    cache.set(key, f);
  }
  return f.format(date);
}

/** hh:mm:ss for countdowns, e.g. 03:07:59. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
