#!/usr/bin/env bash
set -euo pipefail

SOURCE="qa/android/run_rebuild2_qa_v2.sh"
RUNTIME="/tmp/run_rebuild3_time_qa_runtime.sh"
cp "$SOURCE" "$RUNTIME"

python3 - "$RUNTIME" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
replacements = {
    'COUNT_TWO="$(coords_for "$LAST_XML" --text "2 раза в день" --index 0)"':
        'COUNT_TWO="$(coords_for "${XML_DIR}/03-time-count.xml" --text "2 раза в день" --index 0)"',
    'COUNT_THREE="$(coords_for "$LAST_XML" --text "3 раза в день" --index 0)"':
        'COUNT_THREE="$(coords_for "${XML_DIR}/03-time-count.xml" --text "3 раза в день" --index 0)"',
    'COUNT_FOUR="$(coords_for "$LAST_XML" --text "4 раза в день" --index 0)"':
        'COUNT_FOUR="$(coords_for "${XML_DIR}/03-time-count.xml" --text "4 раза в день" --index 0)"',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'QA count-coordinate patch target not found: {old}')
    text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
PY

chmod +x "$RUNTIME"
exec bash "$RUNTIME" "$@"
