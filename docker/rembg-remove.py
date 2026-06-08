#!/usr/bin/env python3
"""Remove image background via rembg (called from Node imagePipeline)."""
import sys
from pathlib import Path

from rembg import remove


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: rembg-remove.py INPUT OUTPUT", file=sys.stderr)
        return 2
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.write_bytes(remove(src.read_bytes()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
