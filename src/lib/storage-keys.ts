// localStorage key names. Kept dependency-free: the inline theme bootstrap script reads META_KEY
// before any JavaScript bundle has loaded.

export const STORAGE_VERSION = 1;
export const STORAGE_PREFIX = `plimp:v${STORAGE_VERSION}`;

export const META_KEY = `${STORAGE_PREFIX}:meta`;

export type GameStorageSlot = "stats" | "history" | "unlimited";

export function gameKey(game: string, slot: GameStorageSlot): string {
  return `${STORAGE_PREFIX}:${game}:${slot}`;
}
