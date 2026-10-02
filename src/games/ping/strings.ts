import type { Band } from "./config";
import type { Category, ScopeLevel } from "./content.schema";

// Every user-facing string of Ping. English for now; German, French and Italian later. Numbers,
// distances and dates are formatted with src/lib/format.ts and the map engine, never here.

export const strings = {
  name: "Ping",
  tagline: "Pin the world's extremes: hottest, wettest, farthest.",
  unlimited: "Practice",
  mascot: "Sonde",
  heading: (puzzle: number) => `Ping #${puzzle}`,
  practiceHeading: "Ping Practice",
  howTo: {
    lines: [
      "Three questions about the world's extremes. Drop a pin where you think the answer is.",
      "Miss, and you get a ping: how far off you were, drawn as a ring. You have three pins per question.",
      "Your first pin counts most, so trust your hunch. Every answer comes with its source.",
    ],
  },
  demo: {
    label:
      "Example with a made-up target: the first pin misses and its ring shows the distance, then a second pin lands closer.",
    first: "2,140 km · COLD",
    second: "380 km · HOT",
  },
  draftBanner: "Draft content — facts not yet verified",
  loading: "Warming up the radar…",
  question: (n: number, total: number) => `Question ${n} of ${total}`,
  category: {
    heat: "Heat",
    cold: "Cold",
    rain: "Rain",
    wind: "Wind",
    geography: "Geography",
    "furthest-from": "Furthest from",
    regional: "Regional",
  } satisfies Record<Category, string>,
  scope: {
    world: "World",
    continent: "Continent",
    region: "Region",
    country: "Country",
  } satisfies Record<ScopeLevel, string>,
  pins: {
    left: (n: number) => (n === 1 ? "1 pin left" : `${n} pins left`),
    label: (n: number) => `Pin ${n}`,
  },
  drop: "Drop pin",
  dropHint: "Turn the globe until the crosshair sits on your answer.",
  globe: {
    label: "Globe",
    instructions:
      "Drag to turn the globe, pinch or scroll to zoom. With a keyboard: arrow keys turn it (Shift for bigger steps), plus and minus zoom, Enter drops a pin at the crosshair.",
    letters: { n: "N", s: "S", e: "E", w: "W" },
    openWater: "open water",
    aim: (coordinates: string, place: string) => `Crosshair on ${coordinates}, ${place}.`,
    loading: "Loading the globe…",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  },
  heat: {
    burning: "Burning",
    hot: "Hot",
    warm: "Warm",
    cold: "Cold",
    freezing: "Freezing",
  } satisfies Record<Band, string>,
  bullseye: "Bullseye",
  log: {
    title: "Pings",
    empty: "No pins yet. Your first one counts most.",
    miss: (distance: string, word: string) => `${distance} · ${word}`,
    points: (points: string) => `${points} pts`,
  },
  announce: {
    miss: (pin: number, distance: string, word: string, left: string) =>
      `Pin ${pin}: ${distance} off. ${word}. ${left}.`,
    bullseye: (pin: number) => `Pin ${pin}: bullseye!`,
    reveal: (place: string, points: string) => `The answer: ${place}. You score ${points} points.`,
  },
  reveal: {
    title: "The answer",
    value: "Value",
    date: "Date",
    place: "Place",
    authority: "Authority",
    official: "Official record",
    contender: "Contender",
    contenders: "Every contender",
    yourPin: "Your best pin",
    bullseye: "Bullseye",
    away: (distance: string) => `${distance} away`,
    points: (points: string) => `${points} points`,
    computedOn: "Computed on",
    dataAsOf: "Map data as of",
    nearest: "Nearest",
    nearestItem: (name: string, town: string | undefined, distance: string) =>
      town ? `${name}, ${town} (${distance})` : `${name} (${distance})`,
  },
  next: "Next question",
  finish: "See results",
  results: {
    title: "Today's pings",
    score: (score: string, max: string) => `${score}/${max}`,
    question: (n: number) => `Question ${n}`,
    points: (points: string) => `${points} pts`,
    playPractice: "Practise on past questions",
  },
  states: {
    recalibrating: "The radar is recalibrating",
    recalibratingBody: "Today's questions are not ready yet. Practise on past ones meanwhile.",
    unavailable: "The radar could not be reached",
    unavailableBody: "Check your connection and try again.",
    retry: "Try again",
    notLaunched: "The first Ping opens soon",
  },
  practice: {
    empty: "Practice opens once the first day is over everywhere.",
    again: "Another round",
    daily: "Play today's Ping",
    best: (score: string) => `Best round: ${score}`,
    over: "Round over",
    note: "Practice never touches your daily stats or streak.",
  },
  share: {
    practice: (score: string) => score,
  },
  settings: {
    unit: "Distance unit",
    km: "Kilometres",
    mi: "Miles",
  },
  stats: {
    bucket: (from: string, to: string) => `${from}–${to}`,
  },
} as const;
