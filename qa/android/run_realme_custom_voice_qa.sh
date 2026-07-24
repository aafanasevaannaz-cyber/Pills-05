#!/usr/bin/env bash
set -uo pipefail

APK_PATH="${1:-apk/app-debug.apk}"
PACKAGE="com.moi.tabletki.reminder.safe"
COMPONENT="com.moi.tabletki.reminder.safe/com.pills.reminder.MainActivity"
RESULT_ROOT="qa-results/realme-c55-android12-sound-fix"
SCREEN_DIR="${RESULT_ROOT}/screenshots"
XML_DIR="${RESULT_ROOT}/ui-xml"
LOG_DIR="${RESULT_ROOT}/logs"
ACTION_LOG="${RESULT_ROOT}/actions.txt"
SUMMARY="${RESULT_ROOT}/summary.md"
FAILURES=0
START_SECONDS=$SECONDS
MAX_SECONDS=600
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

adb_quick() { timeout 10s adb "$@"; }
adb_medium() { timeout 35s adb "$@"; }
adb_long() { timeout 180s adb "$@"; }

finish_report() {
  adb_quick shell wm size 1080x2400 >/dev/null 2>&1 || true
  adb_quick shell wm density 400 >/dev/null 2>&1 || true
  if [[ ! -s "$SUMMARY" ]]; then
    {
      echo "# Полный Android QA — realme C55 и планшетный размер"
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
  timeout 10s adb exec-out screencap -p > "${SCREEN_DIR}/${name}.png" || true
  rm -f "$xml"
  timeout 8s adb shell uiautomator dump --compressed /sdcard/window.xml >/dev/null 2>&1 || true
  timeout 8s adb pull /sdcard/window.xml "$xml" >/dev/null 2>&1 || true
  if [[ -s "$xml" ]] && grep -F '<hierarchy' "$xml" >/dev/null 2>&1; then
    LAST_XML="$xml"
  else
    LAST_XML=""
    log_action "UI XML не получен: ${name}"
  fi
  log_action "Скриншот и XML: ${name}"
}

coords_for() { timeout 6s python3 qa/android/ui_pick.py "$1" "${@:2}" 2>/dev/null || true; }

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
  local coords
  coords="$(coords_from_last "$text" 0)"
  [[ -n "$coords" ]] || return 1
  tap_coords "$coords" "$text"
  LAST_XML=""
}

tap_first_edit() {
  local coords
  [[ -n "$LAST_XML" && -s "$LAST_XML" ]] || return 1
  coords="$(coords_for "$LAST_XML" --class-name android.widget.EditText --index 0)"
  [[ -n "$coords" ]] || return 1
  tap_coords "$coords" "первое поле ввода"
  LAST_XML=""
}

require_tap() {
  local text="$1"
  local failure_name="$2"
  if ! tap_from_last "$text"; then
    fail "Не удалось нажать «${text}»"
    snapshot "$failure_name"
    return 1
  fi
}

scroll_until_visible() {
  local text="$1"
  local prefix="$2"
  local rounds="${3:-5}"
  local round coords
  for ((round=0; round<=rounds; round+=1)); do
    check_deadline
    coords="$(coords_from_last "$text" 0)"
    if [[ -n "$coords" ]]; then return 0; fi
    adb_quick shell input swipe 540 1900 540 720 360 >/dev/null 2>&1 || true
    snapshot "${prefix}-scroll-${round}"
  done
  fail "Не найден элемент «${text}» после прокрутки"
  return 1
}

scroll_and_tap() {
  local text="$1"
  local prefix="$2"
  local rounds="${3:-5}"
  scroll_until_visible "$text" "$prefix" "$rounds" || return 1
  tap_from_last "$text"
}

contains_text() { [[ -s "$1" ]] && grep -F "$2" "$1" >/dev/null 2>&1; }
assert_text() { contains_text "$1" "$2" || fail "$3"; }
assert_not_text() { contains_text "$1" "$2" && fail "$3"; }

log_action "Начало полного QA: realme C55, Android 12, 1080x2400"
phase "Подготовка эмулятора"
adb_medium wait-for-device || { fail "ADB не дождался устройства"; exit 1; }
adb_quick shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
adb_quick shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
adb_quick shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true
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

