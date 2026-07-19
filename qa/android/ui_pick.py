#!/usr/bin/env python3
import argparse
import sys
import xml.etree.ElementTree as ET


def center(bounds: str) -> tuple[int, int]:
    left_top, right_bottom = bounds.replace('][', ',').replace('[', '').replace(']', '').split(',')
    x1, y1 = map(int, left_top.split(',')) if ',' in left_top else (0, 0)
    x2, y2 = map(int, right_bottom.split(',')) if ',' in right_bottom else (0, 0)
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def parse_bounds(bounds: str) -> tuple[int, int]:
    import re
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if not match:
        raise ValueError(f"Invalid bounds: {bounds}")
    x1, y1, x2, y2 = map(int, match.groups())
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('xml_file')
    parser.add_argument('--text')
    parser.add_argument('--class-name')
    parser.add_argument('--resource-id')
    parser.add_argument('--index', type=int, default=0)
    args = parser.parse_args()

    root = ET.parse(args.xml_file).getroot()
    matches = []
    needle = (args.text or '').casefold()

    for node in root.iter('node'):
        attrs = node.attrib
        if args.class_name and attrs.get('class') != args.class_name:
            continue
        if args.resource_id and args.resource_id not in attrs.get('resource-id', ''):
            continue
        if args.text:
            haystack = ' '.join([
                attrs.get('text', ''),
                attrs.get('content-desc', ''),
                attrs.get('hint', ''),
            ]).casefold()
            if needle not in haystack:
                continue
        bounds = attrs.get('bounds')
        if not bounds:
            continue
        matches.append((node, bounds))

    if args.index < 0 or args.index >= len(matches):
        print('', end='')
        return 2

    _, bounds = matches[args.index]
    x, y = parse_bounds(bounds)
    print(f'{x} {y}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
