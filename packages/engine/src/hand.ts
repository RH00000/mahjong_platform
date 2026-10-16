/**
 * Hands as 34-length count arrays (index = tile type, value = copies 0..4).
 */
import { NUM_TYPES, tileType, type TileId } from './tiles.js';

export type Counts = number[];

export const emptyCounts = (): Counts => new Array<number>(NUM_TYPES).fill(0);

export const total = (c: readonly number[]): number => {
  let n = 0;
  for (let i = 0; i < NUM_TYPES; i++) n += c[i]!;
  return n;
};

export const fromTileIds = (ids: Iterable<TileId>): Counts => {
  const c = emptyCounts();
  for (const id of ids) c[tileType(id)]!++;
  return c;
};

/** Returns a new array with one more copy of `t`. */
export const withAdded = (c: readonly number[], t: number): Counts => {
  const out = c.slice();
  out[t]!++;
  return out;
};

/** Returns a new array with one fewer copy of `t`. */
export const withRemoved = (c: readonly number[], t: number): Counts => {
  if (!c[t]) throw new RangeError(`no tile of type ${t} to remove`);
  const out = c.slice();
  out[t]!--;
  return out;
};

const SUIT_CHARS = ['m', 'p', 's', 'z'] as const;

/**
 * Parse compact notation like "123m456p789s1122z".
 * In "z", 1-4 = E S W N, 5-7 = haku hatsu chun (same as the library's honors string).
 */
export const fromString = (s: string): Counts => {
  const c = emptyCounts();
  let digits: number[] = [];
  for (const ch of s.replace(/\s+/g, '')) {
    if (ch >= '0' && ch <= '9') {
      digits.push(ch.charCodeAt(0) - 48);
      continue;
    }
    const suit = SUIT_CHARS.indexOf(ch as (typeof SUIT_CHARS)[number]);
    if (suit < 0) throw new SyntaxError(`bad suit char '${ch}' in "${s}"`);
    for (const d of digits) {
      // 0 = red five in common notation; counts treat it as a 5.
      const rank = d === 0 ? 5 : d;
      if (rank < 1 || rank > (suit === 3 ? 7 : 9)) {
        throw new SyntaxError(`bad rank ${d}${ch} in "${s}"`);
      }
      c[suit * 9 + rank - 1]!++;
    }
    digits = [];
  }
  if (digits.length) throw new SyntaxError(`trailing digits without suit in "${s}"`);
  return c;
};

export const toString = (c: readonly number[]): string => {
  let out = '';
  for (let suit = 0; suit < 4; suit++) {
    let part = '';
    const len = suit === 3 ? 7 : 9;
    for (let r = 0; r < len; r++) part += String(r + 1).repeat(c[suit * 9 + r]!);
    if (part) out += part + SUIT_CHARS[suit];
  }
  return out;
};

/** 34-digit string, one digit per type (the oracle's wire format). */
export const fromDigits = (s: string): Counts => {
  if (s.length !== NUM_TYPES) throw new SyntaxError(`expected 34 digits, got ${s.length}`);
  const c = emptyCounts();
  for (let i = 0; i < NUM_TYPES; i++) c[i] = s.charCodeAt(i) - 48;
  return c;
};

/** Encode the 9 counts of a suit starting at `offset` as base-5 digits (< 5^9). */
export const encodeSuit = (c: readonly number[], offset: number): number => {
  let key = 0;
  for (let i = 8; i >= 0; i--) key = key * 5 + c[offset + i]!;
  return key;
};

export const decodeSuit = (key: number): number[] => {
  const out = new Array<number>(9);
  for (let i = 0; i < 9; i++) {
    out[i] = key % 5;
    key = (key - out[i]!) / 5;
  }
  return out;
};
