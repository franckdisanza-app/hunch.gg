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
  ui: {
    close: "Close",
    cancel: "Cancel",
    skipToContent: "Skip to content",
  },
  topBar: {
    home: "Plimp, all games",
    back: "Back to all games",
    help: "How to play",
    stats: "Statistics",
    settings: "Settings",
  },
  howTo: {
    title: "How to play",
    example: "Example",
    start: "Got it",
  },
  stats: {
    title: "Statistics",
    played: "Played",
    completed: "Completed",
    currentStreak: "Current streak",
    bestStreak: "Best streak",
    distribution: "Score distribution",
    noScores: "Finish a daily puzzle to see your scores here.",
    unlimited: "Unlimited",
    bestRun: "Best run",
    runsPlayed: "Runs played",
  },
  settings: {
    title: "Settings",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    gameSettings: "Game settings",
  },
  results: {
    title: "Your result",
    streak: "Streak",
    nextPuzzle: "Next puzzle in",
    playUnlimited: "Play unlimited",
    moreFrom: "More from Plimp",
  },
  reveal: {
    turnsOut: "Turns out…",
    source: "Source",
    checkedOn: "checked",
    report: "Report a mistake",
  },
  report: {
    title: "Report a mistake",
    intro: "What is wrong? We read every report and fix mistakes quickly.",
    label: "Your message",
    placeholder: "For example: the source says something different.",
    send: "Send report",
    sending: "Sending…",
    sent: "Thanks, report sent.",
    failed: "Could not send the report. Please try again later.",
    privacy: "Please do not include personal details.",
  },
  poll: {
    waiting: (needed: number) => `Results appear once ${needed} people have voted.`,
    votes: (n: string) => `${n} votes`,
    yourPick: "Your pick",
  },
  share: {
    button: "Share",
    copied: "Copied to clipboard",
    failed: "Could not share. Try again.",
  },
  shelf: {
    intro: "Small daily games. Make a gut guess about something true, then see the sourced answer.",
    playedToday: "Played today",
    comingSoon: "Coming soon",
    emptyTitle: "The first game is coming soon",
    emptyBody: "Plimp is being built. Check back soon for the first daily game.",
  },
  notFound: {
    title: "Nothing here",
    body: "This page does not exist, or it moved.",
    home: "See all games",
  },
  error: {
    title: "Something went wrong",
    body: "Sorry about that. Please try again.",
    retry: "Try again",
    home: "See all games",
  },
  footer: {
    about: "About",
    privacy: "Privacy",
  },
  about: {
    title: "About Plimp",
    description: "What Plimp is, credits, data licences and imprint.",
    intro: [
      "Plimp is a collection of small daily browser games. Each one asks for a gut guess about something true, then shows the real answer and where it comes from.",
      "A daily round takes a few minutes on a phone. Every game also has an unlimited mode for when one round is not enough; it never touches your streaks or stats.",
      "Nothing on Plimp is made up. Every reveal starts with “Turns out…” and names its source, with a link and the date it was checked. If you spot a mistake, use “Report a mistake” on the reveal.",
      "No accounts, no ads, no cookies.",
    ],
    creditsTitle: "Credits and licences",
    fontCredit:
      "Interface type: Inter by Rasmus Andersson, licensed under the SIL Open Font License 1.1.",
    gamesCredit:
      "Each game lists its data sources and their licences here once it launches, and on every reveal.",
    imprintTitle: "Imprint",
    imprintPlaceholder: [
      "[Operator name]",
      "[Street and number]",
      "[Postcode and city]",
      "[Country]",
      "[Contact email]",
    ],
    imprintNote: "This imprint is a placeholder and will be completed before launch.",
  },
  privacy: {
    title: "Privacy",
    description:
      "Plimp sets no cookies. What your browser keeps, and what the crowd features store.",
    updated: "Last updated",
    summary: "Plimp sets no cookies, has no accounts and shows no ads.",
    deviceTitle: "What stays on your device",
    deviceIntro:
      "Plimp saves your progress in your browser’s local storage, not in a cookie. It stays on your device; only the random device ID described below is ever sent to our server.",
    deviceKeys: [
      [
        "plimp:v1:meta",
        "a random device ID, the date of your first visit, your theme and sound settings, and game preferences such as a display currency",
      ],
      ["plimp:v1:<game>:stats", "games played and completed, streaks and your score distribution"],
      ["plimp:v1:<game>:history", "your answers, score and finish time for each daily puzzle"],
      ["plimp:v1:<game>:unlimited", "your best unlimited run and how many runs you played"],
      ["plimp:v1:<game>:polls", "which option you picked in each one-tap poll"],
    ] as [string, string][],
    deviceClear: "Clearing your browser’s site data for Plimp deletes all of it.",
    crowdTitle: "What the crowd features store",
    crowdIntro: "Some games compare your answer with other players. For that, our server stores:",
    crowdItems: [
      "Poll votes: the game, the poll, the option you picked, your random device ID and the time.",
      "Guesses: the game, the puzzle number, the item, the number you guessed, your random device ID and the time.",
      "Mistake reports: the game, the item and the message you wrote, with the time. Please do not include personal details in a report.",
    ],
    deviceId:
      "The device ID is a random number created in your browser. It is only used so that each device counts once. It is not linked to a name, an email address or an IP address.",
    rateLimit:
      "To limit abuse, the server counts requests per hashed IP address. The hash uses a secret and changes every day, and the counters are deleted within two days. Plimp does not store your IP address.",
    analyticsTitle: "Analytics",
    analytics: {
      none: "Plimp currently uses no analytics.",
      plausible:
        "Plimp counts visits and a few game events with Plausible Analytics, which works without cookies.",
      umami: "Plimp counts visits and a few game events with Umami, which works without cookies.",
      vercel:
        "Plimp counts visits and a few game events with Vercel Web Analytics, which works without cookies.",
    },
    analyticsEvents:
      "Game events contain only game names, modes, puzzle numbers, scores and similar counts, never your device ID or anything you typed.",
    hostingTitle: "Hosting",
    hosting:
      "The site runs on Vercel and the crowd database on Supabase. Like any web host, they process technical data such as IP addresses to deliver the site.",
    contactTitle: "Contact",
    contact: "See the imprint on the About page.",
  },
};

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };
export type FrameStrings = Widen<typeof en>;

export const strings: FrameStrings = en;
