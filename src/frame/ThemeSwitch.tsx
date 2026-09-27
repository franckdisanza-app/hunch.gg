"use client";

import type { ThemePreference } from "@/lib/storage";
import { useMeta } from "./hooks";
import { strings } from "./strings";
import { setThemePreference } from "./theme";
import { SegmentedControl } from "./ui/SegmentedControl";

const OPTIONS = [
  { value: "light", label: strings.settings.themeLight },
  { value: "dark", label: strings.settings.themeDark },
  { value: "system", label: strings.settings.themeSystem },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export function ThemeSwitch() {
  const meta = useMeta();
  return (
    <SegmentedControl
      label={strings.settings.theme}
      value={meta?.theme ?? "system"}
      options={OPTIONS}
      onChange={setThemePreference}
    />
  );
}
