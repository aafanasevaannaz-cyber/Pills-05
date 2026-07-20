#!/usr/bin/env python3
import argparse
import re
import sys
import xml.etree.ElementTree as ET


def bounds(value: str) -> tuple[int, int, int, int] | None:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", value or "")
    return tuple(map(int, match.groups())) if match else None


def visible_nodes(root: ET.Element, needle: str):
    result = []
    folded = needle.casefold()
    for node in root.iter("node"):
        attrs = node.attrib
        text = " ".join(
            [attrs.get("text", ""), attrs.get("content-desc", ""), attrs.get("hint", "")]
        )
        if folded not in text.casefold():
            continue
        parsed = bounds(attrs.get("bounds", ""))
        if parsed and parsed[2] > parsed[0] and parsed[3] > parsed[1]:
            result.append((text, parsed))
    return result


def overlaps(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("xml_file")
    parser.add_argument("--time", default="08:00")
    parser.add_argument("--medicine", default="TestMed")
    parser.add_argument("--require-progress", action="store_true")
    args = parser.parse_args()

    root = ET.parse(args.xml_file).getroot()
    times = visible_nodes(root, args.time)
    medicines = visible_nodes(root, args.medicine)
    if not times or not medicines:
        print(f"Missing visible nodes: time={len(times)}, medicine={len(medicines)}", file=sys.stderr)
        return 2

    for _, time_bounds in times:
        for _, medicine_bounds in medicines:
            if overlaps(time_bounds, medicine_bounds):
                print(
                    f"Time and medicine overlap: {time_bounds} vs {medicine_bounds}",
                    file=sys.stderr,
                )
                return 3

    if args.require_progress:
        combined = " ".join(
            " ".join(
                [node.attrib.get("text", ""), node.attrib.get("content-desc", "")]
            )
            for node in root.iter("node")
        )
        if "Принято 0 из 1" not in combined:
            print("Expected progress ‘Принято 0 из 1’ was not found", file=sys.stderr)
            return 4
        if "Не принято: 1" not in combined:
            print("Expected skipped counter ‘Не принято: 1’ was not found", file=sys.stderr)
            return 5
        if "Принято 1 из 1" in combined:
            print("Skipped dose was incorrectly counted as taken", file=sys.stderr)
            return 6

    print("Realme layout and progress assertions passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
