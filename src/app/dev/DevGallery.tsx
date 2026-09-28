"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Countdown } from "@/frame/Countdown";
import { HowToPlaySheet } from "@/frame/HowToPlaySheet";
import { Mascot } from "@/frame/Mascot";
import { OneTapPoll } from "@/frame/OneTapPoll";
import { PLACEHOLDER_GAME, PLACEHOLDER_MASCOT, PLACEHOLDER_THEME } from "@/frame/placeholders";
import { ResultsScreen } from "@/frame/ResultsScreen";
import { RevealCard } from "@/frame/RevealCard";
import { SettingsSheet } from "@/frame/SettingsSheet";
import { ShareButton } from "@/frame/ShareButton";
import { ShelfTile } from "@/frame/ShelfTile";
import { SoundToggle } from "@/frame/SoundToggle";
import { StatsSheet } from "@/frame/StatsSheet";
import { TopBar } from "@/frame/TopBar";
import { Button } from "@/frame/ui/Button";
import { Dialog, Sheet } from "@/frame/ui/Dialog";
import { SegmentedControl } from "@/frame/ui/SegmentedControl";
import { useToast } from "@/frame/ui/Toast";
import { MASCOT_POSES, type GameDefinition } from "@/games/types";
import { blip, sound } from "@/lib/sound";
import { EMPTY_STATS, type Stats } from "@/lib/storage";

// Everything here is obviously fake: placeholder game, example.test sources, made-up numbers.

const FAKE_STATS: Stats = {
  ...EMPTY_STATS,
  played: 12,
  completed: 11,
  currentStreak: 4,
  bestStreak: 7,
  lastCompleted: 1,
  histogram: { "2": 1, "3": 3, "4": 5, "5": 2 },
};

const FAKE_SHARE = () => ({
  gameName: PLACEHOLDER_GAME.name,
  slug: PLACEHOLDER_GAME.slug,
  puzzle: 1,
  score: { value: 4, max: 5 },
  grid: "🟩🟩🟥🟩🟩",
  teaser: "Which placeholder item would you pick?",
});

const LIVE_PLACEHOLDER: GameDefinition = {
  ...PLACEHOLDER_GAME,
  status: "live",
  launchDate: "2000-01-01",
  theme: PLACEHOLDER_THEME,
  mascot: PLACEHOLDER_MASCOT,
};

