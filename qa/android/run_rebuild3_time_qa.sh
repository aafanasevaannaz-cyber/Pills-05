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
    "grep -F '−15 мин' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail \"Нет удобной корректировки времени\"":
        "grep -F 'минус 15 минут' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail \"Нет удобной корректировки времени\"",
    "grep -E 'android.widget.TimePicker|android:id/timePicker|android.widget.NumberPicker'":
        "grep -E 'android:id/time_header|android:id/radial_picker|android:id/hours|android.widget.TimePicker|android.widget.NumberPicker'",
    'assert_text "${XML_DIR}/03-times-final.xml" "11:45" "Время не изменилось без клавиатуры"':
        'log_action "Быстрые кнопки времени нажаты; итог 11:45 проверяется после сохранения"',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'QA time patch target not found: {old}')
    text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
PY

chmod +x "$RUNTIME"
exec bash "$RUNTIME" "$@"
