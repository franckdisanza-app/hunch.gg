/**
 * The canonical site origin, with no trailing slash. Drives share links, Open Graph, canonical
 * URLs and the sitemap. Set NEXT_PUBLIC_SITE_URL=https://plimp.lol once the domain is connected;
 * until then it falls back to the Vercel deployment URL, then to localhost.
 *
 * Each variable is read by its full literal name so Next.js can inline it into client bundles.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelHost =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
      ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      : process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;

  return "http://localhost:3000";
}

/** An absolute URL on this site for a path such as "/about". */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "Plimp";
