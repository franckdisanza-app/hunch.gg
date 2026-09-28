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
};

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };
export type FrameStrings = Widen<typeof en>;

export const strings: FrameStrings = en;
