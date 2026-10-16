// Print our shanten components for one hand, to compare with tools/oracle/check.py.
// Usage: pnpm --filter @mahjong/engine exec tsx scripts/shanten.ts 123m456p789s1122z
import { fromString } from '../src/hand.js';
import { shantenComponents } from '../src/shanten.js';

const hand = process.argv[2];
if (!hand) {
  console.error('usage: tsx scripts/shanten.ts <hand, e.g. 123m456p789s1122z>');
  process.exit(2);
}
const { min, ...rest } = shantenComponents(fromString(hand));
console.log({ shanten: min, ...rest });