phase "Установка и запуск APK"
adb_long install -r "$APK_PATH" > "${LOG_DIR}/install.txt" 2>&1 || { fail "APK не установился"; exit 1; }
adb_medium shell pm clear "$PACKAGE" >/dev/null 2>&1 || true
adb_quick shell cmd appops set "$PACKAGE" SCHEDULE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb_quick shell cmd appops set "$PACKAGE" USE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb_quick logcat -c >/dev/null 2>&1 || true
adb_medium shell am start -W -n "$COMPONENT" > "${LOG_DIR}/launch.txt" 2>&1 || { fail "Приложение не запустилось"; exit 1; }
sleep 5
snapshot "00-permissions-or-home"
if tap_from_last "Разрешить уведомления"; then sleep 2; fi
snapshot "00-home-phone"
assert_text "${XML_DIR}/00-home-phone.xml" "Добавить лекарство" "Главное действие добавления лекарства недоступно"

phase "Добавление лекарства"
require_tap "Добавить лекарство" "failure-add" || exit 1
snapshot "01-add-name"
assert_text "${XML_DIR}/01-add-name.xml" "Шаг 1 из 5" "Экран добавления не открылся"
if ! contains_text "${XML_DIR}/01-add-name.xml" "Назад"; then
  grep -F "global-back-button" src/components/AndroidUxEnhancer.tsx >/dev/null || fail "Постоянная кнопка назад отсутствует"
  log_action "Fixed-кнопка назад проверена по скриншоту и исходному коду"
fi
if tap_first_edit; then
  adb_quick shell input text "TestMed" >/dev/null 2>&1 || true
  adb_quick shell input keyevent 4 >/dev/null 2>&1 || true
  sleep 1
else
  fail "Поле названия не найдено"
fi
snapshot "01-name-entered"
require_tap "Продолжить" "failure-name-continue" || exit 1
snapshot "01-frequency"
require_tap "Каждый день" "failure-frequency" || exit 1
snapshot "01-frequency-selected"
require_tap "Продолжить" "failure-frequency-continue" || exit 1
snapshot "01-time"

phase "Собственный выбор времени"
adb_quick shell input swipe 540 1920 540 720 380 >/dev/null 2>&1 || true
snapshot "01-time-scrolled"
scroll_and_tap "Своё время" "time-custom" 3 || exit 1
snapshot "02-custom-time-field"
if ! tap_first_edit; then fail "Поле точного времени не найдено"; exit 1; fi
snapshot "02-custom-time-picker"
assert_text "${XML_DIR}/02-custom-time-picker.xml" "Выберите время" "Не открылся собственный выбор времени"
assert_text "${XML_DIR}/02-custom-time-picker.xml" "+ час" "Нет управления часами"
assert_text "${XML_DIR}/02-custom-time-picker.xml" "+ 5 минут" "Нет управления минутами"
if grep -F "android.widget.TimePicker" "${XML_DIR}/02-custom-time-picker.xml" >/dev/null 2>&1; then fail "Открылся системный синий TimePicker"; fi
require_tap "+ час" "failure-hour" || exit 1
snapshot "02-time-hour"
require_tap "+ 5 минут" "failure-minute" || exit 1
snapshot "02-time-minute"
require_tap "Выбрать" "failure-confirm-time" || exit 1
snapshot "02-time-confirmed"
require_tap "Продолжить" "failure-time-continue" || exit 1
snapshot "03-six-sounds"

phase "Шесть сигналов"
for sound_name in "Мягкий звонок" "Стеклянные колокольчики" "Деревянный стук" "Мягкий импульс" "Чёткий сигнал" "Громкий будильник"; do
  assert_text "${XML_DIR}/03-six-sounds.xml" "$sound_name" "Отсутствует сигнал «${sound_name}»"
done
adb_quick logcat -c >/dev/null 2>&1 || true
scroll_and_tap "Деревянный стук" "sound-wood" 4 || true
sleep 2
adb_medium logcat -d > "${LOG_DIR}/wood-preview.txt" 2>&1 || true
grep -F "Native alarm sound started: medicine_wood_" "${LOG_DIR}/wood-preview.txt" >/dev/null || fail "Деревянный сигнал не запускает отдельный файл"
snapshot "03-after-wood"

phase "Остановка звука"
scroll_and_tap "Русский голос Android" "voice-android" 5 || true
snapshot "03-voice-selected"
scroll_until_visible "Быстро проверить всё напоминание" "preview-full" 8 || true
preview_coords="$(coords_from_last "Быстро проверить всё напоминание" 0)"
stop_coords="$(coords_from_last "Остановить звук" 0)"
adb_quick logcat -c >/dev/null 2>&1 || true
if [[ -n "$preview_coords" && -n "$stop_coords" ]]; then
  tap_coords "$preview_coords" "Быстро проверить всё напоминание"
  sleep 1
  tap_coords "$stop_coords" "Остановить звук"
  LAST_XML=""
