import type { MetadataRoute } from "next";
import { liveGames } from "@/games/registry";
import { absoluteUrl } from "@/lib/site";

// Built from the registry: only live games are listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    ...liveGames().map((game) => ({
      url: absoluteUrl(`/${game.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "monthly", priority: 0.3 },
  ];
}
