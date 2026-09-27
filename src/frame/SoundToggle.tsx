"use client";

import { sound } from "@/lib/sound";
import { playerStorage } from "@/lib/storage";
import { useMeta } from "./hooks";
import { strings } from "./strings";
import { cx } from "./ui/cx";
import { IconSoundOff, IconSoundOn } from "./ui/Icons";

/** The one global sound switch. Sound is off by default; turning it on is itself a user gesture. */
export function SoundToggle({ className }: { className?: string }) {
  const meta = useMeta();
  const on = meta?.sound ?? false;

  function toggle() {
    const next = !on;
    playerStorage().updateMeta({ sound: next });
    sound.setEnabled(next);
    if (next) sound.unlock();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className={cx(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-frame-line px-4 text-sm font-medium",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        {on ? <IconSoundOn /> : <IconSoundOff />}
        {strings.settings.sound}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "relative h-6 w-10 rounded-full transition-colors duration-fast",
          on ? "bg-frame-ink" : "bg-frame-line",
        )}
      >
        <span
          className={cx(
            "absolute top-1 size-4 rounded-full bg-frame-bg transition-transform duration-fast ease-out",
            on ? "translate-x-5" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}
