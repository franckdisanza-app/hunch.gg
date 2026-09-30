import { AA_NORMAL_TEXT, contrastRatio } from "@/lib/color";
import { theme } from "./theme";

// Every colour Ping sets text in, on every surface it sits on, in both modes.
describe("Ping's theme", () => {
  for (const mode of ["light", "dark"] as const) {
    const tokens = theme[mode];
    const extras = tokens.extras!;
    const texts = { ink: tokens.ink, muted: extras.muted!, radar: tokens.accent1 };
    const surfaces = { bg: tokens.bg, panel: extras.panel! };
    for (const [text, fg] of Object.entries(texts)) {
      for (const [surface, bg] of Object.entries(surfaces)) {
        it(`${mode}: ${text} on ${surface} reaches AA`, () => {
          expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
      }
    }
    it(`${mode}: ring labels (ink on bg) reach AA`, () => {
      expect(contrastRatio(tokens.ink, tokens.bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }
});
