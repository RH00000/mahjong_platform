"""Print the `mahjong` library's shanten numbers for one hand.

    python check.py 123m456p789s1122z
"""

import sys

from mahjong.shanten import Shanten
from mahjong.tile import TilesConverter


def parse(s: str) -> list[int]:
    parts = {"m": "", "p": "", "s": "", "z": ""}
    digits = ""
    for ch in s:
        if ch.isdigit():
            digits += ch
        else:
            parts[ch] += digits
            digits = ""
    return TilesConverter.string_to_34_array(
        man=parts["m"], pin=parts["p"], sou=parts["s"], honors=parts["z"]
    )


if __name__ == "__main__":
    c = parse(sys.argv[1])
    print(
        {
            "shanten": Shanten.calculate_shanten(c),
            "regular": Shanten.calculate_shanten_for_regular_hand(c),
            "chiitoitsu": Shanten.calculate_shanten_for_chiitoitsu_hand(c),
            "kokushi": Shanten.calculate_shanten_for_kokushi_hand(c),
        }
    )
