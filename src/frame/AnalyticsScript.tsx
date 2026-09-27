"use client";

import Script from "next/script";
import type { AnalyticsScript as AnalyticsScriptConfig } from "@/lib/analytics/config";
import { flushAnalytics } from "@/lib/analytics/track";

/** Loads the configured provider's script after hydration, then sends any queued events. */
export function AnalyticsScript({ script }: { script: AnalyticsScriptConfig }) {
  return (
    <Script
      src={script.src}
      strategy="afterInteractive"
      onLoad={flushAnalytics}
      {...script.attributes}
    />
  );
}
