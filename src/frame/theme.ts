import { playerStorage, type ThemePreference } from "@/lib/storage";

/** Mirrors the inline bootstrap script (theme-bootstrap.ts) at runtime. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function setThemePreference(preference: ThemePreference): void {
  playerStorage().updateMeta({ theme: preference });
  applyTheme(preference);
}
