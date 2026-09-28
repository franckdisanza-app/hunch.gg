"use client";

import type { ReactNode } from "react";
import { SoundToggle } from "./SoundToggle";
import { strings } from "./strings";
import { ThemeSwitch } from "./ThemeSwitch";
import { Sheet } from "./ui/Dialog";

export interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  /** Game-specific settings, e.g. display currency. */
  gameSettings?: ReactNode;
}

export function SettingsSheet({ open, onClose, gameSettings }: SettingsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={strings.settings.title}>
      <div className="flex flex-col gap-5">
        <ThemeSwitch />
        <SoundToggle />
        {gameSettings && (
          <section className="flex flex-col gap-3 border-t border-frame-line pt-5">
            <h3 className="text-sm font-semibold">{strings.settings.gameSettings}</h3>
            {gameSettings}
          </section>
        )}
      </div>
    </Sheet>
  );
}
