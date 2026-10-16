/**
 * Shanten numbers, matching the Python `mahjong` library (v2.0.0) exactly:
 * -1 = complete hand, 0 = tenpai, n = tiles away from tenpai.
 *
 * Regular shanten combines memoized per-suit decompositions (decompose.ts)
 * with the library's honor pre-pass and result formula.
 */
import {
  ISO_NONE,
  ISO_ONLY_QUADS,
  ISO_OTHER,
  decomposeSuit,
  decomposeSuitUncached,
  outIso,
  outMelds,
  outPairs,
  outTaatsu,
} from './decompose.js';
import { encodeSuit } from './hand.js';
import { TERMINAL_HONOR_TYPES } from './tiles.js';

export const AGARI = -1;
export const TENPAI = 0;

/** Library raises ValueError for > 14 tiles or counts divisible by 3. */
export const isValidCount = (n: number): boolean => n >= 1 && n <= 14 && n % 3 !== 0;

export const assertValidCount = (n: number): void => {
  if (n > 14) throw new RangeError(`Too many tiles = ${n}`);
  if (n % 3 === 0) {
    throw new RangeError(
      `Invalid tile count = ${n}. Valid counts: 1, 2, 4, 5, 7, 8, 10, 11, 13, 14.`,
    );
  }
};

const countTiles = (c: readonly number[]): number => {
  let n = 0;
  for (let i = 0; i < 34; i++) n += c[i]!;
  return n;
};

/** Combine iso states: NONE is neutral, OTHER is absorbing. */
const joinIso = (a: number, b: number): number => (a > b ? a : b);

const regularWith = (
  c: readonly number[],
  suit: (key: number) => Uint16Array,
): number => {
  const count = countTiles(c);
  assertValidCount(count);

  // Honor pre-pass (library: _remove_character_tiles).
  let melds = 0;
  let pairs = 0;
  let jidahai = 0;
  let four = 0;
  let isolated = 0;
  for (let i = 27; i < 34; i++) {
    const n = c[i]!;
    if (n === 4) {
      melds++;
      jidahai++;
      four |= 1 << (i - 27);
      isolated |= 1 << (i - 27);
    } else if (n === 3) {
      melds++;
    } else if (n === 2) {
      pairs++;
    } else if (n === 1) {
      isolated |= 1 << (i - 27);
    }
  }
  if (jidahai && count % 3 === 2) jidahai--;
  const honorIso =
    isolated === 0 ? ISO_NONE : (four | isolated) === four ? ISO_ONLY_QUADS : ISO_OTHER;
  melds += Math.floor((14 - count) / 3);

  const s0 = suit(encodeSuit(c, 0));
  const s1 = suit(encodeSuit(c, 9));
  const s2 = suit(encodeSuit(c, 18));

  let best = 8;
  for (let a = 0; a < s0.length; a++) {
    const oa = s0[a]!;
    const ma = melds + outMelds(oa);
    const ta = outTaatsu(oa);
    const pa = pairs + outPairs(oa);
    const ia = joinIso(honorIso, outIso(oa));
    for (let b = 0; b < s1.length; b++) {
      const ob = s1[b]!;
      const mb = ma + outMelds(ob);
      const tb = ta + outTaatsu(ob);
      const pb = pa + outPairs(ob);
      const ib = joinIso(ia, outIso(ob));
      for (let d = 0; d < s2.length; d++) {
        const od = s2[d]!;
        const m = mb + outMelds(od);
        const t = tb + outTaatsu(od);
        const p = pb + outPairs(od);
        const iso = joinIso(ib, outIso(od));

        // Library: _update_result.
        let ret = 8 - m * 2 - t - p;
        let kouho = m + t;
        if (p) kouho += p - 1;
        else if (iso === ISO_ONLY_QUADS) ret += 1;
        if (kouho > 4) ret += kouho - 4;
        if (ret !== AGARI && ret < jidahai) ret = jidahai;
        if (ret < best) {
          best = ret;
          if (best === AGARI) return AGARI;
        }
      }
    }
  }
  return best;
};

/** Regular (4 melds + pair) shanten, memoized per suit. */
export const regularShanten = (c: readonly number[]): number => regularWith(c, decomposeSuit);

/** Same algorithm with no memo table; used to test the memoization. */
export const regularShantenUnmemoized = (c: readonly number[]): number =>
  regularWith(c, decomposeSuitUncached);

export const chiitoitsuShanten = (c: readonly number[]): number => {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 34; i++) {
    if (c[i]! >= 2) pairs++;
    if (c[i]! >= 1) kinds++;
  }
  if (pairs === 7) return AGARI;
  return 6 - pairs + (kinds < 7 ? 7 - kinds : 0);
};

export const kokushiShanten = (c: readonly number[]): number => {
  let completed = 0;
  let terminals = 0;
  for (const i of TERMINAL_HONOR_TYPES) {
    if (c[i]! >= 2) completed++;
    if (c[i]! !== 0) terminals++;
  }
  return 13 - terminals - (completed ? 1 : 0);
};

export interface ShantenOptions {
  chiitoitsu?: boolean;
  kokushi?: boolean;
}

/** min(regular, chiitoitsu, kokushi); the latter two only count with >= 13 tiles. */
export const shanten = (c: readonly number[], opts: ShantenOptions = {}): number => {
  let best = regularShanten(c);
  if (countTiles(c) >= 13) {
    if (opts.chiitoitsu !== false) best = Math.min(best, chiitoitsuShanten(c));
    if (opts.kokushi !== false) best = Math.min(best, kokushiShanten(c));
  }
  return best;
};

export interface ShantenComponents {
  regular: number;
  chiitoitsu: number;
  kokushi: number;
  /** Same as `shanten(c)`. */
  min: number;
}

export const shantenComponents = (c: readonly number[]): ShantenComponents => {
  const regular = regularShanten(c);
  const chiitoitsu = chiitoitsuShanten(c);
  const kokushi = kokushiShanten(c);
  const min = countTiles(c) >= 13 ? Math.min(regular, chiitoitsu, kokushi) : regular;
  return { regular, chiitoitsu, kokushi, min };
};
