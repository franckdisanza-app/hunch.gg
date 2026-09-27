import type { Metadata } from "next";
import { SiteChrome } from "@/frame/SiteChrome";
import { strings } from "@/frame/strings";

const t = strings.about;

export const metadata: Metadata = {
  title: t.title,
  description: t.description,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <SiteChrome>
      <article className="flex max-w-prose flex-col gap-4">
        <h1 className="text-3xl font-black">{t.title}</h1>
        {t.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        <h2 className="mt-6 text-xl font-bold">{t.creditsTitle}</h2>
        <p>{t.fontCredit}</p>
        <p>{t.gamesCredit}</p>

        <h2 className="mt-6 text-xl font-bold">{t.imprintTitle}</h2>
        <address className="not-italic">
          {t.imprintPlaceholder.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        <p className="text-sm text-frame-muted">{t.imprintNote}</p>
      </article>
    </SiteChrome>
  );
}
