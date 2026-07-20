#!/usr/bin/env python3
import argparse
import re
import sys
import xml.etree.ElementTree as ET


def parse_bounds(bounds: str) -> tuple[int, int, int, int]:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if not match:
        raise ValueError(f"Invalid bounds: {bounds}")
    return tuple(map(int, match.groups()))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("xml_file")
    parser.add_argument("--text")
    parser.add_argument("--class-name")
    parser.add_argument("--index", type=int, default=0)
    args = parser.parse_args()

    root = ET.parse(args.xml_file).getroot()
    matches: list[tuple[int, int, int, int]] = []
    needle = (args.text or "").casefold()

    for node in root.iter("node"):
        attrs = node.attrib
        if args.class_name and attrs.get("class") != args.class_name:
            continue
        if args.text:
            haystack = " ".join(
                [attrs.get("text", ""), attrs.get("content-desc", ""), attrs.get("hint", "")]
            ).casefold()
            if needle not in haystack:
                continue
        bounds = attrs.get("bounds")
        if not bounds:
            continue
        try:
            x1, y1, x2, y2 = parse_bounds(bounds)
        except ValueError:
            continue
        if x2 <= x1 or y2 <= y1:
            continue
        matches.append((x1, y1, x2, y2))

    if args.index < 0 or args.index >= len(matches):
        return 2
    x1, y1, x2, y2 = matches[args.index]
    print(f"{(x1 + x2) // 2} {(y1 + y2) // 2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
