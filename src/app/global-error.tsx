"use client";

// Last resort when the root layout itself fails. It replaces the whole document, so it cannot use
// the frame components or the stylesheet; it stays deliberately plain.
import { strings } from "@/frame/strings";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <h1>{strings.error.title}</h1>
        <p>{strings.error.body}</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 16px" }}>
          {strings.error.retry}
        </button>
      </body>
    </html>
  );
}
