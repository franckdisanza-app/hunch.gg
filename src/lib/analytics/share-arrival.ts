export const SHARE_REF = "share";

/**
 * If the URL carries ?ref=share, returns the URL without it (to pass to history.replaceState) and
 * the game the link points at: the first path segment when it is a known game, else "shelf".
 */
export function parseShareArrival(
  href: string,
  isGame: (slug: string) => boolean,
): { game: string; cleanUrl: string } | null {
  const url = new URL(href);
  if (url.searchParams.get("ref") !== SHARE_REF) return null;
  url.searchParams.delete("ref");
  const segment = url.pathname.split("/").filter(Boolean)[0] ?? "";
  const game = isGame(segment) ? segment : "shelf";
  return { game, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
}
