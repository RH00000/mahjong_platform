# Phase 1: tiles, hands, shanten, and oracle parity

## What was built

| File | Purpose |
|---|---|
| `packages/engine/src/tiles.ts` | 136 tile ids (`type = id >> 2`), library tile order, red fives = ids 16/52/88, xoshiro128** RNG seeded via splitmix32 (serializable state), Fisher–Yates wall |
| `packages/engine/src/hand.ts` | `number[34]` counts, `123m456p…` notation, base-5 suit keys (`encodeSuit` < 5^9) |
| `packages/engine/src/decompose.ts` | Memoized per-suit decomposition: suit key → distinct `(melds, taatsu, pairs, iso)` outcomes |
| `packages/engine/src/shanten.ts` | `regularShanten`, `chiitoitsuShanten`, `kokushiShanten`, `shanten` (min), `shantenComponents`, plus `regularShantenUnmemoized` |
| `packages/engine/src/shanten-ref.ts` | Unmemoized line-for-line port of the library's whole-hand DFS (`_RegularShanten`) |
| `tools/oracle/gen.py` | Seeded hand generators → JSONL with the library's shanten and all three components |
| `tools/oracle/props.py` | Checks the "add one tile ⇒ \|Δ\| ≤ 1" property against the library itself |
| `tools/oracle/check.py`, `packages/engine/scripts/shanten.ts` | Single-hand CLIs for side-by-side comparison |
| `tools/oracle/run.mjs` | `pnpm oracle`: venv → generate → library property check → TS parity test |

The engine package type-checks with `lib: ["ES2022"]` and `types: []`, so any use of a Node API in `src/` fails to compile.

## How parity works

`mahjong==2.0.0` does not compute shanten by exhaustive search. Its regular-hand shanten is a pruned DFS ported from Tenhou-style code, with quirks that any reimplementation has to reproduce:

- **Forced sequence:** a lone tile followed by `1, ≥1, ≠4` is forced into a sequence.
- **Four-copies penalty:** +1 when there is no pair and every isolated tile is a type the hand holds four copies of.
- **Honor-quad (jidahai) floor:** honor quads set a floor on the result. Example: `1111z2222z3333m44m` → regular 1, not -1.
- **Tile counts:** counts divisible by 3, or above 14, raise an error.

Matching it 100% therefore means replicating that search.

The factoring argument: the DFS visits types 0..26 in order, and every move it makes on a suited tile reads and writes only tiles of that same suit. So the set of leaves it reaches is the Cartesian product of per-suit leaf sets. The leaf formula depends on the sums of melds, taatsu, and pairs, plus one bit of global information: whether every isolated tile is a 4-copy type. That bit is captured per suit as `iso ∈ {NONE, ONLY_QUADS, OTHER}`.

Each suit's distinct outcomes are therefore computed once and memoized on the 9-digit base-5 count key. The honor pre-pass and `_update_result` are applied unchanged. Outcomes are not Pareto-pruned, because the `kouho > 4` cap and the quad penalty make the formula non-monotone.

## Measured numbers

All numbers below come from commands in this repo. The files they write are committed.

**Oracle parity.** Run `pnpm oracle`, which writes `tools/oracle/results.json`. Seed is `20261015`, library is `mahjong` 2.0.0. Result: **130,000 / 130,000 hands match on all four values** (`shanten`, `regular`, `chiitoitsu`, `kokushi`).

| Generator | Hands | Matched | Shanten histogram (from results.json) |
|---|---|---|---|
| uniform13 | 30,000 | 30,000 | 1: 180, 2: 2,815, 3: 10,741, 4: 12,030, 5: 3,993, 6: 241 |
| uniform14 | 30,000 | 30,000 | -1: 1, 0: 17, 1: 662, 2: 6,019, 3: 13,099, 4: 8,527, 5: 1,632, 6: 43 |
| near_tenpai | 30,000 | 30,000 | -1: 3,374, 0: 11,440, 1: 12,067, 2: 3,119 |
| chiitoi_heavy | 10,000 | 10,000 | -1: 486, 0: 1,761, 1: 3,890, 2: 3,432, 3: 423, 4: 8 |
| kokushi_heavy | 10,000 | 10,000 | -1: 925, 0: 3,544, 1: 2,902, 2: 2,021, 3: 536, 4: 72 |
| open_sizes (1–11 tiles) | 10,000 | 10,000 | -1: 111, 0: 6,209, 1: 903, 2: 1,388, 3: 946, 4: 390, 5: 53 |
| quads_and_honors | 10,000 | 10,000 | -1: 1, 0: 626, 1: 2,459, 2: 3,749, 3: 2,271, 4: 818, 5: 76 |

The uniform sets almost never reach tenpai (17 of 60,000), so the biased generators supply nearly all of the -1 and 0 cases.

**Library self-check.** `props.py` runs as part of `pnpm oracle`. Across 1,859,692 add-one-tile checks, the deltas were -1: 578,031 and 0: 1,281,661, with **no violations** of \|Δ\| ≤ 1. The property is therefore sound to assert in TS.

**Property tests.** Run `pnpm test`; 20 tests pass. The fast-check properties (5,000 runs each) are:
- shanten ∈ [-1, 8], and each component stays in its own range
- adding one tile changes shanten by \|Δ\| ≤ 1
- constructed complete regular, chiitoitsu, and kokushi hands return -1
- tile-id order doesn't change the result
- memoized, unmemoized, and whole-hand reference implementations agree
- invalid counts throw

**Speed.** Run `pnpm bench`, which writes `packages/engine/bench/results.json`. Each value is the mean time to process 10k random 14-tile hands, measured on an Intel Core Ultra 9 285H, Windows 11, Node 24.21. These are single runs, so expect a few percent of variance.

| Implementation | Mean ms / 10k hands |
|---|---|
| `shanten` (memoized, warm; all three types) | 9.64 |
| `regularShanten` (memoized, warm) | 7.37 |
| `regularShanten` (memo cleared each run) | 11.21 |
| `regularShantenUnmemoized` (per-suit, no memo) | 19.65 |
| `regularShantenReference` (whole-hand DFS port) | 16.80 |

The warm memo table holds 3,995 suit keys after one pass over those 10k hands, and warm memoized regular shanten is about 2.3× faster than the reference port. The memo will matter more in Phase 2: the bot's ukeire computation calls shanten on hands that differ by one tile, so most suit keys repeat.

## Reproduce

```
pnpm install
pnpm typecheck
pnpm test        # unit + property tests (oracle test is skipped unless hands.jsonl exists)
pnpm oracle      # regenerate 130k hands with the library, check props, run parity
pnpm bench
```

`hands.jsonl` is gitignored; it is regenerated deterministically from the seed. `pnpm oracle --seed N` tries another seed. `--scale X` resizes every generator, but the test enforces a 100k-hand floor, so scales below about 0.77 fail by design.
