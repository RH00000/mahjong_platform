"""Generate random hands and the `mahjong` library's shanten numbers as JSONL.

Each line: {"gen", "n", "hand" (34-digit counts string), "shanten",
"regular", "chiitoitsu", "kokushi"}. Output is deterministic for a given seed.

    python gen.py --seed 20261015 --out hands.jsonl
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections.abc import Callable
from importlib.metadata import version

from mahjong.shanten import Shanten

TERMINAL_HONOR = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
VALID_COUNTS = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14]
SMALL_COUNTS = [1, 2, 4, 5, 7, 8, 10, 11]

Counts = list[int]


def draw_from_wall(rng: random.Random, n: int) -> Counts:
    wall = [i // 4 for i in range(136)]
    rng.shuffle(wall)
    c = [0] * 34
    for t in wall[:n]:
        c[t] += 1
    return c


def can_add(c: Counts, t: int, k: int = 1) -> bool:
    return c[t] + k <= 4


def add_random_tiles(rng: random.Random, c: Counts, k: int, pool: list[int] | None = None) -> None:
    pool = pool if pool is not None else list(range(34))
    while k > 0:
        t = rng.choice(pool)
        if can_add(c, t):
            c[t] += 1
            k -= 1


def remove_random_tiles(rng: random.Random, c: Counts, k: int) -> None:
    for _ in range(k):
        held = [t for t in range(34) if c[t]]
        c[rng.choice(held)] -= 1


def fit_to_size(rng: random.Random, c: Counts, size: int) -> Counts:
    n = sum(c)
    if n > size:
        remove_random_tiles(rng, c, n - size)
    elif n < size:
        add_random_tiles(rng, c, size - n)
    return c


def add_random_meld(rng: random.Random, c: Counts) -> bool:
    if rng.random() < 0.6:
        suit = rng.randrange(3)
        start = suit * 9 + rng.randrange(7)
        if all(can_add(c, start + j) for j in range(3)):
            for j in range(3):
                c[start + j] += 1
            return True
        return False
    t = rng.randrange(34)
    if can_add(c, t, 3):
        c[t] += 3
        return True
    return False


def gen_uniform13(rng: random.Random) -> Counts:
    return draw_from_wall(rng, 13)


def gen_uniform14(rng: random.Random) -> Counts:
    return draw_from_wall(rng, 14)


def gen_near_tenpai(rng: random.Random) -> Counts:
    """Complete-ish hand (melds + pair), then perturbed by 0-2 tile swaps."""
    c = [0] * 34
    melds = 0
    while melds < 4:
        if add_random_meld(rng, c):
            melds += 1
    while True:
        t = rng.randrange(34)
        if can_add(c, t, 2):
            c[t] += 2
            break
    size = rng.choice([13, 14])
    remove_random_tiles(rng, c, 14 - size)
    swaps = rng.choice([0, 1, 1, 2, 2])
    remove_random_tiles(rng, c, swaps)
    add_random_tiles(rng, c, swaps)
    return c


def gen_chiitoi_heavy(rng: random.Random) -> Counts:
    c = [0] * 34
    pairs = rng.randint(4, 7)
    for _ in range(pairs):
        # Sometimes stack a second pair on the same type (a quad).
        if rng.random() < 0.15:
            held = [t for t in range(34) if c[t] == 2]
            if held:
                c[rng.choice(held)] += 2
                continue
        while True:
            t = rng.randrange(34)
            if c[t] == 0:
                c[t] = 2
                break
    return fit_to_size(rng, c, rng.choice([13, 14]))


def gen_kokushi_heavy(rng: random.Random) -> Counts:
    c = [0] * 34
    for t in rng.sample(TERMINAL_HONOR, rng.randint(9, 13)):
        c[t] = 1
    size = rng.choice([13, 14])
    n = sum(c)
    # Fill mostly with terminals/honors, sometimes with anything.
    pool = TERMINAL_HONOR if rng.random() < 0.7 else None
    add_random_tiles(rng, c, max(0, size - n), pool)
    return fit_to_size(rng, c, size)


def gen_open_sizes(rng: random.Random) -> Counts:
    """Hand sizes that occur after calls (1, 2, 4, ..., 11 tiles)."""
    size = rng.choice(SMALL_COUNTS)
    if rng.random() < 0.5:
        return draw_from_wall(rng, size)
    c = [0] * 34
    for _ in range(size // 3):
        while not add_random_meld(rng, c):
            pass
    return fit_to_size(rng, c, size)


def gen_quads_and_honors(rng: random.Random) -> Counts:
    """Force 4-copy tiles (suited and honor) to exercise the library's quad rules."""
    # Sizes >= 4 so at least one quad fits; mostly closed-hand sizes.
    size = rng.choice([13, 14] if rng.random() < 0.7 else [4, 5, 7, 8, 10, 11])
    c = [0] * 34
    quads = rng.randint(1, min(3, size // 4))
    for _ in range(quads):
        pool = list(range(27, 34)) if rng.random() < 0.5 else list(range(27))
        t = rng.choice(pool)
        if c[t] == 0:
            c[t] = 4
    if rng.random() < 0.5:
        # Isolated tiles that sit next to the quads.
        for t in range(34):
            if c[t] == 4 and t < 27 and t % 9 < 7 and sum(c) < size:
                c[t + 2] = min(4, c[t + 2] + 1)
    return fit_to_size(rng, c, size)


GENERATORS: dict[str, tuple[Callable[[random.Random], Counts], int]] = {
    "uniform13": (gen_uniform13, 30_000),
    "uniform14": (gen_uniform14, 30_000),
    "near_tenpai": (gen_near_tenpai, 30_000),
    "chiitoi_heavy": (gen_chiitoi_heavy, 10_000),
    "kokushi_heavy": (gen_kokushi_heavy, 10_000),
    "open_sizes": (gen_open_sizes, 10_000),
    "quads_and_honors": (gen_quads_and_honors, 10_000),
}


def record(gen: str, c: Counts) -> dict:
    n = sum(c)
    assert n in VALID_COUNTS and max(c) <= 4, (gen, c)
    return {
        "gen": gen,
        "n": n,
        "hand": "".join(map(str, c)),
        "shanten": Shanten.calculate_shanten(c),
        "regular": Shanten.calculate_shanten_for_regular_hand(c),
        "chiitoitsu": Shanten.calculate_shanten_for_chiitoitsu_hand(c),
        "kokushi": Shanten.calculate_shanten_for_kokushi_hand(c),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20261015)
    ap.add_argument("--scale", type=float, default=1.0, help="multiply every generator's count")
    ap.add_argument("--out", default="hands.jsonl")
    args = ap.parse_args()

    total = 0
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        meta = {"meta": True, "seed": args.seed, "libVersion": version("mahjong")}
        f.write(json.dumps(meta) + "\n")
        for i, (name, (fn, count)) in enumerate(GENERATORS.items()):
            rng = random.Random(f"{args.seed}:{name}")
            n = int(count * args.scale)
            for _ in range(n):
                f.write(json.dumps(record(name, fn(rng)), separators=(",", ":")) + "\n")
            total += n
            print(f"  {name:<18} {n:>7}", file=sys.stderr)
    print(f"wrote {total} hands to {args.out} (mahjong {version('mahjong')})", file=sys.stderr)


if __name__ == "__main__":
    main()
