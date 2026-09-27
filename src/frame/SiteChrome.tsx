"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SettingsSheet } from "./SettingsSheet";
import { SkipLink } from "./SkipLink";
import { strings } from "./strings";
import { TopBar } from "./TopBar";

/** The frame around every page that is not a game: shelf, about, privacy, errors. */
export function SiteChrome({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <TopBar onSettings={() => setSettingsOpen(true)} />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-frame-line">
        <nav className="mx-auto flex max-w-3xl gap-2 px-4 py-4 text-sm text-frame-muted">
          <Link href="/about" className="inline-flex min-h-11 items-center px-2 hover:underline">
            {strings.footer.about}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center px-2 hover:underline">
            {strings.footer.privacy}
          </Link>
        </nav>
      </footer>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
