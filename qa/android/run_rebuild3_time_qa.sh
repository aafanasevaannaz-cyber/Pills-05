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

old_sound = '''phase "Остановка сигнала до запуска голоса"
adb_quick logcat -c >/dev/null 2>&1 || true
scroll_and_tap "Послушать всё напоминание" "04-preview-stop" 14 || exit 1
sleep 1
snapshot "04-preview-running"
scroll_and_tap "Остановить всё" "04-stop" 3 || exit 1
sleep 5
adb_medium logcat -d > "${LOG_DIR}/sequence-stopped.txt" 2>&1 || true
grep -F "Signal started" "${LOG_DIR}/sequence-stopped.txt" >/dev/null || fail "Единый проигрыватель не запустил сигнал"
grep -F "Sequence stopped" "${LOG_DIR}/sequence-stopped.txt" >/dev/null || fail "Команда остановки не дошла до проигрывателя"
if grep -F "Android voice started" "${LOG_DIR}/sequence-stopped.txt" >/dev/null; then
  fail "Голос запустился после ранней остановки"
fi
snapshot "04-after-stop"

phase "Передача от окончания сигнала к голосу"
adb_quick logcat -c >/dev/null 2>&1 || true
scroll_and_tap "Послушать всё напоминание" "04-preview-handoff" 3 || exit 1
sleep 8
adb_medium logcat -d > "${LOG_DIR}/sequence-handoff.txt" 2>&1 || true
if grep -F "Android voice started" "${LOG_DIR}/sequence-handoff.txt" >/dev/null; then
  VOICE_ENV="русский TTS запустился"
elif grep -E "Русский голос Android не установлен|Russian|LANG_MISSING_DATA|LANG_NOT_SUPPORTED" "${LOG_DIR}/sequence-handoff.txt" >/dev/null; then
  VOICE_ENV="на эмуляторе отсутствует русский TTS; переход к голосу и обработка ошибки проверены"
  log_action "Русский TTS отсутствует в системном образе эмулятора"
else
  fail "После окончания сигнала нет запуска голоса или понятной ошибки TTS"
  VOICE_ENV="неопределённая ошибка"
fi
snapshot "04-after-handoff"
scroll_and_tap "Остановить всё" "04-stop-after-handoff" 3 || true
'''

new_sound = '''phase "Остановка сигнала до запуска голоса"
adb_quick logcat -c >/dev/null 2>&1 || true
scroll_until_visible "Послушать всё напоминание" "04-preview-stop" 14 || exit 1
PREVIEW_COORD="$(coords_from_last "Послушать всё напоминание" 0)"
STOP_COORD="$(coords_from_last "Остановить всё" 0)"
[[ -n "$PREVIEW_COORD" && -n "$STOP_COORD" ]] || { fail "UI tree не дал координаты управления звуком"; exit 1; }
tap_coords "$PREVIEW_COORD" "Послушать всё напоминание"
sleep 0.35
tap_coords "$STOP_COORD" "Остановить всё до запуска голоса"
sleep 5
adb_quick exec-out screencap -p > "${SCREEN_DIR}/04-after-early-stop.png" 2>/dev/null || true
adb_medium logcat -d > "${LOG_DIR}/sequence-stopped.txt" 2>&1 || true
grep -F "Signal started" "${LOG_DIR}/sequence-stopped.txt" >/dev/null || fail "Единый проигрыватель не запустил сигнал"
grep -F "Sequence stopped" "${LOG_DIR}/sequence-stopped.txt" >/dev/null || fail "Команда остановки не дошла до проигрывателя"
if grep -F "Android voice started" "${LOG_DIR}/sequence-stopped.txt" >/dev/null; then
  fail "Голос запустился после ранней остановки"
fi

phase "Передача от окончания сигнала к голосу"
adb_quick logcat -c >/dev/null 2>&1 || true
tap_coords "$PREVIEW_COORD" "Послушать всё напоминание повторно"
sleep 8
adb_medium logcat -d > "${LOG_DIR}/sequence-handoff.txt" 2>&1 || true
if grep -F "Android voice started" "${LOG_DIR}/sequence-handoff.txt" >/dev/null; then
  VOICE_ENV="русский TTS запустился"
elif grep -E "Русский голос Android не установлен|Russian|LANG_MISSING_DATA|LANG_NOT_SUPPORTED" "${LOG_DIR}/sequence-handoff.txt" >/dev/null; then
  VOICE_ENV="на эмуляторе отсутствует русский TTS; переход к голосу и обработка ошибки проверены"
  log_action "Русский TTS отсутствует в системном образе эмулятора"
else
  fail "После окончания сигнала нет запуска голоса или понятной ошибки TTS"
  VOICE_ENV="неопределённая ошибка"
fi
tap_coords "$STOP_COORD" "Остановить всё после проверки голоса"
sleep 1
'''

if old_sound not in text:
    raise SystemExit('QA sound-sequence patch target not found')
text = text.replace(old_sound, new_sound)
path.write_text(text, encoding='utf-8')
PY

chmod +x "$RUNTIME"
exec bash "$RUNTIME" "$@"
