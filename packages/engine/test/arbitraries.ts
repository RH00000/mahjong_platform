import fc from 'fast-check';
import { emptyCounts, type Counts } from '../src/hand.js';

export const VALID_COUNTS = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14] as const;

/** `n` distinct tile ids from 0..135 (so at most 4 copies of any type). */
export const tileIdsArb = (n: number) =>
  fc.uniqueArray(fc.integer({ min: 0, max: 135 }), { minLength: n, maxLength: n });

export const countsFromIds = (ids: readonly number[]): Counts => {
  const c = emptyCounts();
  for (const id of ids) c[id >> 2]!++;
  return c;
};

/** Hand of a valid size (any of 1, 2, 4, ..., 14 tiles). */
export const handArb = (sizes: readonly number[] = VALID_COUNTS) =>
  fc
    .constantFrom(...sizes)
    .chain((n) => tileIdsArb(n))
    .map(countsFromIds);

/** Hand drawn from a narrow tile range, which produces many melds, pairs and quads. */
export const denseHandArb = (sizes: readonly number[] = VALID_COUNTS) =>
  fc
    .record({
      n: fc.constantFrom(...sizes),
      lo: fc.integer({ min: 0, max: 33 }),
      width: fc.integer({ min: 3, max: 9 }),
    })
    .chain(({ n, lo, width }) => {
      // Widen the range if needed so n tiles always fit under the 4-copy cap.
      const w = Math.max(width, Math.ceil(n / 4));
      const types = Array.from({ length: w }, (_, k) => (lo + k) % 34);
      return fc
        .array(fc.constantFrom(...types), { minLength: n, maxLength: n })
        .map((picks) => {
          const c = emptyCounts();
          for (const pick of picks) {
            // Next type in the range (cyclically) that still has a copy left.
            let k = types.indexOf(pick);
            while (c[types[k]!]! >= 4) k = (k + 1) % w;
            c[types[k]!]!++;
          }
          return c;
        });
    });

type MeldSpec = { kind: 'seq'; suit: number; start: number } | { kind: 'set'; type: number };

const meldArb: fc.Arbitrary<MeldSpec> = fc.oneof(
  fc.record({
    kind: fc.constant('seq' as const),
    suit: fc.integer({ min: 0, max: 2 }),
    start: fc.integer({ min: 0, max: 6 }),
  }),
  fc.record({ kind: fc.constant('set' as const), type: fc.integer({ min: 0, max: 33 }) }),
);

/** Complete regular hand: k melds + 1 pair (k = 0..4, the rest implied open). */
export const completeRegularArb = fc
  .record({
    melds: fc.array(meldArb, { minLength: 0, maxLength: 4 }),
    pair: fc.integer({ min: 0, max: 33 }),
  })
  .map(({ melds, pair }) => {
    const c = emptyCounts();
    for (const m of melds) {
      if (m.kind === 'seq') for (let j = 0; j < 3; j++) c[m.suit * 9 + m.start + j]!++;
      else c[m.type]! += 3;
    }
    c[pair]! += 2;
    return c;
  })
  .filter((c) => c.every((x) => x <= 4));

/** Seven distinct pairs. */
export const completeChiitoitsuArb = fc
  .uniqueArray(fc.integer({ min: 0, max: 33 }), { minLength: 7, maxLength: 7 })
  .map((types) => {
    const c = emptyCounts();
    for (const t of types) c[t] = 2;
    return c;
  });
