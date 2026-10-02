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
    it(`${mode}: ring and city labels (ink on its bg halo) reach AA`, () => {
      expect(contrastRatio(tokens.ink, tokens.bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
    it(`${mode}: roads stand out from the land and the borders`, () => {
      // Roads are background detail, not content: visible, never louder than the game's marks.
      expect(contrastRatio(extras.road!, extras.land!)).toBeGreaterThanOrEqual(1.5);
      expect(contrastRatio(extras.road!, extras.land!)).toBeGreaterThan(
        contrastRatio(extras.border!, extras.land!),
      );
    });
  }
});