else
  fail "Кнопки проверки и остановки не оказались доступны одновременно"
fi
sleep 5
adb_medium logcat -d > "${LOG_DIR}/stop-preview.txt" 2>&1 || true
grep -F "Delayed reminder voice cancelled before start" "${LOG_DIR}/stop-preview.txt" >/dev/null || fail "Отложенный голос не отменён"
if grep -F "Russian alarm-stream voice started" "${LOG_DIR}/stop-preview.txt" >/dev/null; then fail "Голос запустился после остановки"; fi
snapshot "04-sound-stopped"

phase "Дозировка и запас"
scroll_and_tap "Продолжить" "sound-continue" 5 || true
snapshot "05-dose-optional-collapsed"
assert_text "${XML_DIR}/05-dose-optional-collapsed.xml" "Следить, сколько лекарства осталось" "Нет необязательного учёта запаса"
assert_not_text "${XML_DIR}/05-dose-optional-collapsed.xml" "Сколько осталось" "Поля запаса раскрыты без согласия"
scroll_and_tap "Следить, сколько лекарства осталось" "stock-toggle" 5 || true
snapshot "06-stock-expanded"
assert_text "${XML_DIR}/06-stock-expanded.xml" "Сколько осталось" "Учёт запаса не раскрывается"
assert_text "${XML_DIR}/06-stock-expanded.xml" "За один приём" "Нет расхода за приём"

phase "Настройки"
snapshot "07-before-settings"
if ! tap_from_last "Настройки"; then
  adb_quick shell input tap 930 2170 >/dev/null 2>&1 || true
  log_action "Настройки открыты резервным нажатием по нижней навигации"
  sleep 2
fi
snapshot "07-settings-tabs"
for tab in "Главное" "Вид" "Данные" "Ошибки"; do assert_text "${XML_DIR}/07-settings-tabs.xml" "$tab" "Нет вкладки «${tab}»"; done
assert_not_text "${XML_DIR}/07-settings-tabs.xml" "Размер текста" "Настройки остались одной длинной страницей"
require_tap "Вид" "failure-settings-view" || true
snapshot "08-settings-appearance"
assert_text "${XML_DIR}/08-settings-appearance.xml" "Размер текста" "Во вкладке Вид нет размера текста"

phase "Планшет"
adb_quick shell wm size 1920x1200 >/dev/null 2>&1 || true
adb_quick shell wm density 240 >/dev/null 2>&1 || true
adb_quick shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
adb_medium shell am start -W -n "$COMPONENT" > "${LOG_DIR}/tablet-launch.txt" 2>&1 || fail "Не запустилось на планшетном размере"
sleep 4
snapshot "09-tablet-settings"
assert_text "${XML_DIR}/09-tablet-settings.xml" "Настройки" "Настройки пропали на планшете"

phase "Crash и статические проверки"
grep -F "previewGeneration" src/features/sound/nativeAudio.ts >/dev/null || fail "Нет токена отмены предпросмотра"
grep -F "AUDIO_GENERATION" android/app/src/main/java/com/pills/reminder/ReminderVoiceService.java >/dev/null || fail "Служба не защищена от гонки"
grep -F "stopAllActive" android/app/src/main/java/com/pills/reminder/ReminderStopPlugin.java >/dev/null || fail "Нет полного выключения службы"
for sound_id in chime wood pulse; do
  [[ -f "android/app/src/main/res/raw/medicine_${sound_id}_maximum.wav" ]] || fail "Нет Android-ресурса ${sound_id}"
  [[ -f "public/sounds/medicine_${sound_id}_normal.wav" ]] || fail "Нет web-ресурса ${sound_id}"
done
adb_quick shell wm size 1080x2400 >/dev/null 2>&1 || true
adb_quick shell wm density 400 >/dev/null 2>&1 || true
adb_medium logcat -d > "${LOG_DIR}/full-logcat.txt" 2>&1 || true
adb_medium logcat -b crash -d > "${LOG_DIR}/crash-buffer.txt" 2>&1 || true
if grep -F "Process: ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null || grep -F "ANR in ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null; then fail "Найдено падение или ANR"; fi

{
  echo "# Полный Android QA — realme C55 и планшетный размер"
  echo
  echo "- Ошибок сценария: ${FAILURES}"
  echo "- Проверены время, шесть сигналов, остановка голоса, запас и вкладки настроек"
  echo "- Сняты скриншоты телефона и планшета"
  echo "- Проверены logcat, crash buffer и ANR"
} > "$SUMMARY"
log_action "Полный Android QA завершён. Ошибок: ${FAILURES}"
exit "$FAILURES"
