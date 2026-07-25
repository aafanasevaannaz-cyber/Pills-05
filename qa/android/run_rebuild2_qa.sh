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
VOICE_ENV="not-tested"
START_SECONDS=$SECONDS
MAX_SECONDS=1000
LAST_XML=""

rm -rf "$RESULT_ROOT"
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
adb_medium() { timeout 50s adb "$@"; }
adb_long() { timeout 220s adb "$@"; }

snapshot() {
  local name="$1"
  local xml="${XML_DIR}/${name}.xml"
  check_deadline
  sleep 1
  timeout 12s adb exec-out screencap -p > "${SCREEN_DIR}/${name}.png" || true
  rm -f "$xml"
  timeout 12s adb shell uiautomator dump --compressed /sdcard/window.xml >/dev/null 2>&1 || true
  timeout 12s adb pull /sdcard/window.xml "$xml" >/dev/null 2>&1 || true
  if [[ -s "$xml" ]] && grep -F '<hierarchy' "$xml" >/dev/null 2>&1; then
    LAST_XML="$xml"
  else
    LAST_XML=""
    log_action "UI XML не получен: ${name}"
  fi
  log_action "Скриншот и XML: ${name}"
}

coords_for() { timeout 8s python3 qa/android/ui_pick.py "$1" "${@:2}" 2>/dev/null || true; }
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

contains_text() { [[ -s "$1" ]] && grep -F "$2" "$1" >/dev/null 2>&1; }
assert_text() { contains_text "$1" "$2" || fail "$3"; }
assert_not_text() { contains_text "$1" "$2" && fail "$3"; }

scroll_until_visible() {
  local text="$1"
  local prefix="$2"
  local rounds="${3:-10}"
  local round coords
  for ((round=0; round<=rounds; round+=1)); do
    coords="$(coords_from_last "$text" 0)"
    if [[ -n "$coords" ]]; then return 0; fi
    adb_quick shell input swipe 540 1920 540 690 350 >/dev/null 2>&1 || true
    snapshot "${prefix}-scroll-${round}"
  done
  fail "Не найден элемент «${text}» после прокрутки"
  return 1
}

scroll_and_tap() {
  local text="$1"
  local prefix="$2"
  local rounds="${3:-10}"
  scroll_until_visible "$text" "$prefix" "$rounds" || return 1
  tap_from_last "$text"
}

find_and_tap_edit() {
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

replace_number_field() {
  local label="$1"
  local value="$2"
  local prefix="$3"
  snapshot "${prefix}-before"
  find_and_tap_edit "$label" "$prefix" 8 || return 1
  adb_quick shell input keyevent KEYCODE_MOVE_END >/dev/null 2>&1 || true
  adb_quick shell input keyevent KEYCODE_DEL KEYCODE_DEL KEYCODE_DEL >/dev/null 2>&1 || true
  adb_quick shell input text "$value" >/dev/null 2>&1 || true
  sleep 1
  snapshot "${prefix}-typed"
  adb_quick shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
  sleep 1
  snapshot "${prefix}-done"
}

finish_report() {
  adb_quick shell wm size 1080x2400 >/dev/null 2>&1 || true
  adb_quick shell wm density 400 >/dev/null 2>&1 || true
  if [[ ! -s "$SUMMARY" ]]; then
    {
      echo "# По часам 2 — Android QA"
      echo
      echo "- Ошибок сценария: ${FAILURES}"
      echo "- Голосовая среда эмулятора: ${VOICE_ENV}"
      echo "- Сценарий завершился досрочно; смотрите actions.txt, screenshots и logs"
    } > "$SUMMARY"
  fi
}
trap finish_report EXIT

phase "Статические гарантии пересборки"
grep -F 'applicationId "com.chaipodusham.pochasam.rebuild2"' android/app/build.gradle >/dev/null || fail "Неверный новый applicationId"
grep -F '<string name="app_name">По часам 2</string>' android/app/src/main/res/values/strings.xml >/dev/null || fail "Неверное видимое название"
if grep -R -F "Зенон" src android/app/src/main >/dev/null 2>&1; then fail "В приложении остался тестовый «Зенон»"; fi
if grep -F '<datalist' src/components/ui/MedicineNameInput.tsx >/dev/null 2>&1; then fail "Автодополнение использует конфликтующий datalist"; fi
grep -F '.slice(0, 5)' src/components/ui/MedicineNameInput.tsx >/dev/null || fail "Список подсказок не ограничен пятью вариантами"
grep -F 'background: var(--surface) !important' src/styles/rebuild2.css >/dev/null || fail "Список подсказок не закреплён как непрозрачный"
grep -F "draft.dosage.trim() || '1 таблетка'" src/components/screens/AddMedicineScreen.tsx >/dev/null || fail "Нет дозировки по умолчанию"
grep -F '+ Добавить ещё время' src/components/ui/MedicineScheduleEditor.tsx >/dev/null || fail "Нет произвольного количества приёмов"
grep -F 'Приостановить' src/components/screens/MedicinesScreen.tsx >/dev/null || fail "Нет паузы лекарства"
grep -F 'Возобновить' src/components/screens/MedicinesScreen.tsx >/dev/null || fail "Нет возобновления лекарства"
grep -F 'ReminderSequencePlayer' android/app/src/main/java/com/pills/reminder/ReminderVoiceService.java >/dev/null || fail "Сигнал и голос не объединены"
grep -F 'setOnCompletionListener' android/app/src/main/java/com/pills/reminder/ReminderSequencePlayer.java >/dev/null || fail "Голос не привязан к окончанию сигнала"
grep -F 'medicine-reminders-v10-silent' src/features/sound/options.ts >/dev/null || fail "Системный канал может дублировать сигнал"
grep -F "title: 'Дизайн и текст'" src/app/settings/page.tsx >/dev/null || fail "Раздел «Вид» не переименован"
for sound in gentle bell marimba digital classic alarm; do
  grep -F "id: '${sound}'" src/features/sound/options.ts >/dev/null || fail "Нет сигнала ${sound}"
done

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
} > "${RESULT_ROOT}/device-info.txt" 2>&1

