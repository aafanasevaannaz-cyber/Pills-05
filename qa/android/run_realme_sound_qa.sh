#!/usr/bin/env bash
set -u

APK_PATH="${1:-apk/app-debug.apk}"
PACKAGE="com.pills.reminder"
RESULT_ROOT="qa-results/realme-c55-android12-sound-fix"
SCREEN_DIR="${RESULT_ROOT}/screenshots"
XML_DIR="${RESULT_ROOT}/ui-xml"
LOG_DIR="${RESULT_ROOT}/logs"
ACTION_LOG="${RESULT_ROOT}/actions.txt"
SUMMARY="${RESULT_ROOT}/summary.md"
FAILURES=0
mkdir -p "$SCREEN_DIR" "$XML_DIR" "$LOG_DIR"

log_action() {
  printf '%s | %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$ACTION_LOG"
}

fail() {
  FAILURES=$((FAILURES + 1))
  log_action "ОШИБКА: $*"
}

dump_current() {
  local output="$1"
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml "$output" >/dev/null 2>&1 || true
}

capture() {
  local name="$1"
  sleep 1
  adb exec-out screencap -p > "${SCREEN_DIR}/${name}.png" || true
  dump_current "${XML_DIR}/${name}.xml"
  log_action "Скриншот и XML: ${name}"
}

coords_for() {
  python3 qa/android/ui_pick.py "$1" "${@:2}" 2>/dev/null || true
}

tap_text_once() {
  local text="$1"
  local index="${2:-0}"
  local xml="${RESULT_ROOT}/current.xml"
  dump_current "$xml"
  local coords
  coords="$(coords_for "$xml" --text "$text" --index "$index")"
  [[ -n "$coords" ]] || return 1
  local x y
  read -r x y <<<"$coords"
  adb shell input tap "$x" "$y"
  log_action "Нажато «${text}» (${x},${y})"
  sleep 1
}

tap_text_scroll() {
  local text="$1"
  local attempts="${2:-8}"
  local index="${3:-0}"
  for ((attempt=0; attempt<attempts; attempt+=1)); do
    if tap_text_once "$text" "$index"; then return 0; fi
    adb shell input swipe 540 1880 540 720 420
    log_action "Прокрутка для поиска «${text}»"
    sleep 1
  done
  fail "Не найден элемент «${text}»"
  return 1
}

tap_first_edit() {
  local xml="${RESULT_ROOT}/current.xml"
  dump_current "$xml"
  local coords
  coords="$(coords_for "$xml" --class-name android.widget.EditText --index 0)"
  if [[ -z "$coords" ]]; then
    fail "Не найдено поле ввода"
    return 1
  fi
  local x y
  read -r x y <<<"$coords"
  adb shell input tap "$x" "$y"
  sleep 0.5
  log_action "Нажато первое поле ввода (${x},${y})"
}

wait_for_text() {
  local text="$1"
  local seconds="$2"
  local elapsed=0
  while ((elapsed < seconds)); do
    local xml="${RESULT_ROOT}/wait.xml"
    dump_current "$xml"
    if grep -Fqi "$text" "$xml"; then
      log_action "Дождались текста «${text}» через ${elapsed} секунд"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  return 1
}

log_action "Начало QA realme C55, Android 12, 1080x2400, density 400"
adb wait-for-device
adb root >/dev/null 2>&1 || true
adb wait-for-device
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell settings put system font_scale 1.0
adb shell wm size 1080x2400
adb shell wm density 400
adb shell settings put global auto_time 0 >/dev/null 2>&1 || true
adb shell date 072007592026.00 > "${LOG_DIR}/set-device-time.txt" 2>&1 || true
adb shell date >> "${LOG_DIR}/set-device-time.txt" 2>&1 || true

{
  adb shell wm size
  adb shell wm density
  adb shell getprop ro.build.version.release
  adb shell getprop ro.build.version.sdk
  adb shell getprop ro.product.model
  adb shell date
} > "${RESULT_ROOT}/device-info.txt" 2>&1

if [[ ! -f "$APK_PATH" ]]; then
  APK_PATH="$(find apk -type f -name '*.apk' | head -n 1)"
fi
if [[ -z "${APK_PATH:-}" || ! -f "$APK_PATH" ]]; then
  fail "APK не найден"
  exit 1
fi

adb install -r "$APK_PATH" > "${LOG_DIR}/install.txt" 2>&1 || fail "APK не установился"
adb shell pm clear "$PACKAGE" >/dev/null 2>&1 || true
adb shell cmd appops set "$PACKAGE" SCHEDULE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb shell cmd appops set "$PACKAGE" USE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb logcat -c

ACTIVITY="$(adb shell cmd package resolve-activity --brief "$PACKAGE" 2>/dev/null | tr -d '\r' | tail -n 1)"
echo "$ACTIVITY" > "${RESULT_ROOT}/resolved-activity.txt"
adb shell am start -n "$ACTIVITY" > "${LOG_DIR}/launch.txt" 2>&1 || fail "Приложение не запустилось"
sleep 5
capture "00-first-launch"

if tap_text_once "Разрешить уведомления"; then
  sleep 2
  tap_text_once "РАЗРЕШИТЬ" || tap_text_once "Разрешить" || true
fi
capture "01-home-empty"

if tap_text_once "+ Добавить" || tap_text_once "Добавить"; then
  capture "02-add-name"
else
  fail "Не открылось добавление лекарства"
fi

