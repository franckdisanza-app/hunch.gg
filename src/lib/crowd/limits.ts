// Crowd thresholds and limits, in one place.

/** A poll split is shown only once this many votes are in. */
export const MIN_POLL_VOTES = 200;

/** A crowd median is shown only once this many guesses are in. */
export const MIN_GUESSES = 50;

/** Writes (vote, guess, report) allowed per hashed IP per window. */
export const WRITE_RATE_LIMIT = { max: 30, windowSeconds: 60 } as const;

/** Largest request body accepted by the crowd write endpoints, in bytes. */
export const MAX_BODY_BYTES = { vote: 1024, guess: 1024, report: 8192 } as const;

/** Log-scale bins returned by /api/crowd. */
export const CROWD_HISTOGRAM_BINS = 12;
