import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/dev-routes";
import { DevGallery } from "./DevGallery";

export const metadata: Metadata = {
  title: "Component gallery",
  robots: { index: false, follow: false },
};

// Never in production unless ENABLE_DEV_ROUTES=1.
export default function DevPage() {
  if (!devRoutesEnabled()) notFound();
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-black">Component gallery</h1>
        <nav className="flex gap-4 text-sm underline underline-offset-2">
          <Link href="/dev/game-shell">Empty GameShell</Link>
          <Link href="/">Shelf</Link>
        </nav>
      </header>
      <p className="text-frame-muted">
        Every shared frame component in light and dark, with a placeholder theme and mascot. All
        content here is fake.
      </p>
      <DevGallery />
    </main>
  );
}
