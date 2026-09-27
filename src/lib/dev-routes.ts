/**
 * /dev and unreleased games are available in development, and in production builds only with
 * ENABLE_DEV_ROUTES=1 (read at build time for static pages).
 */
export function devRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_ROUTES === "1";
}
