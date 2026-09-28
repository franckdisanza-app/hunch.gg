import type { Metadata } from "next";
import { SiteChrome } from "@/frame/SiteChrome";
import { siteStrings } from "@/frame/site-strings";
import { liveGames } from "@/games/registry";

const t = siteStrings.about;

export const metadata: Metadata = {
  title: t.title,
  description: t.description,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const credited = liveGames().filter((game) => game.credits?.length);
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
        {credited.map((game) => (
          <section key={game.slug} className="flex flex-col gap-2">
            <h3 className="font-bold">{game.name}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {game.credits?.map((credit) => (
                <li key={`${credit.what}-${credit.work}`}>
                  {credit.what}:{" "}
                  <a href={credit.url} className="underline underline-offset-2">
                    {credit.work}
                  </a>
                  , {credit.licence}
                </li>
              ))}
            </ul>
          </section>
        ))}

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
