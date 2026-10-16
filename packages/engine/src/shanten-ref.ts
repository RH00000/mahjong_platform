/**
 * Unmemoized reference implementation of regular-hand shanten.
 *
 * A line-for-line port of `_RegularShanten` from the Python `mahjong` library
 * (v2.0.0, mahjong/shanten.py), including its pruning rules and the
 * four-copies / isolated-tile and jidahai adjustments. It exists so the
 * memoized implementation in shanten.ts can be checked against it.
 */
import { assertValidCount } from './shanten.js';

const AGARI = -1;

export const regularShantenReference = (tiles34: readonly number[]): number => {
  let count = 0;
  for (let i = 0; i < 34; i++) count += tiles34[i]!;
  assertValidCount(count);

  const tiles = tiles34.slice();
  let melds = 0;
  let tatsu = 0;
  let pairs = 0;
  let jidahai = 0;
  let flagFour = 0;
  let flagIso = 0;
  let minShanten = 8;

  // _remove_character_tiles
  {
    let four = 0;
    let isolated = 0;
    for (let i = 27; i < 34; i++) {
      const n = tiles[i]!;
      if (n === 4) {
        melds++;
        jidahai++;
        four |= 1 << (i - 27);
        isolated |= 1 << (i - 27);
      }
      if (n === 3) melds++;
      if (n === 2) pairs++;
      if (n === 1) isolated |= 1 << (i - 27);
    }
    if (jidahai && count % 3 === 2) jidahai--;
    if (isolated) {
      flagIso |= 1 << 27;
      if ((four | isolated) === four) flagFour |= 1 << 27;
    }
  }

  const updateResult = (): void => {
    let ret = 8 - melds * 2 - tatsu - pairs;
    let kouho = melds + tatsu;
    if (pairs) {
      kouho += pairs - 1;
    } else if (flagFour && flagIso && (flagFour | flagIso) === flagFour) {
      ret += 1;
    }
    if (kouho > 4) ret += kouho - 4;
    if (ret !== AGARI && ret < jidahai) ret = jidahai;
    if (ret < minShanten) minShanten = ret;
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
  const isoUp = (k: number) => { tiles[k]!--; flagIso |= 1 << k; };
  const isoDown = (k: number) => { tiles[k]!++; flagIso &= ~(1 << k); };

  const run = (depth: number): void => {
    if (minShanten === AGARI) return;

    while (!tiles[depth]) {
      depth++;
      if (depth >= 27) break;
    }
    if (depth >= 27) {
      updateResult();
      return;
    }

    const i = depth % 9;
    const t = (k: number) => tiles[k]!;

    if (t(depth) === 4) {
      setUp(depth);
      if (i < 7 && t(depth + 2)) {
        if (t(depth + 1)) {
          seqUp(depth);
          run(depth + 1);
          seqDown(depth);
        }
        t2Up(depth);
        run(depth + 1);
        t2Down(depth);
      }
      if (i < 8 && t(depth + 1)) {
        t1Up(depth);
        run(depth + 1);
        t1Down(depth);
      }
      isoUp(depth);
      run(depth + 1);
      isoDown(depth);
      setDown(depth);
      pairUp(depth);
      if (i < 7 && t(depth + 2)) {
        if (t(depth + 1)) {
          seqUp(depth);
          run(depth);
          seqDown(depth);
        }
        t2Up(depth);
        run(depth + 1);
        t2Down(depth);
      }
      if (i < 8 && t(depth + 1)) {
        t1Up(depth);
        run(depth + 1);
        t1Down(depth);
      }
      pairDown(depth);
    }

    if (t(depth) === 3) {
      setUp(depth);
      run(depth + 1);
      setDown(depth);
      pairUp(depth);
      if (i < 7 && t(depth + 1) && t(depth + 2)) {
        seqUp(depth);
        run(depth + 1);
        seqDown(depth);
      } else {
        if (i < 7 && t(depth + 2)) {
          t2Up(depth);
          run(depth + 1);
          t2Down(depth);
        }
        if (i < 8 && t(depth + 1)) {
          t1Up(depth);
          run(depth + 1);
          t1Down(depth);
        }
      }
      pairDown(depth);
      if (i < 7 && t(depth + 2) >= 2 && t(depth + 1) >= 2) {
        seqUp(depth);
        seqUp(depth);
        run(depth);
        seqDown(depth);
        seqDown(depth);
      }
    }

    if (t(depth) === 2) {
      pairUp(depth);
      run(depth + 1);
      pairDown(depth);
      if (i < 7 && t(depth + 2) && t(depth + 1)) {
        seqUp(depth);
        run(depth);
        seqDown(depth);
      }
    }

    if (t(depth) === 1) {
      if (i < 6 && t(depth + 1) === 1 && t(depth + 2) && t(depth + 3) !== 4) {
        seqUp(depth);
        run(depth + 2);
        seqDown(depth);
      } else {
        isoUp(depth);
        run(depth + 1);
        isoDown(depth);
        if (i < 7 && t(depth + 2)) {
          if (t(depth + 1)) {
            seqUp(depth);
            run(depth + 1);
            seqDown(depth);
          }
          t2Up(depth);
          run(depth + 1);
          t2Down(depth);
        }
        if (i < 8 && t(depth + 1)) {
          t1Up(depth);
          run(depth + 1);
          t1Down(depth);
        }
      }
    }
  };

  // _scan
  for (let i = 0; i < 27; i++) flagFour |= (tiles[i] === 4 ? 1 : 0) << i;
  melds += Math.floor((14 - count) / 3);
  run(0);
  return minShanten;
};
