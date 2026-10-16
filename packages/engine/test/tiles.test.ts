import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeSuit, encodeSuit, fromString, toString } from '../src/hand.js';
import {
  RED_FIVE_IDS,
  createRng,
  isRedFive,
  restoreRng,
  shuffledWall,
  tileType,
} from '../src/tiles.js';

describe('tiles', () => {
  it('red fives are the first copy of 5m/5p/5s', () => {
    expect(RED_FIVE_IDS.map(tileType)).toEqual([4, 13, 22]);
    expect(RED_FIVE_IDS.map((id) => id % 4)).toEqual([0, 0, 0]);
    expect(isRedFive(16, true)).toBe(true);
    expect(isRedFive(16, false)).toBe(false);
    expect(isRedFive(17, true)).toBe(false);
  });

  it('same seed gives the same stream; different seeds differ', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const sa = Array.from({ length: 100 }, () => a.nextU32());
    expect(Array.from({ length: 100 }, () => b.nextU32())).toEqual(sa);
    expect(Array.from({ length: 100 }, () => c.nextU32())).not.toEqual(sa);
  });

  it('serialize/restore resumes the stream exactly', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.nat(50), (seed, skip) => {
        const r = createRng(seed);
        for (let i = 0; i < skip; i++) r.nextU32();
        const copy = restoreRng(r.serialize());
        for (let i = 0; i < 20; i++) expect(copy.nextU32()).toBe(r.nextU32());
      }),
    );
  });

  it('nextInt stays in range', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 1000 }), (seed, n) => {
        const r = createRng(seed >>> 0);
        for (let i = 0; i < 50; i++) {
          const x = r.nextInt(n);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(n);
        }
      }),
    );
  });

  it('wall is a permutation of 0..135 with 4 copies per type, deterministic per seed', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const w = shuffledWall(createRng(seed));
        expect([...w].sort((x, y) => x - y)).toEqual(Array.from({ length: 136 }, (_, i) => i));
        const perType = new Array<number>(34).fill(0);
        for (const id of w) perType[tileType(id)]!++;
        expect(perType.every((n) => n === 4)).toBe(true);
        expect([...shuffledWall(createRng(seed))]).toEqual([...w]);
      }),
      { numRuns: 200 },
    );
  });
});

describe('hand notation and suit keys', () => {
  it('round-trips compact notation', () => {
    for (const s of ['123m456p789s1122z', '19m19p19s1234567z', '5555m']) {
      expect(toString(fromString(s))).toBe(s);
    }
  });

  it('encodes a suit as base-5 and decodes back', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 9, maxLength: 9 }), (s) => {
        const key = encodeSuit(s, 0);
        expect(key).toBeLessThan(5 ** 9);
        expect(decodeSuit(key)).toEqual(s);
      }),
    );
  });
});
