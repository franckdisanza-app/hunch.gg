import type { AnalyticsProviderName } from "./config";
import type { AnalyticsEventName, AnalyticsEvents } from "./events";

// One typed track() for every provider. The provider is chosen at build time (config.ts) and set
// by <AnalyticsBoot>. Events sent before the provider script loads are queued and flushed.

type Primitive = string | number | boolean;
export type CleanProps = Record<string, Primitive>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: CleanProps }) => void;
    umami?: { track: (event: string, data?: CleanProps) => void };
    va?: (type: "event", payload: { name: string; data?: CleanProps }) => void;
    vaq?: unknown[];
  }
}

type Sender = (name: string, props: CleanProps) => boolean;

const senders: Record<AnalyticsProviderName, Sender> = {
  none: () => true,
  plausible: (name, props) => {
    if (typeof window.plausible !== "function") return false;
    window.plausible(name, { props });
    return true;
  },
  umami: (name, props) => {
    if (typeof window.umami?.track !== "function") return false;
    window.umami.track(name, props);
    return true;
  },
  vercel: (name, props) => {
    if (typeof window.va !== "function") return false;
    window.va("event", { name, data: props });
    return true;
  },
};

const MAX_QUEUE = 50;
let provider: AnalyticsProviderName = "none";
let queue: [string, CleanProps][] = [];

/** Identifiers only: letters, digits and : _ - (no spaces, so no free text slips through). */
const SAFE_STRING = /^[A-Za-z0-9:_-]{1,64}$/;

/** Drops anything that is not a finite number, a boolean or a short identifier. */
export function cleanProps(props: object): CleanProps {
  const clean: CleanProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.toLowerCase().includes("device")) continue;
    if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "boolean") clean[key] = value;
    else if (typeof value === "string" && SAFE_STRING.test(value)) clean[key] = value;
  }
  return clean;
}

export function setAnalyticsProvider(name: AnalyticsProviderName): void {
  provider = name;
  if (name === "vercel" && typeof window !== "undefined" && typeof window.va !== "function") {
    // Vercel's documented queue stub; its script drains window.vaq when it loads.
    window.va = (...args) => {
      (window.vaq = window.vaq ?? []).push(args);
    };
  }
  flushAnalytics();
}

export function flushAnalytics(): void {
  if (typeof window === "undefined") return;
  const pending = queue;
  queue = [];
  for (const [name, props] of pending) send(name, props);
}

function send(name: string, props: CleanProps) {
  if (!senders[provider](name, props) && queue.length < MAX_QUEUE) queue.push([name, props]);
}

export function track<N extends AnalyticsEventName>(name: N, props: AnalyticsEvents[N]): void {
  if (typeof window === "undefined") return;
  const clean = cleanProps(props);
  if (provider === "none") {
    if (process.env.NODE_ENV === "development") console.debug("[analytics]", name, clean);
    return;
  }
  try {
    send(name, clean);
  } catch {
    // Analytics must never break a game.
  }
}

/** Test helper. */
export function resetAnalyticsForTests(): void {
  provider = "none";
  queue = [];
}