const COMING_SOON: GameDefinition = {
  ...PLACEHOLDER_GAME,
  slug: "placeholder-soon",
  name: "Another Placeholder",
  status: "coming-soon",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-frame-line pt-5">
      <h2 className="text-xs font-semibold tracking-wider text-frame-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Column({ scope }: { scope: "light" | "dark" }) {
  const toast = useToast();
  const [open, setOpen] = useState<null | "dialog" | "sheet" | "help" | "stats" | "settings">(null);
  const [segment, setSegment] = useState<"one" | "two" | "three">("one");
  const close = () => setOpen(null);

  return (
    <div
      data-theme-scope={scope}
      className="flex min-w-0 flex-col gap-6 rounded-sheet bg-frame-bg p-4 text-frame-ink ring-1 ring-frame-line"
    >
      <h2 className="text-lg font-bold capitalize">{scope}</h2>

      <Section title="TopBar">
        <div className="overflow-hidden rounded-control ring-1 ring-frame-line">
          <TopBar
            inGame
            onHelp={() => setOpen("help")}
            onStats={() => setOpen("stats")}
            onSettings={() => setOpen("settings")}
          />
        </div>
      </Section>

      <Section title="Button">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          label="Example"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "one", label: "One" },
            { value: "two", label: "Two" },
            { value: "three", label: "Three" },
          ]}
        />
      </Section>

      <Section title="Dialog, sheet, toast">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen("dialog")}>Open dialog</Button>
          <Button onClick={() => setOpen("sheet")}>Open sheet</Button>
          <Button onClick={() => toast("A placeholder toast")}>Show toast</Button>
        </div>
        <Dialog open={open === "dialog"} onClose={close} title="Placeholder dialog">
          <p>Esc, the close button or a click outside closes it. Tab stays inside.</p>
        </Dialog>
        <Sheet open={open === "sheet"} onClose={close} title="Placeholder sheet">
          <p>Rises from the bottom on phones, centred on wider screens.</p>
        </Sheet>
      </Section>

      <Section title="HowToPlaySheet, StatsSheet, SettingsSheet">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen("help")}>How to play</Button>
          <Button onClick={() => setOpen("stats")}>Stats</Button>
          <Button onClick={() => setOpen("settings")}>Settings</Button>
        </div>
        <HowToPlaySheet
          open={open === "help"}
          onClose={close}
          content={{
            lines: ["Look at two placeholder items.", "Tap the one you pick.", "See the answer."],
            example: <p className="text-sm">An example slot for the game&apos;s own demo.</p>,
          }}
        />
        <StatsSheet
          open={open === "stats"}
          onClose={close}
          stats={FAKE_STATS}
          unlimited={{ bestRun: 9, runsPlayed: 3 }}
          todayPuzzle={2}
          formatScore={(s) => `${s}/5`}
        />
        <SettingsSheet
          open={open === "settings"}
          onClose={close}
          gameSettings={<p className="text-sm text-frame-muted">A slot for game settings.</p>}
        />
      </Section>

      <Section title="Sound">
        <SoundToggle />
        <Button onClick={() => void sound.play("dev:blip")}>Play placeholder blip</Button>
      </Section>

      <Section title="Mascot">
        <div className="flex flex-wrap items-end gap-2">
          {MASCOT_POSES.map((pose) => (
            <figure key={pose} className="flex flex-col items-center gap-1 text-xs">
              <Mascot mascot={PLACEHOLDER_MASCOT} pose={pose} size={56} />
              <figcaption>{pose}</figcaption>
            </figure>
          ))}
          <figure className="flex flex-col items-center gap-1 text-xs">
            <Mascot size={56} />
            <figcaption>no assets</figcaption>
          </figure>
        </div>
      </Section>

      <Section title="ShelfTile">
        <div className="grid grid-cols-2 gap-3">
          <ShelfTile game={LIVE_PLACEHOLDER} compact />
          <ShelfTile game={COMING_SOON} compact />
        </div>
      </Section>

      <Section title="RevealCard and ReportDialog">
        <div data-game={PLACEHOLDER_GAME.slug} className="rounded-sheet bg-game-bg text-game-ink">
          <RevealCard
            game={PLACEHOLDER_GAME.slug}
            itemId="placeholder-item"
            statement="the placeholder item on the left is the bigger number."
            source={{
              sourceTitle: "Example source (placeholder)",
              sourceUrl: "https://example.test/source",
              checkedOn: "2000-01-01",
            }}
          >
            <p className="text-3xl font-black tabular">123 vs 45</p>
          </RevealCard>
        </div>
      </Section>

      <Section title="OneTapPoll">
        <OneTapPoll
          game={PLACEHOLDER_GAME.slug}
          pollId={`${PLACEHOLDER_GAME.slug}:gallery-${scope}`}
          question="Which placeholder do you prefer?"
          options={[
            { id: "a", label: "Placeholder A" },
            { id: "b", label: "Placeholder B" },
          ]}
        />
      </Section>

      <Section title="ShareButton and Countdown">
        <ShareButton getShare={FAKE_SHARE} />
        <Countdown />
      </Section>

      <Section title="ResultsScreen">
        <ResultsScreen
          game={PLACEHOLDER_GAME.slug}
          score="4/5"
          streak={4}
          getShare={FAKE_SHARE}
          summary={<p className="text-center text-sm text-frame-muted">Per-item summary slot</p>}
        />
      </Section>
    </div>
  );
}

export function DevGallery() {
  useEffect(() => sound.register("dev:blip", blip()), []);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Column scope="light" />
      <Column scope="dark" />
    </div>
  );
}
