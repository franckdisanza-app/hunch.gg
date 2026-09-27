"use client";

import { SiteChrome } from "@/frame/SiteChrome";
import { strings } from "@/frame/strings";
import { Button, ButtonLink } from "@/frame/ui/Button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SiteChrome>
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{strings.error.title}</h1>
        <p className="text-frame-muted">{strings.error.body}</p>
        <div className="flex gap-3">
          <Button variant="primary" size="lg" onClick={reset}>
            {strings.error.retry}
          </Button>
          <ButtonLink href="/" size="lg">
            {strings.error.home}
          </ButtonLink>
        </div>
      </section>
    </SiteChrome>
  );
}
