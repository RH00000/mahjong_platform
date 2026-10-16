"""Check our property-test claims against the `mahjong` library itself.

If the library violates a property, the TS implementation (which matches the
library exactly) would too, so this tells us whether a property is sound
before we assert it in fast-check.

    python props.py hands.jsonl [--limit 20000]
"""

import argparse
import json
from collections import Counter

from mahjong.shanten import Shanten

GROWABLE = {1, 4, 7, 10, 13}  # n such that n and n + 1 are both valid counts


def to_str(c: list[int]) -> str:
    out = ""
    for suit, ch, size in ((0, "m", 9), (1, "p", 9), (2, "s", 9), (3, "z", 7)):
        part = "".join(str(r + 1) * c[suit * 9 + r] for r in range(size))
        if part:
            out += part + ch
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--limit", type=int, default=20_000)
    args = ap.parse_args()

    checked = 0
    deltas: Counter[int] = Counter()
    lo, hi = 0, 0
    violations = []
    per_gen: Counter[str] = Counter()
    with open(args.path, encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            if row.get("meta"):
                continue
            s = row["shanten"]
            lo, hi = min(lo, s), max(hi, s)
            if row["n"] not in GROWABLE or per_gen[row["gen"]] >= args.limit:
                continue
            per_gen[row["gen"]] += 1
            c = [int(ch) for ch in row["hand"]]
            for t in range(34):
                if c[t] == 4:
                    continue
                c[t] += 1
                d = Shanten.calculate_shanten(c) - s
                deltas[d] += 1
                if abs(d) > 1:
                    violations.append((to_str(c), t, d))
                c[t] -= 1
                checked += 1

    print(f"shanten range over all hands: [{lo}, {hi}]")
    print(f"add-one-tile checks: {checked}, delta histogram: {dict(sorted(deltas.items()))}")
    if violations:
        violations.sort(key=lambda v: len(v[0]))
        print(f"VIOLATIONS of |delta| <= 1: {len(violations)}; smallest: {violations[:5]}")
        raise SystemExit(1)
    print("no violations")


if __name__ == "__main__":
    main()