[[ -f "$APK_PATH" ]] || APK_PATH="$(find apk -type f -name '*.apk' | head -n 1)"
[[ -n "${APK_PATH:-}" && -f "$APK_PATH" ]] || { fail "APK не найден"; exit 1; }

phase "Установка отдельного пакета"
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

phase "Название и один непрозрачный список"
if ! tap_from_last "Добавить первое лекарство"; then
  tap_from_last "+ Добавить" || { fail "Не удалось открыть добавление"; exit 1; }
fi
snapshot "01-name-empty"
assert_text "${XML_DIR}/01-name-empty.xml" "Как называется лекарство" "Не открыт шаг названия"
coords="$(coords_for "$LAST_XML" --class-name android.widget.EditText --index 0)"
tap_coords "$coords" "поле названия" || { fail "Поле названия недоступно"; exit 1; }
adb_quick shell input text "TestMed" >/dev/null 2>&1 || true
sleep 1
snapshot "01-name-keyboard"
assert_not_text "${XML_DIR}/01-name-keyboard.xml" "Нажмите, чтобы дописать" "Осталась старая огромная карточка автодополнения"
# Нажимаем продолжение до закрытия клавиатуры: после её закрытия WebView Android 12 иногда отдаёт неполное accessibility-дерево.
require_tap "Продолжить" "failure-name" || exit 1
sleep 2
snapshot "02-frequency"

phase "Частота"
require_tap "Каждый день" "failure-frequency" || exit 1
snapshot "02-frequency-selected"
require_tap "Продолжить" "failure-frequency-continue" || exit 1
sleep 2
snapshot "03-time-count"

phase "Три независимо настраиваемых времени"
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

phase "Разные сигналы и выбор голоса"
assert_text "${XML_DIR}/04-sound-top.xml" "Сигнал" "Шаг звука не открылся"
for label in "Мягкая мелодия" "Колокольчик" "Маримба" "Цифровой двойной" "Классический будильник" "Очень заметный"; do
  grep -F "$label" src/features/sound/options.ts >/dev/null || fail "Нет варианта «${label}»"
done
grep -F 'listAndroidVoices' src/components/ui/MedicineSoundEditor.tsx >/dev/null || fail "Нет выбора установленных голосов Android"

phase "Остановка сигнала до запуска голоса"
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

phase "Дозировка по умолчанию"
scroll_and_tap "Продолжить" "04-sound-continue" 12 || exit 1
sleep 2
snapshot "05-dose-default"
assert_text "${XML_DIR}/05-dose-default.xml" "1 таблетка" "Дозировка по умолчанию не установлена"
assert_text "${XML_DIR}/05-dose-default.xml" "можно изменить" "Не объяснено, что дозировку можно изменить"
scroll_and_tap "Сохранить" "05-save" 12 || exit 1
sleep 5
snapshot "06-medicine-saved"
assert_text "${XML_DIR}/06-medicine-saved.xml" "TestMed" "Лекарство не появилось в списке"
assert_text "${XML_DIR}/06-medicine-saved.xml" "1 таблетка" "Дозировка по умолчанию не сохранилась"
assert_text "${XML_DIR}/06-medicine-saved.xml" "10:45" "Первое время не сохранилось"
assert_text "${XML_DIR}/06-medicine-saved.xml" "16:30" "Второе время не сохранилось"
assert_text "${XML_DIR}/06-medicine-saved.xml" "22:15" "Третье время не сохранилось"

phase "Редактирование, пауза и возобновление"
require_tap "Изменить" "failure-edit" || exit 1
sleep 2
snapshot "07-edit-open"
assert_text "${XML_DIR}/07-edit-open.xml" "Изменить лекарство" "Редактирование не открылось"
require_tap "Отмена" "failure-edit-cancel" || exit 1
sleep 2
snapshot "07-back-to-list"
require_tap "Приостановить" "failure-pause" || exit 1
sleep 2
snapshot "08-paused"
assert_text "${XML_DIR}/08-paused.xml" "Приостановлено" "Пауза не отобразилась"
assert_text "${XML_DIR}/08-paused.xml" "Напоминания отключены" "Пауза не отменила напоминания"
require_tap "Возобновить" "failure-resume" || exit 1
sleep 2
snapshot "08-resumed"
assert_text "${XML_DIR}/08-resumed.xml" "Активно" "Возобновление не сработало"

phase "Удаление с отменой будущих событий"
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

grep -F -- '--rebuild-motion: 240ms' src/styles/rebuild2.css >/dev/null || fail "Спокойная длительность анимаций не установлена"

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
  echo "- Проверены единая последовательность сигнал → голос и остановка до запуска голоса"
  echo "- Голосовая среда эмулятора: ${VOICE_ENV}"
  echo "- Сняты скриншоты телефона и планшетного размера"
  echo "- Проверены logcat, crash buffer и ANR"
} > "$SUMMARY"

log_action "Android QA завершён. Ошибок: ${FAILURES}"
exit "$FAILURES"
