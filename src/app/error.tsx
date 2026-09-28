"use client";

// The error boundary ships with every page, so it stays deliberately small: no SiteChrome (which
// would pull the settings sheet and dialogs into every first load), just the frame's look.
import Link from "next/link";
import { Wordmark } from "@/frame/Wordmark";
import { strings } from "@/frame/strings";
import { Button, buttonClasses } from "@/frame/ui/Button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-frame-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-2">
          <Wordmark />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <section className="flex flex-col items-center gap-4 py-16 text-center">
          <h1 className="text-2xl font-bold">{strings.error.title}</h1>
          <p className="text-frame-muted">{strings.error.body}</p>
          <div className="flex gap-3">
            <Button variant="primary" size="lg" onClick={reset}>
              {strings.error.retry}
            </Button>
            <Link href="/" className={buttonClasses("secondary", "lg")}>
              {strings.error.home}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
