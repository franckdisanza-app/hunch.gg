import "server-only";

// Copy for the About and Privacy pages. Server components only (enforced by server-only), so the
// long page text never ships in client JavaScript. Short interface strings live in strings.ts.

export const siteStrings = {
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
      "Guesses: the game, the puzzle number, the item, the number you guessed (in games where you pick an answer, 1 if your pick was right and 0 if not), your random device ID and the time.",
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
