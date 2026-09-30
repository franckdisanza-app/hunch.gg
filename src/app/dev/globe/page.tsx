import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { strings } from "@/frame/strings";
import { devRoutesEnabled } from "@/lib/dev-routes";
import { GlobeDemo } from "./GlobeDemo";

export function generateMetadata(): Metadata {
  return {
    title: devRoutesEnabled() ? "Map engine" : strings.notFound.title,
    robots: { index: false, follow: false },
  };
}

// Never in production unless ENABLE_DEV_ROUTES=1.
export default function DevGlobePage() {
  if (!devRoutesEnabled()) notFound();
  return (
    <main id="main" className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-black">Map engine</h1>
        <nav className="flex gap-4 text-sm underline underline-offset-2">
          <Link href="/dev">Component gallery</Link>
          <Link href="/">Shelf</Link>
        </nav>
      </header>
      <p className="text-frame-muted">
        The globe from src/engines/map with a fake target in a random place: drop pins, watch the
        rings, sweep and fly. Nothing here is real data.
      </p>
      <GlobeDemo />
    </main>
  );
}
