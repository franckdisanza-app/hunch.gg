import Link from "next/link";
import { strings } from "./strings";
import { cx } from "./ui/cx";

/** The Plimp wordmark. Text for now; swap the inner span for an SVG when the logo exists. */
export function Wordmark({ className, asLink = true }: { className?: string; asLink?: boolean }) {
  const mark = (
    <span className="text-xl font-black tracking-tight lowercase">{strings.site.name}</span>
  );
  if (!asLink) return <span className={className}>{mark}</span>;
  return (
    <Link
      href="/"
      aria-label={strings.topBar.home}
      className={cx("inline-flex min-h-11 items-center rounded-control px-1", className)}
    >
      {mark}
    </Link>
  );
}
