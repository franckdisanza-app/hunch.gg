import type { Metadata } from "next";
import { SiteChrome } from "@/frame/SiteChrome";
import { strings } from "@/frame/strings";
import { ButtonLink } from "@/frame/ui/Button";

export const metadata: Metadata = {
  title: strings.notFound.title,
  robots: { index: false },
};

export default function NotFound() {
  return (
    <SiteChrome>
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-6xl font-black text-frame-muted tabular">404</p>
        <h1 className="text-2xl font-bold">{strings.notFound.title}</h1>
        <p className="text-frame-muted">{strings.notFound.body}</p>
        <ButtonLink href="/" variant="primary" size="lg">
          {strings.notFound.home}
        </ButtonLink>
      </section>
    </SiteChrome>
  );
}
