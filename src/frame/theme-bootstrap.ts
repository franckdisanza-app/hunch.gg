import { META_KEY } from "@/lib/storage-keys";

/**
 * Inlined into <head> by the root layout and run before first paint, so a saved light/dark choice
 * never flashes the other theme. "system" (or nothing saved) leaves data-theme unset and the CSS
 * media query decides. Keep this tiny, dependency-free and in sync with applyTheme() in theme.ts.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var m=JSON.parse(localStorage.getItem(${JSON.stringify(
  META_KEY,
)}));var t=m&&m.theme;if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
