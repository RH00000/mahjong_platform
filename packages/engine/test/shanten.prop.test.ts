import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromString, total, withAdded } from '../src/hand.js';
import {
  chiitoitsuShanten,
  kokushiShanten,
  regularShanten,
  regularShantenUnmemoized,
  shanten,
  shantenComponents,
} from '../src/shanten.js';
import { regularShantenReference } from '../src/shanten-ref.js';
import { TERMINAL_HONOR_TYPES } from '../src/tiles.js';
import {
  completeChiitoitsuArb,
  completeRegularArb,
  countsFromIds,
  denseHandArb,
  handArb,
  tileIdsArb,
} from './arbitraries.js';

const RUNS = { numRuns: 5_000 };
const anyHand = fc.oneof(handArb(), denseHandArb());

describe('shanten properties', () => {
  it('final shanten is in [-1, 8]; components in their own ranges', () => {
    fc.assert(
      fc.property(anyHand, (c) => {
        const s = shantenComponents(c);
        expect(s.min).toBeGreaterThanOrEqual(-1);
        expect(s.min).toBeLessThanOrEqual(8);
        expect(s.regular).toBeGreaterThanOrEqual(-1);
        expect(s.regular).toBeLessThanOrEqual(8);
        expect(s.chiitoitsu).toBeGreaterThanOrEqual(-1);
        expect(s.chiitoitsu).toBeLessThanOrEqual(13);
        expect(s.kokushi).toBeGreaterThanOrEqual(-1);
        expect(s.kokushi).toBeLessThanOrEqual(13);
        expect(s.min).toBe(shanten(c));
      }),
      RUNS,
    );
  });

  it('adding one tile changes shanten by at most 1', () => {
    // n -> n + 1 only where both counts are valid (library rejects multiples of 3).
    const growable = fc.oneof(handArb([1, 4, 7, 10, 13]), denseHandArb([1, 4, 7, 10, 13]));
    fc.assert(
      fc.property(growable, fc.integer({ min: 0, max: 33 }), (c, t) => {
        fc.pre(c[t]! < 4);
        const d = shanten(withAdded(c, t)) - shanten(c);
        expect(Math.abs(d)).toBeLessThanOrEqual(1);
      }),
      RUNS,
    );
  });

  it('complete regular hands return -1', () => {
    fc.assert(
      fc.property(completeRegularArb, (c) => {
        expect(regularShanten(c)).toBe(-1);
        expect(shanten(c)).toBe(-1);
      }),
      RUNS,
    );
  });

  it('seven distinct pairs return -1', () => {
    fc.assert(
      fc.property(completeChiitoitsuArb, (c) => {
        expect(chiitoitsuShanten(c)).toBe(-1);
        expect(shanten(c)).toBe(-1);
      }),
      RUNS,
    );
  });

  it('kokushi (13 orphans + any duplicate) returns -1', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TERMINAL_HONOR_TYPES), (dup) => {
        const c = new Array<number>(34).fill(0);
        for (const t of TERMINAL_HONOR_TYPES) c[t] = 1;
        c[dup]!++;
        expect(kokushiShanten(c)).toBe(-1);
        expect(shanten(c)).toBe(-1);
      }),
    );
  });

  it('tile order does not matter', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 4, 5, 7, 8, 10, 11, 13, 14).chain((n) =>
          tileIdsArb(n).chain((ids) =>
            fc.shuffledSubarray(ids, { minLength: ids.length }).map((perm) => [ids, perm] as const),
          ),
        ),
        ([ids, perm]) => {
          expect(shantenComponents(countsFromIds(perm))).toEqual(
            shantenComponents(countsFromIds(ids)),
          );
        },
      ),
      RUNS,
    );
  });

  it('memoized, unmemoized and whole-hand reference implementations agree', () => {
    fc.assert(
      fc.property(anyHand, (c) => {
        const memo = regularShanten(c);
        expect(regularShantenUnmemoized(c)).toBe(memo);
        expect(regularShantenReference(c)).toBe(memo);
      }),
      RUNS,
    );
  });

  it('rejects tile counts the library rejects', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(3, 6, 9, 12, 15).chain((n) => tileIdsArb(n)),
        (ids) => {
          const c = countsFromIds(ids);
          expect(() => regularShanten(c)).toThrow(RangeError);
          expect(() => regularShantenReference(c)).toThrow(RangeError);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('shanten examples (library docstrings)', () => {
  it.each([
    ['11m', -1],
    ['111m1p', 0],
    ['11223344556677m', -1],
    ['112233445566m78p', 0],
    ['19m19p19s12345677z', -1],
  ])('%s -> %i', (hand, expected) => {
    const c = fromString(hand);
    expect(total(c)).toBeGreaterThan(0);
    expect(shanten(c)).toBe(expected);
  });
});
