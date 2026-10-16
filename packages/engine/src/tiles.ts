/**
 * Tile encoding.
 *
 * A physical tile has an id in 0..135; its type is `id >> 2` (0..33).
 * Types: 0-8 man 1-9, 9-17 pin 1-9, 18-26 sou 1-9,
 *        27-30 winds E S W N, 31-33 dragons haku hatsu chun.
 * This matches the ordering used by the Python `mahjong` library.
 */

export type TileId = number;
export type TileType = number;

export const NUM_TILES = 136;
export const NUM_TYPES = 34;

export const tileType = (id: TileId): TileType => id >> 2;

/** First copy of 5m / 5p / 5s, matching the library's FIVE_RED_MAN/PIN/SOU. */
export const RED_FIVE_IDS: readonly TileId[] = [16, 52, 88];

export const isRedFive = (id: TileId, redFivesEnabled: boolean): boolean =>
  redFivesEnabled && (id === 16 || id === 52 || id === 88);

export const isHonor = (t: TileType): boolean => t >= 27;

export const isTerminal = (t: TileType): boolean =>
  t < 27 && (t % 9 === 0 || t % 9 === 8);

/** 1/9 of each suit plus all honors (library: TERMINAL_AND_HONOR_INDICES). */
export const TERMINAL_HONOR_TYPES: readonly TileType[] = [
  0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33,
];

// ---------------------------------------------------------------------------
// Seeded RNG: xoshiro128** seeded via splitmix32.
// ---------------------------------------------------------------------------

export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** Uniform uint32. */
  nextU32(): number;
  /** Uniform integer in [0, n), n in [1, 2^32]. Unbiased (rejection sampling). */
  nextInt(n: number): number;
  /** Snapshot of the internal state; `restoreRng(state)` resumes the stream. */
  serialize(): RngState;
}

const splitmix32 = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
};

/** FNV-1a 32-bit, to turn string seeds into uint32. */
export const hashSeed = (seed: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export const createRng = (seed: number | string): Rng => {
  const sm = splitmix32(typeof seed === 'string' ? hashSeed(seed) : seed);
  const state: [number, number, number, number] = [sm(), sm(), sm(), sm()];
  // xoshiro must not start from the all-zero state.
  if ((state[0] | state[1] | state[2] | state[3]) === 0) state[0] = 1;
  return restoreRng(state);
};

export const restoreRng = (init: RngState): Rng => {
  let [a, b, c, d] = init;
  const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
  const nextU32 = (): number => {
    const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c = (c ^ a) >>> 0;
    d = (d ^ b) >>> 0;
    b = (b ^ c) >>> 0;
    a = (a ^ d) >>> 0;
    c = (c ^ t) >>> 0;
    d = rotl(d, 11);
    return result;
  };
  const nextInt = (n: number): number => {
    if (!Number.isInteger(n) || n < 1 || n > 0x100000000) {
      throw new RangeError(`nextInt: bad bound ${n}`);
    }
    // Largest multiple of n that fits in 2^32; reject above it.
    const limit = 0x100000000 - (0x100000000 % n);
    for (;;) {
      const x = nextU32();
      if (x < limit) return x % n;
    }
  };
  return { nextU32, nextInt, serialize: () => [a, b, c, d] };
};

/** Fisher-Yates shuffle of all 136 tile ids. */
export const shuffledWall = (rng: Rng): Uint8Array => {
  const wall = new Uint8Array(NUM_TILES);
  for (let i = 0; i < NUM_TILES; i++) wall[i] = i;
  for (let i = NUM_TILES - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = wall[i]!;
    wall[i] = wall[j]!;
    wall[j] = tmp;
  }
  return wall;
};
