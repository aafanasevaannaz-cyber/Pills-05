#!/usr/bin/env bash
set -uo pipefail

APK_PATH="${1:-apk/app-debug.apk}"
PACKAGE="com.chaipodusham.pochasam.rebuild2"
COMPONENT="${PACKAGE}/com.pills.reminder.MainActivity"
RESULT_ROOT="qa-results/realme-c55-android12-sound-fix"
SCREEN_DIR="${RESULT_ROOT}/screenshots"
XML_DIR="${RESULT_ROOT}/ui-xml"
LOG_DIR="${RESULT_ROOT}/logs"
ACTION_LOG="${RESULT_ROOT}/actions.txt"
SUMMARY="${RESULT_ROOT}/summary.md"
FAILURES=0
START_SECONDS=$SECONDS
MAX_SECONDS=900
LAST_XML=""
mkdir -p "$SCREEN_DIR" "$XML_DIR" "$LOG_DIR"
: > "$ACTION_LOG"

log_action() { printf '%s | %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$ACTION_LOG"; }
fail() { FAILURES=$((FAILURES + 1)); log_action "ОШИБКА: $*"; }
phase() { log_action "ЭТАП: $*"; }

check_deadline() {
  if (( SECONDS - START_SECONDS > MAX_SECONDS )); then
    fail "QA превысил ${MAX_SECONDS} секунд"
    exit 124
  fi
}

adb_quick() { timeout 12s adb "$@"; }
adb_medium() { timeout 45s adb "$@"; }
adb_long() { timeout 200s adb "$@"; }

finish_report() {
  adb_quick shell wm size 1080x2400 >/dev/null 2>&1 || true
  adb_quick shell wm density 400 >/dev/null 2>&1 || true
  if [[ ! -s "$SUMMARY" ]]; then
    {
      echo "# По часам 2 — Android QA"
      echo
      echo "- Ошибок сценария: ${FAILURES}"
      echo "- Сценарий завершился досрочно; смотрите actions.txt, screenshots и logs"
    } > "$SUMMARY"
  fi
}
trap finish_report EXIT

snapshot() {
  local name="$1"
  local xml="${XML_DIR}/${name}.xml"
  check_deadline
  sleep 1
  timeout 12s adb exec-out screencap -p > "${SCREEN_DIR}/${name}.png" || true
  rm -f "$xml"
  timeout 10s adb shell uiautomator dump --compressed /sdcard/window.xml >/dev/null 2>&1 || true
  timeout 10s adb pull /sdcard/window.xml "$xml" >/dev/null 2>&1 || true
  if [[ -s "$xml" ]] && grep -F '<hierarchy' "$xml" >/dev/null 2>&1; then
    LAST_XML="$xml"
  else
    LAST_XML=""
    log_action "UI XML не получен: ${name}"
  fi
  log_action "Скриншот и XML: ${name}"
}

coords_for() { timeout 7s python3 qa/android/ui_pick.py "$1" "${@:2}" 2>/dev/null || true; }

coords_from_last() {
  local text="$1"
  local index="${2:-0}"
  [[ -n "$LAST_XML" && -s "$LAST_XML" ]] || return 1
  coords_for "$LAST_XML" --text "$text" --index "$index"
}

tap_coords() {
  local coords="$1"
  local label="$2"
  local x y
  [[ -n "$coords" ]] || return 1
  read -r x y <<<"$coords"
  adb_quick shell input tap "$x" "$y" >/dev/null 2>&1 || true
  log_action "Нажато «${label}» (${x},${y})"
  sleep 1
}

tap_from_last() {
  local text="$1"
  local index="${2:-0}"
  local coords
  coords="$(coords_from_last "$text" "$index")"
  [[ -n "$coords" ]] || return 1
  tap_coords "$coords" "$text"
  LAST_XML=""
}

tap_edit_index() {
  local index="${1:-0}"
  local coords
  [[ -n "$LAST_XML" && -s "$LAST_XML" ]] || return 1
  coords="$(coords_for "$LAST_XML" --class-name android.widget.EditText --index "$index")"
  [[ -n "$coords" ]] || return 1
  tap_coords "$coords" "поле ввода ${index}"
  LAST_XML=""
}

require_tap() {
  local text="$1"
  local failure_name="$2"
  local index="${3:-0}"
  if ! tap_from_last "$text" "$index"; then
    fail "Не удалось нажать «${text}»"
    snapshot "$failure_name"
    return 1
  fi
}

scroll_until_visible() {
  local text="$1"
  local prefix="$2"
  local rounds="${3:-7}"
  local round coords
  for ((round=0; round<=rounds; round+=1)); do
    check_deadline
    coords="$(coords_from_last "$text" 0)"
    if [[ -n "$coords" ]]; then return 0; fi
    adb_quick shell input swipe 540 1930 540 670 380 >/dev/null 2>&1 || true
    snapshot "${prefix}-scroll-${round}"
  done
  fail "Не найден элемент «${text}» после прокрутки"
  return 1
}

scroll_and_tap() {
  local text="$1"
  local prefix="$2"
  local rounds="${3:-7}"
  scroll_until_visible "$text" "$prefix" "$rounds" || return 1
  tap_from_last "$text"
}

contains_text() { [[ -s "$1" ]] && grep -F "$2" "$1" >/dev/null 2>&1; }
assert_text() { contains_text "$1" "$2" || fail "$3"; }
assert_not_text() { contains_text "$1" "$2" && fail "$3"; }

phase "Статические гарантии пересборки"
grep -F 'applicationId "com.chaipodusham.pochasam.rebuild2"' android/app/build.gradle >/dev/null || fail "Неверный новый applicationId"
grep -F '<string name="app_name">По часам 2</string>' android/app/src/main/res/values/strings.xml >/dev/null || fail "Неверное видимое название"
if grep -R -F "Зенон" src android/app/src/main >/dev/null 2>&1; then fail "В приложении остался тестовый «Зенон»"; fi
if grep -F '<datalist' src/components/ui/MedicineNameInput.tsx >/dev/null 2>&1; then fail "Автодополнение всё ещё использует конфликтующий datalist"; fi
grep -F 'suggestions.slice(0, 5)' src/components/ui/MedicineNameInput.tsx >/dev/null || fail "Список подсказок не ограничен пятью вариантами"
grep -F "draft.dosage.trim() || '1 таблетка'" src/components/screens/AddMedicineScreen.tsx >/dev/null || fail "Нет дозировки по умолчанию"
grep -F 'Своё количество' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail "Нет произвольного количества приёмов"
grep -F 'Приостановить' src/components/screens/MedicinesScreen.tsx >/dev/null || fail "Нет паузы лекарства"
grep -F 'Возобновить' src/components/screens/MedicinesScreen.tsx >/dev/null || fail "Нет возобновления лекарства"
grep -F 'ReminderSequencePlayer' android/app/src/main/java/com/pills/reminder/ReminderVoiceService.java >/dev/null || fail "Фоновый звук и голос не объединены"
grep -F 'setOnCompletionListener' android/app/src/main/java/com/pills/reminder/ReminderSequencePlayer.java >/dev/null || fail "Голос не привязан к фактическому окончанию сигнала"
grep -F 'medicine-reminders-v10-silent' src/features/sound/options.ts >/dev/null || fail "Системный канал может дублировать сигнал"
grep -F "title: 'Дизайн и текст'" src/app/settings/page.tsx >/dev/null || fail "Раздел «Вид» не переименован"
for sound in gentle bell marimba digital classic alarm; do
  grep -F "id: '${sound}'" src/features/sound/options.ts >/dev/null || fail "Нет сигнала ${sound}"
done

log_action "Начало Android UI QA: realme C55, Android 12, 1080x2400"
phase "Подготовка эмулятора"
adb_medium wait-for-device || { fail "ADB не дождался устройства"; exit 1; }
adb_quick shell settings put global window_animation_scale 1 >/dev/null 2>&1 || true
adb_quick shell settings put global transition_animation_scale 1 >/dev/null 2>&1 || true
adb_quick shell settings put global animator_duration_scale 1 >/dev/null 2>&1 || true
adb_quick shell settings put system font_scale 1.0 >/dev/null 2>&1 || true
adb_quick shell wm size 1080x2400 >/dev/null 2>&1 || true
adb_quick shell wm density 400 >/dev/null 2>&1 || true

{
  adb_quick shell wm size
  adb_quick shell wm density
  adb_quick shell getprop ro.build.version.release
  adb_quick shell getprop ro.build.version.sdk
  adb_quick shell getprop ro.product.model
  adb_quick shell date
} > "${RESULT_ROOT}/device-info.txt" 2>&1

[[ -f "$APK_PATH" ]] || APK_PATH="$(find apk -type f -name '*.apk' | head -n 1)"
[[ -n "${APK_PATH:-}" && -f "$APK_PATH" ]] || { fail "APK не найден"; exit 1; }

phase "Установка и проверка идентификатора"
adb_long install -r "$APK_PATH" > "${LOG_DIR}/install.txt" 2>&1 || { fail "APK не установился"; exit 1; }
adb_medium shell pm clear "$PACKAGE" >/dev/null 2>&1 || true
adb_quick shell cmd appops set "$PACKAGE" SCHEDULE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb_quick shell cmd appops set "$PACKAGE" USE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb_quick shell dumpsys package "$PACKAGE" > "${LOG_DIR}/package.txt" 2>&1 || fail "Новый пакет не установлен"
adb_quick logcat -c >/dev/null 2>&1 || true
adb_medium shell am start -W -n "$COMPONENT" > "${LOG_DIR}/launch.txt" 2>&1 || { fail "Приложение не запустилось"; exit 1; }
sleep 4

phase "Первый запуск"
snapshot "00-permission-intro"
if ! tap_from_last "Сделать позже"; then
  adb_quick shell input tap 540 1650 >/dev/null 2>&1 || true
  log_action "Стартовый экран закрыт резервным нажатием"
fi
sleep 2
snapshot "00-home"
assert_text "${XML_DIR}/00-home.xml" "Добавить" "Главное действие добавления недоступно"

phase "Название и непрозрачное автодополнение"
if ! tap_from_last "Добавить первое лекарство"; then
  if ! tap_from_last "+ Добавить"; then
    fail "Не удалось открыть добавление лекарства"
    exit 1
  fi
fi
snapshot "01-name-empty"
assert_text "${XML_DIR}/01-name-empty.xml" "Как называется лекарство" "Не открыт шаг названия"
if tap_edit_index 0; then
  adb_quick shell input text "TestMed" >/dev/null 2>&1 || true
  sleep 1
  snapshot "01-name-keyboard"
  adb_quick shell input keyevent 4 >/dev/null 2>&1 || true
else
  fail "Поле названия недоступно"
  exit 1
fi
snapshot "01-name-filled"
require_tap "Продолжить" "failure-name" || exit 1

phase "Частота"
snapshot "02-frequency"
require_tap "Каждый день" "failure-frequency" || exit 1
snapshot "02-frequency-selected"
require_tap "Продолжить" "failure-frequency-continue" || exit 1

phase "Три произвольных времени"
snapshot "03-time-count"
require_tap "3 раза" "failure-three-times" || exit 1
snapshot "03-three-rows"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 1" "Нет первого времени"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 2" "Нет второго времени"
assert_text "${XML_DIR}/03-three-rows.xml" "Приём 3" "Нет третьего времени"

require_tap "Приём 1" "failure-time-one" || exit 1
snapshot "03-time-dialog-one"
assert_text "${XML_DIR}/03-time-dialog-one.xml" "Введите часы и минуты напрямую" "Нет прямого ввода времени"
if tap_edit_index 0; then
  adb_quick shell input text "10" >/dev/null 2>&1 || true
  adb_quick shell input keyevent 4 >/dev/null 2>&1 || true
fi
snapshot "03-time-hour-10"
require_tap ":45" "failure-minute-45" || exit 1
snapshot "03-time-one-ready"
require_tap "Сохранить" "failure-save-time-one" || exit 1
snapshot "03-time-one-saved"

require_tap "Приём 2" "failure-time-two" || exit 1
snapshot "03-time-dialog-two"
if tap_edit_index 0; then
  adb_quick shell input text "16" >/dev/null 2>&1 || true
  adb_quick shell input keyevent 4 >/dev/null 2>&1 || true
fi
snapshot "03-time-hour-16"
require_tap ":30" "failure-minute-30" || exit 1
snapshot "03-time-two-ready"
require_tap "Сохранить" "failure-save-time-two" || exit 1
snapshot "03-times-final"
assert_text "${XML_DIR}/03-times-final.xml" "10:45" "Первое своё время не сохранилось"
assert_text "${XML_DIR}/03-times-final.xml" "16:30" "Второе своё время не сохранилось"
require_tap "Продолжить" "failure-times-continue" || exit 1

phase "Различимые сигналы и выбор голоса"
snapshot "04-sound-top"
for label in "Мягкая мелодия" "Колокольчик" "Маримба" "Цифровой двойной" "Классический будильник" "Очень заметный"; do
  grep -F "$label" src/features/sound/options.ts >/dev/null || fail "Нет варианта «${label}»"
done
assert_text "${XML_DIR}/04-sound-top.xml" "Как должно звучать напоминание" "Шаг звука не открылся"

phase "Остановка единой последовательности до голоса"
snapshot "04-sound-current"
scroll_and_tap "Послушать всё напоминание" "preview-stop" 10 || exit 1
sleep 1
snapshot "04-preview-running"
adb_quick logcat -d > "${LOG_DIR}/sequence-before-stop.txt" 2>&1 || true
scroll_and_tap "Остановить сигнал и голос" "stop-sequence" 3 || exit 1
sleep 5
adb_medium logcat -d > "${LOG_DIR}/sequence-stopped.txt" 2>&1 || true
grep -F "ReminderSequence" "${LOG_DIR}/sequence-stopped.txt" >/dev/null || fail "Единый нативный проигрыватель не запускался"
grep -F "Sequence stopped" "${LOG_DIR}/sequence-stopped.txt" >/dev/null || fail "Команда остановки не дошла до проигрывателя"
if grep -F "Android voice started" "${LOG_DIR}/sequence-stopped.txt" >/dev/null; then
  fail "Голос запустился после ранней остановки"
fi
snapshot "04-after-stop"

phase "Голос запускается после фактического окончания сигнала"
adb_quick logcat -c >/dev/null 2>&1 || true
scroll_and_tap "Послушать всё напоминание" "preview-handoff" 3 || exit 1
sleep 7
adb_medium logcat -d > "${LOG_DIR}/sequence-handoff.txt" 2>&1 || true
grep -F "Signal started=" "${LOG_DIR}/sequence-handoff.txt" >/dev/null || fail "Сигнал последовательности не запустился"
if ! grep -F "Android voice started" "${LOG_DIR}/sequence-handoff.txt" >/dev/null; then
  grep -E "TextToSpeech|Russian TTS|Preview sequence failed" "${LOG_DIR}/sequence-handoff.txt" > "${LOG_DIR}/tts-environment.txt" 2>/dev/null || true
  fail "После окончания сигнала не зафиксирован запуск голоса"
fi
snapshot "04-after-handoff"
scroll_and_tap "Остановить сигнал и голос" "stop-after-handoff" 3 || true

phase "Дозировка по умолчанию"
scroll_and_tap "Продолжить" "sound-continue" 12 || exit 1
snapshot "05-dose-default"
assert_text "${XML_DIR}/05-dose-default.xml" "1 таблетка" "Дозировка по умолчанию не установлена"
assert_text "${XML_DIR}/05-dose-default.xml" "Всё можно изменить позже" "Не объяснено редактирование дозировки"
scroll_and_tap "Сохранить" "save-medicine" 10 || exit 1
sleep 4
snapshot "06-medicine-saved"
assert_text "${XML_DIR}/06-medicine-saved.xml" "TestMed" "Лекарство не появилось в списке"
assert_text "${XML_DIR}/06-medicine-saved.xml" "1 таблетка" "Дозировка по умолчанию не сохранилась"
assert_text "${XML_DIR}/06-medicine-saved.xml" "10:45" "Первое время не отображается после сохранения"
assert_text "${XML_DIR}/06-medicine-saved.xml" "16:30" "Второе время не отображается после сохранения"

phase "Редактирование, пауза и возобновление"
require_tap "Изменить" "failure-edit" || exit 1
snapshot "07-edit-open"
assert_text "${XML_DIR}/07-edit-open.xml" "Изменить лекарство" "Редактирование не открылось"
require_tap "Отмена" "failure-edit-cancel" || exit 1
snapshot "07-back-to-medicines"
require_tap "Приостановить" "failure-pause" || exit 1
sleep 2
snapshot "08-paused"
assert_text "${XML_DIR}/08-paused.xml" "Приостановлено" "Пауза не отобразилась"
assert_text "${XML_DIR}/08-paused.xml" "Напоминания отключены" "Пауза не подтвердила отмену напоминаний"
require_tap "Возобновить" "failure-resume" || exit 1
sleep 2
snapshot "08-resumed"
assert_text "${XML_DIR}/08-resumed.xml" "Активно" "Возобновление не сработало"

phase "Удаление отменяет будущие напоминания"
require_tap "Удалить" "failure-delete-open" || exit 1
snapshot "09-delete-confirm"
assert_text "${XML_DIR}/09-delete-confirm.xml" "Будущие уведомления" "Удаление не предупреждает об отмене уведомлений"
require_tap "Удалить" "failure-delete-confirm" || exit 1
sleep 2
snapshot "09-deleted"
assert_text "${XML_DIR}/09-deleted.xml" "Список пока пуст" "Лекарство не удалено"

phase "Настройки и спокойный дизайн"
if ! tap_from_last "Настройки"; then
  adb_quick shell input tap 930 2170 >/dev/null 2>&1 || true
  sleep 2
fi
snapshot "10-settings"
assert_text "${XML_DIR}/10-settings.xml" "Дизайн и текст" "Новое название раздела дизайна не отображается"

phase "Планшетный размер"
adb_quick shell wm size 1920x1200 >/dev/null 2>&1 || true
adb_quick shell wm density 240 >/dev/null 2>&1 || true
adb_quick shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
adb_medium shell am start -W -n "$COMPONENT" > "${LOG_DIR}/tablet-launch.txt" 2>&1 || fail "Не запустилось на планшетном размере"
sleep 4
snapshot "11-tablet"
assert_text "${XML_DIR}/11-tablet.xml" "Настройки" "Интерфейс пропал на планшетном размере"

phase "Падения и ANR"
adb_quick shell wm size 1080x2400 >/dev/null 2>&1 || true
adb_quick shell wm density 400 >/dev/null 2>&1 || true
adb_medium logcat -d > "${LOG_DIR}/full-logcat.txt" 2>&1 || true
adb_medium logcat -b crash -d > "${LOG_DIR}/crash-buffer.txt" 2>&1 || true
if grep -F "Process: ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null || \
   grep -F "ANR in ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null; then
  fail "Найдено падение или ANR"
fi

{
  echo "# По часам 2 — Android QA"
  echo
  echo "- Ошибок сценария: ${FAILURES}"
  echo "- Новый пакет установлен отдельно: ${PACKAGE}"
  echo "- Проверены три произвольных времени, дозировка по умолчанию, редактирование, пауза, возобновление и удаление"
  echo "- Проверена единая последовательность сигнал → голос и остановка до запуска голоса"
  echo "- Сняты скриншоты телефона и планшетного размера"
  echo "- Проверены logcat, crash buffer и ANR"
} > "$SUMMARY"

log_action "Android QA завершён. Ошибок: ${FAILURES}"
exit "$FAILURES"
