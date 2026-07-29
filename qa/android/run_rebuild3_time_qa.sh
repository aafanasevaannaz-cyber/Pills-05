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

# Эти замены адаптируют обёртку rebuild2 к новой компактной форме времени rebuild3.
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
    'QUICK_TWELVE="$(coords_for "$LAST_XML" --text "Приём 1, установить 12:00" --index 0)"':
        'PLUS_FIFTEEN="$(coords_for "$LAST_XML" --text "Приём 1, плюс 15 минут" --index 0)"',
    'MINUS_FIFTEEN="$(coords_for "$LAST_XML" --text "Приём 1, минус 15 минут" --index 0)"':
        'MINUS_FIFTEEN="$(coords_for "$LAST_XML" --text "Приём 1, минус 15 минут" --index 0)"\nCONTINUE_COORD="$(coords_for "$LAST_XML" --text "Продолжить" --index 0)"',
    'for required in "$COUNT_TWO" "$COUNT_THREE" "$COUNT_FOUR" "$TIME_ONE" "$QUICK_TWELVE" "$MINUS_FIFTEEN"; do':
        'for required in "$COUNT_TWO" "$COUNT_THREE" "$COUNT_FOUR" "$TIME_ONE" "$PLUS_FIFTEEN" "$MINUS_FIFTEEN" "$CONTINUE_COORD"; do',
    'tap_coords "$QUICK_TWELVE" "быстро установить 12:00"\ntap_coords "$MINUS_FIFTEEN" "уменьшить на 15 минут"':
        'for press in $(seq 1 15); do\n  tap_coords "$PLUS_FIFTEEN" "увеличить время на 15 минут (${press}/15)"\ndone',
    'assert_text "${XML_DIR}/03-times-final.xml" "11:45" "Время не изменилось без клавиатуры"':
        'log_action "Пятнадцать быстрых изменений выполнены; итог 11:45 проверяется после сохранения"',
    'scroll_and_tap "Продолжить" "03-times-continue" 12 || exit 1':
        'tap_coords "$CONTINUE_COORD" "Продолжить после настройки времени"',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'QA time patch target not found: {old}')
    text = text.replace(old, new)

# Встраиваем следующие небольшие замены внутрь Python-генератора v2.
# Там переменная text уже содержит основной Android QA-сценарий.
injection = r'''
early_stop_old = '''scroll_and_tap "Послушать всё напоминание" "04-preview-stop" 14 || exit 1
sleep 1
snapshot "04-preview-running"
scroll_and_tap "Остановить всё" "04-stop" 3 || exit 1'''
early_stop_new = '''scroll_until_visible "Послушать всё напоминание" "04-preview-stop" 14 || exit 1
PREVIEW_COORD="$(coords_from_last "Послушать всё напоминание" 0)"
STOP_COORD="$(coords_from_last "Остановить всё" 0)"
[[ -n "$PREVIEW_COORD" && -n "$STOP_COORD" ]] || { fail "UI tree не дал координаты управления звуком"; exit 1; }
read -r PREVIEW_X PREVIEW_Y <<<"$PREVIEW_COORD"
read -r STOP_X STOP_Y <<<"$STOP_COORD"
adb_quick shell input tap "$PREVIEW_X" "$PREVIEW_Y" >/dev/null 2>&1 || true
log_action "Сигнал запущен для ранней остановки"
sleep 0.35
adb_quick shell input tap "$STOP_X" "$STOP_Y" >/dev/null 2>&1 || true
log_action "Остановить всё нажато до запуска голоса"'''

stop_snapshot_old = '''snapshot "04-after-stop"'''
stop_snapshot_new = '''adb_quick exec-out screencap -p > "${SCREEN_DIR}/04-after-early-stop.png" 2>/dev/null || true
log_action "Скриншот после ранней остановки сохранён без задержки UI Automator"'''

handoff_start_old = '''scroll_and_tap "Послушать всё напоминание" "04-preview-handoff" 3 || exit 1'''
handoff_start_new = '''adb_quick shell input tap "$PREVIEW_X" "$PREVIEW_Y" >/dev/null 2>&1 || true
log_action "Сигнал повторно запущен для проверки перехода к голосу"'''

handoff_stop_old = '''snapshot "04-after-handoff"
scroll_and_tap "Остановить всё" "04-stop-after-handoff" 3 || true'''
handoff_stop_new = '''adb_quick exec-out screencap -p > "${SCREEN_DIR}/04-after-handoff.png" 2>/dev/null || true
adb_quick shell input tap "$STOP_X" "$STOP_Y" >/dev/null 2>&1 || true
log_action "Остановить всё нажато после проверки перехода к голосу"
sleep 1'''

sound_replacements = [
    (early_stop_old, early_stop_new, 'early sound stop'),
    (stop_snapshot_old, stop_snapshot_new, 'early stop screenshot'),
    (handoff_start_old, handoff_start_new, 'voice handoff start'),
    (handoff_stop_old, handoff_stop_new, 'voice handoff stop'),
]
for old, new, label in sound_replacements:
    if old not in text:
        raise SystemExit(f'Generated QA sound patch target not found: {label}')
    text = text.replace(old, new)
'''

marker = "path.write_text(text, encoding='utf-8')"
if text.count(marker) != 1:
    raise SystemExit('Could not locate the v2 QA write marker')
text = text.replace(marker, injection + "\n" + marker)
path.write_text(text, encoding='utf-8')
PY

chmod +x "$RUNTIME"
exec bash "$RUNTIME" "$@"
