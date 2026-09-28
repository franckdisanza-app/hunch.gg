// A small seeded random source (xmur3 string hash + sfc32), so generated puzzles are reproducible:
// the same seed and data always give the same days.

export type Random = () => number;

function xmur3(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** Uniform numbers in [0, 1) from a string seed. */
export function seededRandom(seed: string): Random {
  const hash = xmur3(seed);
  let a = hash();
  let b = hash();
  let c = hash();
  let d = hash();
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** A random integer in [0, n). */
export function randomInt(random: Random, n: number): number {
  return Math.floor(random() * n);
}

/** Fisher–Yates, in place. */
export function shuffle<T>(random: Random, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
