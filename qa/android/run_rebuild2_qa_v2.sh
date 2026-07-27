#!/usr/bin/env bash
set -euo pipefail

SOURCE="qa/android/run_rebuild2_qa.sh"
RUNTIME="/tmp/run_rebuild3_qa_runtime.sh"
cp "$SOURCE" "$RUNTIME"

python3 - "$RUNTIME" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
text = text.replace('com.chaipodusham.pochasam.rebuild2', 'com.chaipodusham.pochasam.rebuild3')
text = text.replace('По часам 2', 'По часам 3')
text = text.replace('medicine-reminders-v10-silent', 'medicine-reminders-v11-rebuild3-silent')
text = text.replace(
    '''grep -F "draft.dosage.trim() || '1 таблетка'" src/components/screens/AddMedicineScreen.tsx >/dev/null || fail "Нет дозировки по умолчанию"''',
    '''grep -F 'medicineForm: draft.medicineForm' src/components/screens/AddMedicineScreen.tsx >/dev/null || fail "Форма лекарства не сохраняется"
grep -F 'getDefaultDosageForForm' src/components/screens/AddMedicineScreen.tsx >/dev/null || fail "Нет дозировки по умолчанию для формы"
grep -F "title: 'Саше'" src/features/medicines/forms.ts >/dev/null || fail "Нет формы саше"'''
)
old_navigation = '''phase "Название и один непрозрачный список"
if ! tap_from_last "Добавить первое лекарство"; then
  tap_from_last "+ Добавить" || { fail "Не удалось открыть добавление"; exit 1; }
fi
snapshot "01-name-empty"
assert_text "${XML_DIR}/01-name-empty.xml" "Как называется лекарство" "Не открыт шаг названия"
coords="$(coords_for "$LAST_XML" --class-name android.widget.EditText --index 0)"
'''
new_navigation = '''phase "Название и один непрозрачный список"
tap_from_last "Добавить первое лекарство" || true
sleep 3
snapshot "01-name-attempt"
if ! contains_text "${XML_DIR}/01-name-attempt.xml" "Как называется лекарство"; then
  log_action "Первое нажатие не сменило маршрут; повторяем через верхнюю кнопку"
  if ! tap_from_last "+ Добавить"; then
    adb_quick shell input tap 670 230 >/dev/null 2>&1 || true
    log_action "Верхняя кнопка нажата резервными координатами"
  fi
  sleep 3
  snapshot "01-name-empty"
else
  cp "${XML_DIR}/01-name-attempt.xml" "${XML_DIR}/01-name-empty.xml"
  cp "${SCREEN_DIR}/01-name-attempt.png" "${SCREEN_DIR}/01-name-empty.png"
fi
assert_text "${XML_DIR}/01-name-empty.xml" "Как называется лекарство" "Не открыт шаг названия"
coords="$(coords_for "$LAST_XML" --class-name android.widget.EditText --index 0)"
'''
old_continue = '''snapshot "01-name-keyboard"
assert_not_text "${XML_DIR}/01-name-keyboard.xml" "Нажмите, чтобы дописать" "Осталась старая огромная карточка автодополнения"
# Нажимаем продолжение до закрытия клавиатуры: после её закрытия WebView Android 12 иногда отдаёт неполное accessibility-дерево.
require_tap "Продолжить" "failure-name" || exit 1
sleep 2
snapshot "02-frequency"
'''
new_continue = '''snapshot "01-name-keyboard"
assert_not_text "${XML_DIR}/01-name-keyboard.xml" "Нажмите, чтобы дописать" "Осталась старая огромная карточка автодополнения"
# Основной путь — клавиша «Далее» на клавиатуре.
adb_quick shell input keyevent KEYCODE_ENTER >/dev/null 2>&1 || true
log_action "Нажата клавиша «Далее» на клавиатуре"
sleep 3
snapshot "02-frequency"
if ! contains_text "${XML_DIR}/02-frequency.xml" "Как часто принимать"; then
  fail "Клавиатура не перевела на шаг частоты"
  exit 1
fi
'''
old_frequency = '''snapshot "02-frequency-selected"
require_tap "Продолжить" "failure-frequency-continue" || exit 1
sleep 2
snapshot "03-time-count"
'''
new_frequency = '''snapshot "02-frequency-selected"
if ! tap_from_last "Продолжить"; then
  adb_quick shell input tap 735 1800 >/dev/null 2>&1 || true
  log_action "Кнопка «Продолжить» нажата резервными координатами"
fi
sleep 3
snapshot "03-time-count"
if ! contains_text "${XML_DIR}/03-time-count.xml" "В какое время напомнить"; then
  fail "Не открыт шаг времени"
  exit 1
fi
'''
old_find_edit = '''find_and_tap_edit() {
  local label="$1"
  local prefix="$2"
  local rounds="${3:-8}"
  local round coords
  for ((round=0; round<=rounds; round+=1)); do
    coords="$(coords_from_last "$label" 0)"
    if [[ -n "$coords" ]]; then
      tap_coords "$coords" "$label"
      LAST_XML=""
      return 0
    fi
    adb_quick shell input swipe 540 1900 540 760 330 >/dev/null 2>&1 || true
    snapshot "${prefix}-scroll-${round}"
  done
  fail "Не найдено поле «${label}»"
  return 1
}
'''
new_find_edit = '''find_and_tap_edit() {
  local label="$1"
  local prefix="$2"
  local rounds="${3:-8}"
  local round coords
  # После изменения количества строк WebView иногда сохраняет прокрутку на втором приёме.
  # Всегда начинаем поиск поля сверху, затем движемся вниз.
  for round in 1 2 3 4; do
    adb_quick shell input swipe 540 760 540 1900 280 >/dev/null 2>&1 || true
  done
  snapshot "${prefix}-top"
  for ((round=0; round<=rounds; round+=1)); do
    coords="$(coords_from_last "$label" 0)"
    if [[ -n "$coords" ]]; then
      tap_coords "$coords" "$label"
      LAST_XML=""
      return 0
    fi
    adb_quick shell input swipe 540 1900 540 760 330 >/dev/null 2>&1 || true
    snapshot "${prefix}-scroll-${round}"
  done
  fail "Не найдено поле «${label}»"
  return 1
}
'''
old_times_continue = '''scroll_and_tap "Продолжить" "03-times-continue" 8 || exit 1
sleep 2
snapshot "04-sound-top"
'''
new_times_continue = '''if ! scroll_and_tap "Продолжить" "03-times-continue" 8; then
  adb_quick shell input tap 735 1800 >/dev/null 2>&1 || true
  log_action "Продолжение после времени нажато резервными координатами"
fi
sleep 3
snapshot "04-sound-top"
'''
old_sound_continue = '''scroll_and_tap "Продолжить" "04-sound-continue" 12 || exit 1
sleep 2
snapshot "05-dose-default"
'''
new_sound_continue = '''if ! scroll_and_tap "Продолжить" "04-sound-continue" 12; then
  adb_quick shell input tap 735 1800 >/dev/null 2>&1 || true
  log_action "Продолжение после звука нажато резервными координатами"
fi
sleep 3
snapshot "05-dose-default"
'''
old_save = '''scroll_and_tap "Сохранить" "05-save" 12 || exit 1
sleep 5
snapshot "06-medicine-saved"
'''
new_save = '''if ! scroll_and_tap "Сохранить" "05-save" 12; then
  adb_quick shell input tap 735 1800 >/dev/null 2>&1 || true
  log_action "Сохранение нажато резервными координатами"
fi
sleep 6
snapshot "06-medicine-saved"
'''
replacements = [
    (old_navigation, new_navigation, 'navigation'),
    (old_continue, new_continue, 'keyboard continue'),
    (old_frequency, new_frequency, 'frequency continue'),
    (old_find_edit, new_find_edit, 'find editable time'),
    (old_times_continue, new_times_continue, 'times continue'),
    (old_sound_continue, new_sound_continue, 'sound continue'),
    (old_save, new_save, 'save'),
]
for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f'QA patch target was not found: {label}')
    text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
PY

chmod +x "$RUNTIME"
exec bash "$RUNTIME" "$@"
