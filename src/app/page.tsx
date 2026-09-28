import type { Metadata } from "next";
import { SiteChrome } from "@/frame/SiteChrome";
import { ShelfTile } from "@/frame/ShelfTile";
import { strings } from "@/frame/strings";
import { shelfGames } from "@/games/registry";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function ShelfPage() {
  const games = shelfGames();
  return (
    <SiteChrome>
      <section className="mb-8 flex flex-col gap-2">
        <h1 className="text-5xl font-black tracking-tight lowercase">{strings.site.name}</h1>
        <p className="max-w-prose text-lg text-frame-muted">{strings.shelf.intro}</p>
      </section>

      {games.length === 0 ? (
        <section
          aria-labelledby="empty-shelf"
          className="flex flex-col items-center gap-2 rounded-sheet border border-dashed border-frame-line px-6 py-16 text-center"
        >
          <h2 id="empty-shelf" className="text-xl font-bold">
            {strings.shelf.emptyTitle}
          </h2>
          <p className="max-w-sm text-frame-muted">{strings.shelf.emptyBody}</p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {games.map((game) => (
            <li key={game.slug}>
              <ShelfTile game={game} />
            </li>
          ))}
        </ul>
      )}
    </SiteChrome>
  );
}
