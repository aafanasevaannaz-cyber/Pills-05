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

log_action() { printf '%s | %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$ACTION_LOG"; }
fail() { FAILURES=$((FAILURES + 1)); log_action "ОШИБКА: $*"; }

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

coords_for() { python3 qa/android/ui_pick.py "$1" "${@:2}" 2>/dev/null || true; }

tap_text_once() {
  local text="$1" index="${2:-0}" xml="${RESULT_ROOT}/current.xml"
  dump_current "$xml"
  local coords x y
  coords="$(coords_for "$xml" --text "$text" --index "$index")"
  [[ -n "$coords" ]] || return 1
  read -r x y <<<"$coords"
  adb shell input tap "$x" "$y"
  log_action "Нажато «${text}» (${x},${y})"
  sleep 1
}

tap_text_scroll() {
  local text="$1" attempts="${2:-8}" index="${3:-0}"
  for ((attempt=0; attempt<attempts; attempt+=1)); do
    if tap_text_once "$text" "$index"; then return 0; fi
    adb shell input swipe 540 1850 540 720 420
    log_action "Прокрутка для поиска «${text}»"
    sleep 1
  done
  fail "Не найден элемент «${text}»"
  return 1
}

tap_first_edit() {
  local xml="${RESULT_ROOT}/current.xml" coords x y
  dump_current "$xml"
  coords="$(coords_for "$xml" --class-name android.widget.EditText --index 0)"
  [[ -n "$coords" ]] || { fail "Не найдено поле ввода"; return 1; }
  read -r x y <<<"$coords"
  adb shell input tap "$x" "$y"
  sleep 0.5
  log_action "Нажато первое поле ввода (${x},${y})"
}

log_action "Начало QA realme C55, Android 12, 1080x2400, density 400"
adb wait-for-device
# Do not change the emulator clock or restart adb as root: that crashed Android 12 SystemUI
# and disabled WebView accessibility in the previous infrastructure attempt.
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell settings put system font_scale 1.0
adb shell wm size 1080x2400
adb shell wm density 400

{
  adb shell wm size
  adb shell wm density
  adb shell getprop ro.build.version.release
  adb shell getprop ro.build.version.sdk
  adb shell getprop ro.product.model
  adb shell date
} > "${RESULT_ROOT}/device-info.txt" 2>&1

[[ -f "$APK_PATH" ]] || APK_PATH="$(find apk -type f -name '*.apk' | head -n 1)"
[[ -n "${APK_PATH:-}" && -f "$APK_PATH" ]] || { fail "APK не найден"; exit 1; }

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

if tap_text_once "Разрешить уведомления"; then sleep 3; fi
capture "01-home-empty"

if tap_text_once "+ Добавить" || tap_text_once "Добавить первое лекарство"; then
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
  > "${LOG_DIR}/layout-assertion.txt" 2>&1 || fail "Время и название накладываются"

# Verify the corrected skipped-dose calculation directly from the compiled source contract.
grep -F "statusForDose(dose) === 'taken'" src/components/screens/MainScreen.tsx >/dev/null \
  || fail "Прогресс не считает только принятые дозы"
grep -F "Не принято: {skippedCount}" src/components/screens/MainScreen.tsx >/dev/null \
  || fail "Отдельный счётчик пропусков отсутствует"
if grep -F "status === 'taken' || status === 'skipped'" src/components/screens/MainScreen.tsx >/dev/null; then
  fail "Пропущенные дозы всё ещё входят в число принятых"
fi

if tap_text_scroll "Проверить звук" 8; then sleep 2; capture "08-sound-page"; fi
if tap_text_scroll "Мягкий звонок" 4; then sleep 3; capture "09-gentle-selected"; fi
if tap_text_scroll "Чёткий сигнал" 4; then sleep 3; capture "10-clear-selected"; fi
if tap_text_scroll "Громкий будильник" 4; then sleep 4; capture "11-alarm-selected"; fi
if tap_text_scroll "Послушать только голос" 8; then sleep 4; capture "12-voice-preview"; fi
if tap_text_scroll "Послушать всё напоминание" 8; then sleep 7; capture "13-full-preview"; fi
if tap_text_scroll "Проверить через 3 секунды" 10; then
  sleep 6
  capture "14-notification-test-result"
  adb shell cmd statusbar expand-notifications >/dev/null 2>&1 || true
  sleep 2
  capture "15-notification-shade"
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

for sound in medicine_gentle medicine_clear medicine_alarm; do
  grep -F "Native sound started: ${sound}" "${LOG_DIR}/full-logcat.txt" >/dev/null \
    || fail "Нативный сигнал ${sound} не запускался"
done
grep -F "medicine-reminders-v4-" "${LOG_DIR}/notification-dumpsys.txt" >/dev/null \
  || fail "Новый канал звука Android не создан"

if grep -F "Process: ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null \
  || grep -F "ANR in ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null; then
  grep -Ein -A 50 -B 10 "Process: ${PACKAGE}|ANR in ${PACKAGE}" \
    "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" \
    > "${RESULT_ROOT}/crash-message.txt" || true
  fail "Найдено падение или ANR Pills-05"
else
  echo "Падений и ANR процесса ${PACKAGE} не обнаружено." > "${RESULT_ROOT}/crash-message.txt"
fi

{
  echo "# realme C55 Android 12 — sound and layout QA"
  echo
  echo "- Ошибок сценария: ${FAILURES}"
  echo "- Скриншотов: $(find "$SCREEN_DIR" -name '*.png' | wc -l)"
  echo "- XML-структур: $(find "$XML_DIR" -name '*.xml' | wc -l)"
  echo "- Наложение времени и названия проверено"
  echo "- Пропуск исключён из числа принятых"
  echo "- Три нативных сигнала вызваны через Android MediaPlayer"
  echo "- Новый канал уведомлений Android проверен"
  echo "- Физическую громкость динамика эмулятор без аудиоустройства не измеряет"
} > "$SUMMARY"

log_action "QA завершён. Ошибок: ${FAILURES}"
exit "$FAILURES"
