// Every user-facing string of the shared frame. English only for now; German, French and Italian
// will be added as sibling objects of the same FrameStrings shape. Games keep their own strings in
// src/games/<slug>/strings.ts. Numbers, currencies and dates are formatted with Intl (lib/format.ts).

export const en = {
  site: {
    name: "Plimp",
    tagline: "Small daily games about things that are true.",
    description:
      "Small daily browser games. Make a gut guess about something true, then see the sourced answer.",
  },
} as const;

type Widen<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type FrameStrings = Widen<typeof en>;

export const strings: FrameStrings = en;
