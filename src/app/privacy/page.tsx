import type { Metadata } from "next";
import { SiteChrome } from "@/frame/SiteChrome";
import { strings } from "@/frame/strings";
import { resolveAnalyticsConfig } from "@/lib/analytics/config";
import { formatIsoDate } from "@/lib/format";

const t = strings.privacy;

/** Bump when this page's content changes. */
const UPDATED = "2026-09-27";

export const metadata: Metadata = {
  title: t.title,
  description: t.description,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  // Resolved at build time, like the analytics script itself.
  const provider = resolveAnalyticsConfig(process.env).provider;
  return (
    <SiteChrome>
      <article className="flex max-w-prose flex-col gap-4">
        <h1 className="text-3xl font-black">{t.title}</h1>
        <p className="text-sm text-frame-muted">
          {t.updated} <time dateTime={UPDATED}>{formatIsoDate(UPDATED, "en-GB")}</time>
        </p>
        <p className="text-lg font-semibold">{t.summary}</p>

        <h2 className="mt-6 text-xl font-bold">{t.deviceTitle}</h2>
        <p>{t.deviceIntro}</p>
        <dl className="flex flex-col gap-3">
          {t.deviceKeys.map(([key, description]) => (
            <div key={key}>
              <dt>
                <code className="rounded-[4px] bg-frame-line/60 px-1 text-sm">{key}</code>
              </dt>
              <dd className="text-frame-muted">{description}</dd>
            </div>
          ))}
        </dl>
        <p>{t.deviceClear}</p>

        <h2 className="mt-6 text-xl font-bold">{t.crowdTitle}</h2>
        <p>{t.crowdIntro}</p>
        <ul className="list-disc space-y-2 pl-5">
          {t.crowdItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t.deviceId}</p>
        <p>{t.rateLimit}</p>

        <h2 className="mt-6 text-xl font-bold">{t.analyticsTitle}</h2>
        <p>{t.analytics[provider]}</p>
        {provider !== "none" && <p>{t.analyticsEvents}</p>}

        <h2 className="mt-6 text-xl font-bold">{t.hostingTitle}</h2>
        <p>{t.hosting}</p>

        <h2 className="mt-6 text-xl font-bold">{t.contactTitle}</h2>
        <p>{t.contact}</p>
      </article>
    </SiteChrome>
  );
}