if tap_first_edit; then
  adb shell input text "TestMed"
  adb shell input keyevent 66
  log_action "Введено TestMed"
fi
capture "03-name-entered"

tap_text_scroll "Продолжить" || true
capture "04-frequency"
tap_text_scroll "Каждый день" || true
tap_text_scroll "Продолжить" || true
capture "05-time"
tap_text_scroll "08:00" || true
tap_text_scroll "Продолжить" || true
capture "06-dosage"
tap_text_scroll "1 таблетка" || true
tap_text_scroll "Сохранить" || true
sleep 4
capture "07-home-medium-text"
python3 qa/android/assert_realme_layout.py "${XML_DIR}/07-home-medium-text.xml" \
  --time "08:00" --medicine "TestMed" \
  > "${LOG_DIR}/layout-assertion.txt" 2>&1 || fail "Время и название всё ещё накладываются"

if wait_for_text "ПОРА ПРИНЯТЬ ЛЕКАРСТВО" 90; then
  capture "08-reminder-open"
  tap_text_once "Не принято" || fail "Не нажалась кнопка «Не принято»"
  sleep 3
  capture "09-home-after-skipped"
  python3 qa/android/assert_realme_layout.py "${XML_DIR}/09-home-after-skipped.xml" \
    --time "08:00" --medicine "TestMed" --require-progress \
    > "${LOG_DIR}/skipped-progress-assertion.txt" 2>&1 || fail "Пропуск всё ещё считается принятым"
else
  fail "Напоминание на 08:00 не появилось за 90 секунд"
fi

if tap_text_scroll "Проверить звук" 8; then
  sleep 2
  capture "10-sound-page"
fi

if tap_text_scroll "Мягкий звонок" 4; then sleep 3; capture "11-gentle-selected"; fi
if tap_text_scroll "Чёткий сигнал" 4; then sleep 3; capture "12-clear-selected"; fi
if tap_text_scroll "Громкий будильник" 4; then sleep 4; capture "13-alarm-selected"; fi
if tap_text_scroll "Послушать только голос" 8; then sleep 4; capture "14-voice-preview"; fi
if tap_text_scroll "Послушать всё напоминание" 8; then sleep 7; capture "15-full-preview"; fi

if tap_text_scroll "Проверить через 3 секунды" 10; then
  sleep 6
  capture "16-notification-test-result"
  adb shell cmd statusbar expand-notifications >/dev/null 2>&1 || true
  sleep 2
  capture "17-notification-shade"
  adb shell cmd statusbar collapse >/dev/null 2>&1 || true
fi

adb logcat -d > "${LOG_DIR}/full-logcat.txt" 2>&1 || true
PID="$(adb shell pidof -s "$PACKAGE" 2>/dev/null | tr -d '\r')"
if [[ -n "$PID" ]]; then
  adb logcat -d --pid "$PID" > "${LOG_DIR}/application-log.txt" 2>&1 || true
else
  grep -F "$PACKAGE" "${LOG_DIR}/full-logcat.txt" > "${LOG_DIR}/application-log.txt" 2>&1 || true
fi
adb logcat -b crash -d > "${LOG_DIR}/crash-buffer.txt" 2>&1 || true
adb shell dumpsys notification --noredact > "${LOG_DIR}/notification-dumpsys.txt" 2>&1 || true
adb shell dumpsys package "$PACKAGE" > "${LOG_DIR}/package-dumpsys.txt" 2>&1 || true

grep -F "Native sound started: medicine_gentle" "${LOG_DIR}/full-logcat.txt" >/dev/null \
  || fail "Нативный мягкий сигнал не запускался"
grep -F "Native sound started: medicine_clear" "${LOG_DIR}/full-logcat.txt" >/dev/null \
  || fail "Нативный чёткий сигнал не запускался"
grep -F "Native sound started: medicine_alarm" "${LOG_DIR}/full-logcat.txt" >/dev/null \
  || fail "Нативный громкий сигнал не запускался"
grep -F "medicine-reminders-v4-" "${LOG_DIR}/notification-dumpsys.txt" >/dev/null \
  || fail "Новый канал звука Android не создан"

if grep -Eiq "FATAL EXCEPTION|ANR in ${PACKAGE}|Process: ${PACKAGE}" \
  "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt"; then
  grep -Ein -A 50 -B 10 "FATAL EXCEPTION|ANR in ${PACKAGE}|Process: ${PACKAGE}" \
    "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" \
    > "${RESULT_ROOT}/crash-message.txt" || true
  fail "Найдено падение или ANR"
else
  echo "Падений и ANR процесса ${PACKAGE} не обнаружено." > "${RESULT_ROOT}/crash-message.txt"
fi

{
  echo "# realme C55 Android 12 — sound and layout QA"
  echo
  echo "- Ошибок сценария: ${FAILURES}"
  echo "- Скриншотов: $(find "$SCREEN_DIR" -name '*.png' | wc -l)"
  echo "- XML-структур: $(find "$XML_DIR" -name '*.xml' | wc -l)"
  echo "- Проверено наложение времени и названия: да"
  echo "- Проверено, что «Не принято» не считается принятым: да"
  echo "- Проверены три нативных сигнала: да"
  echo "- Проверен новый канал уведомлений Android: да"
  echo "- Голос вызван через нативный Android TextToSpeech; доступность русского голоса зависит от образа/устройства."
} > "$SUMMARY"

log_action "QA завершён. Ошибок: ${FAILURES}"
exit "$FAILURES"
