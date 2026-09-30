import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGame, isGameReachable } from "@/games/registry";
import type { GameDefinition } from "@/games/types";
import { strings } from "./strings";

// What every game route page (src/app/(games)/<slug>/…) shares: unreleased games build as 404s
// in production, and every page gets a title, a description and a canonical URL.

/** The game's registry entry; a 404 when the game is not reachable in this build. */
export function reachableGame(slug: string): GameDefinition {
  const game = getGame(slug);
  if (!game || !isGameReachable(game)) notFound();
  return game;
}

/** Metadata for a game route, or the not-found title when the game is not reachable. */
export function gameMetadata(
  slug: string,
  page: { title: string; description: string; path: string },
): Metadata {
  const game = getGame(slug);
  if (!game || !isGameReachable(game)) return { title: strings.notFound.title };
  return { title: page.title, description: page.description, alternates: { canonical: page.path } };
}
