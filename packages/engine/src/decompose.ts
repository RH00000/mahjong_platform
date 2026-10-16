/**
 * Memoized per-suit decomposition.
 *
 * The library's regular-shanten DFS walks tile types 0..26 in order. Every
 * branch it takes for a suit tile reads and writes only tiles of that same
 * suit (sequence/taatsu moves are guarded by the rank), so the set of DFS
 * leaves is exactly the Cartesian product of the per-suit leaf sets. Each leaf
 * only matters through (melds, taatsu, pairs, isolated-tile mask), and the
 * mask only matters through whether it is empty, contained in the suit's
 * 4-copy tiles, or not. So per suit we enumerate the distinct
 * (melds, taatsu, pairs, iso) outcomes once and memoize them on the suit's
 * base-5 count key (< 5^9).
 */
import { decodeSuit } from './hand.js';

/** Isolated-tile state of one suit (or the honors) in a decomposition. */
export const ISO_NONE = 0;
/** Some isolated tiles, all of which are types the hand holds 4 copies of. */
export const ISO_ONLY_QUADS = 1;
/** Some isolated tile is not a 4-copy type. */
export const ISO_OTHER = 2;

/** Outcome packed as melds | taatsu << 4 | pairs << 8 | iso << 12. */
export type PackedOutcome = number;

export const packOutcome = (m: number, t: number, p: number, iso: number): PackedOutcome =>
  m | (t << 4) | (p << 8) | (iso << 12);
export const outMelds = (o: PackedOutcome): number => o & 15;
export const outTaatsu = (o: PackedOutcome): number => (o >> 4) & 15;
export const outPairs = (o: PackedOutcome): number => (o >> 8) & 15;
export const outIso = (o: PackedOutcome): number => o >> 12;

const memo = new Map<number, Uint16Array>();

export const memoSize = (): number => memo.size;
export const clearMemo = (): void => memo.clear();

/** Distinct outcomes the library's DFS reaches for a single suit. */
export const decomposeSuit = (key: number): Uint16Array => {
  let hit = memo.get(key);
  if (hit === undefined) {
    hit = enumerate(decodeSuit(key));
    memo.set(key, hit);
  }
  return hit;
};

/** Same as decomposeSuit but never touches the memo table. */
export const decomposeSuitUncached = (key: number): Uint16Array => enumerate(decodeSuit(key));

const enumerate = (tiles: number[]): Uint16Array => {
  let fourMask = 0;
  for (let i = 0; i < 9; i++) if (tiles[i] === 4) fourMask |= 1 << i;

  const seen = new Set<number>();
  let melds = 0;
  let tatsu = 0;
  let pairs = 0;
  let iso = 0;

  const t = (k: number): number => tiles[k]!;
  const leaf = () => {
    const state = iso === 0 ? ISO_NONE : (iso & ~fourMask) === 0 ? ISO_ONLY_QUADS : ISO_OTHER;
    seen.add(packOutcome(melds, tatsu, pairs, state));
  };
  const setUp = (k: number) => { tiles[k]! -= 3; melds++; };
  const setDown = (k: number) => { tiles[k]! += 3; melds--; };
  const pairUp = (k: number) => { tiles[k]! -= 2; pairs++; };
  const pairDown = (k: number) => { tiles[k]! += 2; pairs--; };
  const seqUp = (k: number) => { tiles[k]!--; tiles[k + 1]!--; tiles[k + 2]!--; melds++; };
  const seqDown = (k: number) => { tiles[k]!++; tiles[k + 1]!++; tiles[k + 2]!++; melds--; };
  const t1Up = (k: number) => { tiles[k]!--; tiles[k + 1]!--; tatsu++; };
  const t1Down = (k: number) => { tiles[k]!++; tiles[k + 1]!++; tatsu--; };
  const t2Up = (k: number) => { tiles[k]!--; tiles[k + 2]!--; tatsu++; };
  const t2Down = (k: number) => { tiles[k]!++; tiles[k + 2]!++; tatsu--; };
  const isoUp = (k: number) => { tiles[k]!--; iso |= 1 << k; };
  const isoDown = (k: number) => { tiles[k]!++; iso &= ~(1 << k); };

  // Same branch structure as the library's `_run`, with `i` = rank index.
  const run = (i: number): void => {
    while (i < 9 && !tiles[i]) i++;
    if (i >= 9) {
      leaf();
      return;
    }

    if (t(i) === 4) {
      setUp(i);
      if (i < 7 && t(i + 2)) {
        if (t(i + 1)) {
          seqUp(i);
          run(i + 1);
          seqDown(i);
        }
        t2Up(i);
        run(i + 1);
        t2Down(i);
      }
      if (i < 8 && t(i + 1)) {
        t1Up(i);
        run(i + 1);
        t1Down(i);
      }
      isoUp(i);
      run(i + 1);
      isoDown(i);
      setDown(i);
      pairUp(i);
      if (i < 7 && t(i + 2)) {
        if (t(i + 1)) {
          seqUp(i);
          run(i);
          seqDown(i);
        }
        t2Up(i);
        run(i + 1);
        t2Down(i);
      }
      if (i < 8 && t(i + 1)) {
        t1Up(i);
        run(i + 1);
        t1Down(i);
      }
      pairDown(i);
    }

    if (t(i) === 3) {
      setUp(i);
      run(i + 1);
      setDown(i);
      pairUp(i);
      if (i < 7 && t(i + 1) && t(i + 2)) {
        seqUp(i);
        run(i + 1);
        seqDown(i);
      } else {
        if (i < 7 && t(i + 2)) {
          t2Up(i);
          run(i + 1);
          t2Down(i);
        }
        if (i < 8 && t(i + 1)) {
          t1Up(i);
          run(i + 1);
          t1Down(i);
        }
      }
      pairDown(i);
      if (i < 7 && t(i + 2) >= 2 && t(i + 1) >= 2) {
        seqUp(i);
        seqUp(i);
        run(i);
        seqDown(i);
        seqDown(i);
      }
    }

    if (t(i) === 2) {
      pairUp(i);
      run(i + 1);
      pairDown(i);
      if (i < 7 && t(i + 2) && t(i + 1)) {
        seqUp(i);
        run(i);
        seqDown(i);
      }
    }

    if (t(i) === 1) {
      if (i < 6 && t(i + 1) === 1 && t(i + 2) && t(i + 3) !== 4) {
        seqUp(i);
        run(i + 2);
        seqDown(i);
      } else {
        isoUp(i);
        run(i + 1);
        isoDown(i);
        if (i < 7 && t(i + 2)) {
          if (t(i + 1)) {
            seqUp(i);
            run(i + 1);
            seqDown(i);
          }
          t2Up(i);
          run(i + 1);
          t2Down(i);
        }
        if (i < 8 && t(i + 1)) {
          t1Up(i);
          run(i + 1);
          t1Down(i);
        }
      }
    }
  };

  run(0);
  return Uint16Array.from(seen);
};
