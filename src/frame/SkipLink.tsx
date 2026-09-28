import { strings } from "./strings";

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-control bg-frame-ink px-4 py-2 font-semibold text-frame-bg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      {strings.ui.skipToContent}
    </a>
  );
}
