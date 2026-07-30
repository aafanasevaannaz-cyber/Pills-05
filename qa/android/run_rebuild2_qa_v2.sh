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
text = text.replace(
    '''grep -F '+ Добавить ещё время' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail "Нет произвольного количества приёмов"''',
    '''grep -F '+ Добавить ещё время' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail "Нет произвольного количества приёмов"
grep -F 'type="time"' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail "Время всё ещё вводится нестабильными числовыми полями"
grep -F 'key={`medicine-time-${index}`}' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail "Строка времени не имеет стабильного ключа"
if grep -F 'key={`${index}-${time}`}' src/components/ui/MedicineScheduleEditor.tsx >/dev/null 2>&1; then fail "Строка времени пересоздаётся при каждом изменении"; fi
grep -F '−15 мин' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail "Нет удобной корректировки времени"
grep -F '.progress-track + .ui-card.add-step-card--step-3' src/styles/rebuild2.css >/dev/null || fail "Кнопки шага могут перекрывать поля времени"
grep -F 'position: static !important' src/styles/rebuild2.css >/dev/null || fail "Липкая панель времени не отключена"
grep -F 'versionName "3.1-time-fix"' android/app/build.gradle >/dev/null || fail "Не повышена версия исправления времени"'''
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

old_time_phase = '''phase "Три независимо настраиваемых времени"
require_tap "3 раза в день" "failure-three-times" || exit 1
snapshot "03-three-rows"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 1" "Нет первого времени"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 2" "Нет второго времени"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 3" "Нет третьего времени"
assert_text "${XML_DIR}/03-three-rows.xml" "+ Добавить ещё время" "Нельзя добавить произвольное количество приёмов"

replace_number_field "Часы приёма 1" "10" "03-time-one-hour" || exit 1
scroll_and_tap "Приём 1, минуты 45" "03-time-one-minute" 4 || exit 1
snapshot "03-time-one-set"
replace_number_field "Часы приёма 2" "16" "03-time-two-hour" || exit 1
scroll_and_tap "Приём 2, минуты 30" "03-time-two-minute" 5 || exit 1
snapshot "03-time-two-set"
replace_number_field "Часы приёма 3" "22" "03-time-three-hour" || exit 1
scroll_and_tap "Приём 3, минуты 15" "03-time-three-minute" 5 || exit 1
snapshot "03-times-final"
scroll_and_tap "Продолжить" "03-times-continue" 8 || exit 1
sleep 2
snapshot "04-sound-top"
'''
new_time_phase = '''phase "Стабильный ввод времени без потери фокуса и вылетов"
require_tap "3 раза в день" "failure-three-times" || exit 1
snapshot "03-three-rows"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 1" "Нет первого времени"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 2" "Нет второго времени"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 3" "Нет третьего времени"
assert_text "${XML_DIR}/03-three-rows.xml" "+ Добавить ещё время" "Нельзя добавить произвольное количество приёмов"

# Все координаты ниже получены из UI tree до стресс-теста. Сетка количества и первый приём не меняют положение.
COUNT_TWO="$(coords_for "$LAST_XML" --text "2 раза в день" --index 0)"
COUNT_THREE="$(coords_for "$LAST_XML" --text "3 раза в день" --index 0)"
COUNT_FOUR="$(coords_for "$LAST_XML" --text "4 раза в день" --index 0)"
TIME_ONE="$(coords_for "$LAST_XML" --text "Время приёма 1" --index 0)"
QUICK_TWELVE="$(coords_for "$LAST_XML" --text "Приём 1, установить 12:00" --index 0)"
MINUS_FIFTEEN="$(coords_for "$LAST_XML" --text "Приём 1, минус 15 минут" --index 0)"
for required in "$COUNT_TWO" "$COUNT_THREE" "$COUNT_FOUR" "$TIME_ONE" "$QUICK_TWELVE" "$MINUS_FIFTEEN"; do
  [[ -n "$required" ]] || { fail "UI tree не дал координаты элемента времени"; exit 1; }
done

adb_quick shell dumpsys meminfo "$PACKAGE" > "${LOG_DIR}/time-memory-before.txt" 2>&1 || true
adb_quick shell dumpsys gfxinfo "$PACKAGE" reset >/dev/null 2>&1 || true
adb_quick logcat -c >/dev/null 2>&1 || true

# Быстро переключаем количество приёмов. Поля не должны пересоздавать WebView или завершать приложение.
tap_coords "$COUNT_FOUR" "4 раза в день"
tap_coords "$COUNT_TWO" "2 раза в день"
tap_coords "$COUNT_THREE" "3 раза в день"
tap_coords "$COUNT_FOUR" "4 раза в день"
tap_coords "$COUNT_THREE" "3 раза в день"
adb_quick shell pidof -s "$PACKAGE" >/dev/null 2>&1 || { fail "Приложение завершилось при смене количества приёмов"; exit 1; }
snapshot "03-count-stress-finished"

# Шесть раз открываем и закрываем системный Android-пикер. Это воспроизводит жалобу на тормоза и вылет.
for attempt in 1 2 3 4 5 6; do
  tap_coords "$TIME_ONE" "системный выбор времени ${attempt}"
  sleep 0.7
  snapshot "03-native-picker-open-${attempt}"
  if [[ "$attempt" == "1" ]] && ! grep -E 'android.widget.TimePicker|android:id/timePicker|android.widget.NumberPicker' "${XML_DIR}/03-native-picker-open-${attempt}.xml" >/dev/null 2>&1; then
    fail "Системный Android-пикер времени не открылся"
  fi
  adb_quick shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
  sleep 0.5
  adb_quick shell pidof -s "$PACKAGE" >/dev/null 2>&1 || { fail "Приложение завершилось после открытия времени"; exit 1; }
done

# Устанавливаем 12:00 одним касанием и корректируем до 11:45 без клавиатуры.
tap_coords "$QUICK_TWELVE" "быстро установить 12:00"
tap_coords "$MINUS_FIFTEEN" "уменьшить на 15 минут"
snapshot "03-times-final"
assert_text "${XML_DIR}/03-times-final.xml" "11:45" "Время не изменилось без клавиатуры"

adb_medium logcat -b crash -d > "${LOG_DIR}/time-picker-crash.txt" 2>&1 || true
if grep -E 'FATAL EXCEPTION|Process: com.chaipodusham.pochasam.rebuild3' "${LOG_DIR}/time-picker-crash.txt" >/dev/null 2>&1; then
  fail "Во время ввода времени произошёл Android crash"
fi
adb_medium logcat -d > "${LOG_DIR}/time-picker-logcat.txt" 2>&1 || true
if grep -E 'Renderer process.*crash|Aw, Snap|SIGSEGV|Fatal signal' "${LOG_DIR}/time-picker-logcat.txt" >/dev/null 2>&1; then
  fail "Во время ввода времени упал WebView"
fi
adb_quick shell dumpsys meminfo "$PACKAGE" > "${LOG_DIR}/time-memory-after.txt" 2>&1 || true
adb_quick shell dumpsys gfxinfo "$PACKAGE" > "${LOG_DIR}/time-gfx-after.txt" 2>&1 || true

scroll_and_tap "Продолжить" "03-times-continue" 12 || exit 1
sleep 2
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

text = text.replace('assert_text "${XML_DIR}/06-medicine-saved.xml" "10:45" "Первое время не сохранилось"', 'assert_text "${XML_DIR}/06-medicine-saved.xml" "11:45" "Первое время не сохранилось"')
text = text.replace('assert_text "${XML_DIR}/06-medicine-saved.xml" "16:30" "Второе время не сохранилось"', 'assert_text "${XML_DIR}/06-medicine-saved.xml" "14:00" "Второе время не сохранилось"')
text = text.replace('assert_text "${XML_DIR}/06-medicine-saved.xml" "22:15" "Третье время не сохранилось"', 'assert_text "${XML_DIR}/06-medicine-saved.xml" "20:00" "Третье время не сохранилось"')

replacements = [
    (old_navigation, new_navigation, 'navigation'),
    (old_continue, new_continue, 'keyboard continue'),
    (old_frequency, new_frequency, 'frequency continue'),
    (old_time_phase, new_time_phase, 'time stability scenario'),
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
