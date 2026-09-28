import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { strings as frameStrings } from "@/frame/strings";
import { getGame, isGameReachable } from "@/games/registry";
import { EndlessGame } from "@/games/sticker-shock/components/Endless";
import { StickerShockShell } from "@/games/sticker-shock/StickerShockShell";
import { strings } from "@/games/sticker-shock/strings";
import { fontClassName } from "../fonts";

const game = getGame("sticker-shock");

export function generateMetadata(): Metadata {
  if (!game || !isGameReachable(game)) return { title: frameStrings.notFound.title };
  return {
    title: `${strings.name}: ${strings.endless}`,
    description: strings.tagline,
    alternates: { canonical: "/sticker-shock/unlimited" },
  };
}

export default function StickerShockEndlessPage() {
  if (!game || !isGameReachable(game)) notFound();
  return (
    <StickerShockShell mode="unlimited" fontClassName={fontClassName}>
      <EndlessGame />
    </StickerShockShell>
  );
}
