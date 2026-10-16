import { bench, describe } from 'vitest';
import { clearMemo, memoSize } from '../src/decompose.js';
import { emptyCounts, type Counts } from '../src/hand.js';
import { regularShanten, regularShantenUnmemoized, shanten } from '../src/shanten.js';
import { regularShantenReference } from '../src/shanten-ref.js';
import { createRng, shuffledWall } from '../src/tiles.js';

// Fixed corpus: 10k 14-tile hands from seeded walls.
const rng = createRng('bench');
const hands: Counts[] = Array.from({ length: 10_000 }, () => {
  const wall = shuffledWall(rng);
  const c = emptyCounts();
  for (let i = 0; i < 14; i++) c[wall[i]! >> 2]!++;
  return c;
});

describe('shanten over 10k random 14-tile hands', () => {
  bench('shanten (memoized, warm)', () => {
    for (const h of hands) shanten(h);
  });
  bench('regularShanten (memoized, warm)', () => {
    for (const h of hands) regularShanten(h);
  });
  bench('regularShanten (memoized, cold memo each run)', () => {
    clearMemo();
    for (const h of hands) regularShanten(h);
  });
  bench('regularShantenUnmemoized (per-suit, no memo)', () => {
    for (const h of hands) regularShantenUnmemoized(h);
  });
  bench('regularShantenReference (whole-hand DFS port)', () => {
    for (const h of hands) regularShantenReference(h);
  });
});

clearMemo();
for (const h of hands) regularShanten(h);
console.log(`memo entries after one pass over 10k hands: ${memoSize()}`);
