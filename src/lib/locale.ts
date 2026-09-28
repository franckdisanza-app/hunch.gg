/**
 * The locale all Intl formatting uses. It must match the language of the UI strings, and it must
 * not come from the browser: pages are prerendered, so a browser-dependent format would differ
 * between the server HTML and the client and break hydration. When German, French and Italian
 * arrive, this becomes the active language's locale (de-CH, fr-CH, it-CH).
 */
export const UI_LOCALE = "en-GB";
