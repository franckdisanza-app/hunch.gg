"use client";

import { useEffect, type ReactNode } from "react";
import type { AnalyticsProviderName } from "@/lib/analytics/config";
import { ToastProvider } from "./ui/Toast";

/**
 * Wraps every page. The boot work (meta, theme and sound sync, analytics, share arrivals, return
 * days) lives in boot.ts and loads right after hydration, so it stays out of first-load JS.
 */
export function FrameProviders({
  analyticsProvider,
  children,
}: {
  analyticsProvider: AnalyticsProviderName;
  children: ReactNode;
}) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void import("./boot").then(({ boot }) => {
      if (!cancelled) cleanup = boot(analyticsProvider);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [analyticsProvider]);

  return <ToastProvider>{children}</ToastProvider>;
}
