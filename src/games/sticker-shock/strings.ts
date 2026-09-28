// Every user-facing string of Sticker Shock. English for now; German, French and Italian later.
// Numbers, prices and dates are formatted with src/lib/format.ts, never here.

export const strings = {
  name: "Sticker Shock",
  tagline: "Which costs more? Every price is real, with receipts.",
  daily: "Daily 10",
  endless: "Endless",
  howTo: {
    lines: [
      "Two items, two countries. Tap the one that costs more.",
      "Prices are converted to your currency at the rate on the day they were captured.",
      "Every price comes with a photo or screenshot of the real shelf.",
    ],
  },
  demo: {
    label: "Example round with made-up items",
    a: { title: "3 FAKE PEARS", country: "Nowhereland" },
    b: { title: "1 FAKE LOAF", country: "Pretendia" },
    line: "01 3 FAKE PEARS vs 1 FAKE LOAF  ✓",
  },
  sign: "Which costs more?",
  heading: (puzzle: number) => `Sticker Shock #${puzzle}`,
  endlessHeading: "Sticker Shock Endless",
  sampleBanner: "Sample data — not real prices",
  loading: "Stocking the shelf…",
  pairLabel: (index: number, total: number) => `Pair ${index} of ${total}`,
  endlessPairLabel: (index: number) => `Pair ${index}`,
  or: "or",
  pickHint: "Tap the one that costs more",
  keyHint: (keys: string) => `Key ${keys}`,
  pricier: "Costs more",
  stamp: { right: "Right", wrong: "Wrong" },
  price: {
    unknown: "?",
    local: (local: string) => `${local} on the shelf`,
    scaled: (local: string, pack: string, item: string) =>
      `${local} for ${pack}, scaled to ${item}`,
    captured: (store: string, date: string) => `${store}, ${date}`,
    seeShelf: "See the shelf",
    seeShelfOf: (item: string, country: string) => `See the shelf: ${item} in ${country}`,
  },
  turnsOut: {
    /** "12 eggs in Japan cost 23% more than in Switzerland." */
    same: (item: string, verb: string, pricierIn: string, percent: string, cheaperIn: string) =>
      `${item} in ${pricierIn} ${verb} ${percent} more than in ${cheaperIn}.`,
    /** "12 eggs in Japan cost 23% more than 1 kg of bananas in Switzerland." */
    different: (
      pricier: string,
      pricierIn: string,
      verb: string,
      percent: string,
      cheaper: string,
      cheaperIn: string,
    ) => `${pricier} in ${pricierIn} ${verb} ${percent} more than ${cheaper} in ${cheaperIn}.`,
    costs: "costs",
    cost: "cost",
  },
  announce: {
    right: "Right.",
    wrong: "Wrong.",
    price: (item: string, country: string, price: string) => `${item} in ${country}: ${price}.`,
  },
  next: "Next pair",
  finish: "See the receipt",
  endlessOver: "Tear off the receipt",
  proof: {
    title: "The shelf",
    alt: (item: string, store: string, country: string, date: string) =>
      `Photo or screenshot of the shelf price for ${item} at ${store}, ${country}, ${date}.`,
    source: "Open the source",
    licence: {
      ODbL: "Price and photo from Open Prices by Open Food Facts contributors, under the Open Database License (ODbL).",
      own: "Screenshot taken by Plimp.",
    },
    rate: (currency: string, rate: string, date: string, source: string) =>
      `Converted at 1 ${currency} = ${rate} US dollars on ${date} (${source}).`,
    sampleNote: "This is a placeholder image for development, not a real shelf.",
  },
  receipt: {
    store: "PLIMP - FOOD PRICE",
    title: "Your receipt",
    header: (puzzle: string, date: string) => `STICKER SHOCK #${puzzle} · ${date}`,
    endlessHeader: "STICKER SHOCK · ENDLESS",
    vs: "vs",
    score: "SCORE",
    streak: "STREAK",
    best: "BEST",
    run: "RUN",
    thanks: "THANK YOU FOR SHOPPING",
    nextShelf: "NEXT SHELF IN",
    torn: "TORN OFF AT THE FIRST MISS",
    og: "RECEIPTS INCLUDED",
    printer: "Receipt printer",
    right: "right",
    wrong: "wrong",
  },
  results: {
    playEndless: "Play Endless",
    playAgain: "Play again",
    daily: "Play the Daily 10",
    bestRun: (n: string) => `Best run: ${n}`,
  },
  states: {
    restocking: "Today's shelf is being restocked",
    restockingBody: "Come back a little later, or play Endless in the meantime.",
    unavailable: "The shelf could not be loaded",
    unavailableBody: "Check your connection and try again.",
    retry: "Try again",
    notLaunched: "The first shelf opens soon",
    alreadyPlayed: "You've done today's shopping",
  },
  share: {
    teaser: (a: string, aIn: string, b: string, bIn: string) => `${a} in ${aIn} or ${b} in ${bIn}?`,
    streak: (n: string) => `streak ${n}`,
  },
  settings: {
    currency: "Display currency",
    currencyHint: "Answers are decided in US dollars; this only changes how prices are shown.",
  },
  poll: {
    title: "One more question",
  },
} as const;
