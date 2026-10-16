/**
 * Differential test against the Python `mahjong` library.
 * Data: tools/oracle/hands.jsonl, produced by `pnpm oracle` (tools/oracle/gen.py).
 * Writes a summary to tools/oracle/results.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fromDigits, toString } from '../src/hand.js';
import { shantenComponents, type ShantenComponents } from '../src/shanten.js';

const ORACLE_DIR = fileURLToPath(new URL('../../../tools/oracle/', import.meta.url));
const DATA = `${ORACLE_DIR}hands.jsonl`;
const RESULTS = `${ORACLE_DIR}results.json`;

interface Row {
  gen: string;
  n: number;
  hand: string;
  shanten: number;
  regular: number;
  chiitoitsu: number;
  kokushi: number;
}

interface Mismatch {
  gen: string;
  hand: string;
  n: number;
  expected: Omit<ShantenComponents, 'min'> & { shanten: number };
  actual: Omit<ShantenComponents, 'min'> & { shanten: number };
}

describe.skipIf(!existsSync(DATA))('oracle: mahjong library parity', () => {
  it('matches shanten and every component on every hand', () => {
    const lines = readFileSync(DATA, 'utf8').split('\n').filter(Boolean);
    const meta = JSON.parse(lines[0]!) as { meta: true; seed: number; libVersion: string };
    expect(meta.meta).toBe(true);

    const byGenerator: Record<
      string,
      { total: number; matched: number; shantenHistogram: Record<string, number> }
    > = {};
    const mismatches: Mismatch[] = [];
    let total = 0;
    let matched = 0;

    const t0 = performance.now();
    for (let i = 1; i < lines.length; i++) {
      const row = JSON.parse(lines[i]!) as Row;
      const got = shantenComponents(fromDigits(row.hand));
      const ok =
        got.min === row.shanten &&
        got.regular === row.regular &&
        got.chiitoitsu === row.chiitoitsu &&
        got.kokushi === row.kokushi;

      const g = (byGenerator[row.gen] ??= { total: 0, matched: 0, shantenHistogram: {} });
      g.total++;
      g.shantenHistogram[row.shanten] = (g.shantenHistogram[row.shanten] ?? 0) + 1;
      total++;
      if (ok) {
        g.matched++;
        matched++;
      } else {
        mismatches.push({
          gen: row.gen,
          hand: toString(fromDigits(row.hand)),
          n: row.n,
          expected: {
            shanten: row.shanten,
            regular: row.regular,
            chiitoitsu: row.chiitoitsu,
            kokushi: row.kokushi,
          },
          actual: {
            shanten: got.min,
            regular: got.regular,
            chiitoitsu: got.chiitoitsu,
            kokushi: got.kokushi,
          },
        });
      }
    }
    const durationMs = Math.round(performance.now() - t0);

    const summary = {
      libVersion: meta.libVersion,
      seed: meta.seed,
      total,
      matched,
      matchRate: total ? matched / total : 0,
      byGenerator,
      tsDurationMs: durationMs,
      smallestMismatches: mismatches
        .sort((a, b) => a.n - b.n || a.expected.shanten - b.expected.shanten)
        .slice(0, 10),
    };
    writeFileSync(RESULTS, JSON.stringify(summary, null, 2) + '\n');

    console.log(
      `oracle: ${matched}/${total} matched (mahjong ${meta.libVersion}, seed ${meta.seed}) in ${durationMs} ms`,
    );
    for (const [gen, g] of Object.entries(byGenerator)) {
      console.log(`  ${gen.padEnd(18)} ${g.matched}/${g.total}`);
    }
    if (mismatches.length) {
      console.log('smallest mismatches:', JSON.stringify(summary.smallestMismatches, null, 2));
    }

    expect(total).toBeGreaterThanOrEqual(100_000);
    expect(mismatches.length).toBe(0);
  });
});
