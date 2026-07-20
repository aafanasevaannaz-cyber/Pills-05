#!/usr/bin/env bash
set -u

PROFILE_NAME="${1:?profile name required}"
WIDTH="${2:?width required}"
HEIGHT="${3:?height required}"
DENSITY="${4:?density required}"
IS_TABLET="${5:-false}"
APK_PATH="${6:-apk/app-debug.apk}"
PACKAGE="com.pills.reminder"
RESULT_ROOT="qa-results/${PROFILE_NAME}"
SCREEN_DIR="${RESULT_ROOT}/screenshots"
XML_DIR="${RESULT_ROOT}/ui-xml"
LOG_DIR="${RESULT_ROOT}/logs"
mkdir -p "${SCREEN_DIR}" "${XML_DIR}" "${LOG_DIR}"

ACTION_LOG="${RESULT_ROOT}/actions.txt"
SUMMARY="${RESULT_ROOT}/summary.md"
FAILURES=0
STEP=0

log_action() {
  printf '%s | %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "${ACTION_LOG}"
}

record_failure() {
  FAILURES=$((FAILURES + 1))
  log_action "ОШИБКА: $*"
}

dump_ui() {
  local name="$1"
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml "${XML_DIR}/${name}.xml" >/dev/null 2>&1 || true
}

capture() {
  local name="$1"
  sleep 1
  adb exec-out screencap -p > "${SCREEN_DIR}/${name}.png" || true
  dump_ui "${name}"
  log_action "Снимок и XML: ${name}"
}

coords_for() {
  local xml="$1"
  shift
  python3 qa/android/ui_pick.py "$xml" "$@" 2>/dev/null || true
}

tap_text_once() {
  local text="$1"
  local index="${2:-0}"
  local tmp="${RESULT_ROOT}/current.xml"
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml "$tmp" >/dev/null 2>&1 || true
  local coords
  coords="$(coords_for "$tmp" --text "$text" --index "$index")"
  if [[ -z "$coords" ]]; then
    return 1
  fi
  local x y
  read -r x y <<<"$coords"
  adb shell input tap "$x" "$y"
  log_action "Нажато: ${text} (${x},${y})"
  sleep 1
  return 0
}

tap_text_scroll() {
  local text="$1"
  local attempts="${2:-7}"
  local i
  for ((i=0; i<attempts; i++)); do
    if tap_text_once "$text" 0; then
      return 0
    fi
    adb shell input swipe $((WIDTH / 2)) $((HEIGHT * 4 / 5)) $((WIDTH / 2)) $((HEIGHT / 3)) 450
    log_action "Прокрутка для поиска: ${text}"
    sleep 1
  done
  record_failure "Не найден элемент с текстом «${text}»"
  return 1
}

tap_first_edit_text() {
  local tmp="${RESULT_ROOT}/current.xml"
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml "$tmp" >/dev/null 2>&1 || true
  local coords
  coords="$(coords_for "$tmp" --class-name android.widget.EditText --index 0)"
  if [[ -z "$coords" ]]; then
    record_failure "Не найдено поле ввода"
    return 1
  fi
  local x y
  read -r x y <<<"$coords"
  adb shell input tap "$x" "$y"
  log_action "Нажато первое поле ввода (${x},${y})"
  sleep 0.5
  return 0
}

set_screen() {
  local width="$1"
  local height="$2"
  adb shell wm size "${width}x${height}" >/dev/null
  adb shell wm density "${DENSITY}" >/dev/null
  sleep 2
  log_action "Размер экрана: ${width}x${height}, плотность: ${DENSITY}"
}

log_action "Начало теста профиля ${PROFILE_NAME}"
adb wait-for-device
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell settings put system font_scale 1.0
set_screen "$WIDTH" "$HEIGHT"

{
  echo "profile=${PROFILE_NAME}"
  echo "requested_size=${WIDTH}x${HEIGHT}"
  echo "requested_density=${DENSITY}"
  echo "tablet=${IS_TABLET}"
  adb shell wm size
  adb shell wm density
  adb shell getprop ro.build.version.release
  adb shell getprop ro.build.version.sdk
  adb shell getprop ro.product.model
  adb shell getprop ro.product.manufacturer
} > "${RESULT_ROOT}/device-info.txt" 2>&1

if [[ ! -f "$APK_PATH" ]]; then
  APK_PATH="$(find apk -type f -name '*.apk' | head -n 1)"
fi
if [[ -z "${APK_PATH:-}" || ! -f "$APK_PATH" ]]; then
  record_failure "APK не найден"
  exit 1
fi

adb install -r "$APK_PATH" > "${LOG_DIR}/install.txt" 2>&1 || record_failure "APK не установился"
adb shell pm grant "$PACKAGE" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb shell cmd appops set "$PACKAGE" SCHEDULE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb shell cmd appops set "$PACKAGE" USE_EXACT_ALARM allow >/dev/null 2>&1 || true
adb logcat -c

ACTIVITY="$(adb shell cmd package resolve-activity --brief "$PACKAGE" 2>/dev/null | tr -d '\r' | tail -n 1)"
echo "$ACTIVITY" > "${RESULT_ROOT}/resolved-activity.txt"
if [[ -z "$ACTIVITY" || "$ACTIVITY" == "No activity found" ]]; then
  record_failure "Главная Activity не найдена"
else
  adb shell am force-stop "$PACKAGE"
  adb shell am start -n "$ACTIVITY" > "${LOG_DIR}/launch.txt" 2>&1 || record_failure "Приложение не запустилось"
fi
sleep 4
capture "00-first-launch"

if tap_text_once "Разрешить уведомления" 0; then
  sleep 2
else
  log_action "Экран разрешения не показан или разрешение уже принято"
fi
capture "01-home-empty"

if tap_text_once "+ Добавить" 0 || tap_text_once "Добавить" 0; then
  capture "02-add-name"
else
  record_failure "Не удалось открыть добавление лекарства"
fi

if tap_first_edit_text; then
  adb shell input text "TestMed"
  adb shell input keyevent 66
  log_action "Введено название лекарства: TestMed"
  capture "03-name-entered"
fi

if tap_text_scroll "Продолжить"; then capture "04-frequency"; fi
if tap_text_scroll "Каждый день"; then log_action "Выбрана частота: каждый день"; fi
if tap_text_scroll "Продолжить"; then capture "05-time"; fi
if tap_text_scroll "08:00"; then log_action "Выбрано время 08:00"; fi
if tap_text_scroll "Продолжить"; then capture "06-dosage"; fi
if tap_text_scroll "1 таблетка"; then log_action "Выбрана дозировка: 1 таблетка"; fi
if tap_text_scroll "Сохранить"; then
  sleep 3
  capture "07-home-with-medicine"
fi

if tap_text_scroll "Настройки"; then
  sleep 2
  capture "08-settings-light"
fi
if tap_text_scroll "Тёмная"; then
  sleep 1
  capture "09-settings-dark"
fi
if tap_text_scroll "Очень большой"; then
  sleep 1
  capture "10-settings-extra-large"
fi

if tap_text_scroll "Проверить звук и уведомление" 10; then
  sleep 5
  capture "11-notification-test-result"
  adb shell cmd statusbar expand-notifications >/dev/null 2>&1 || true
  sleep 2
  capture "12-notification-shade"
  adb shell cmd statusbar collapse >/dev/null 2>&1 || true
fi

if [[ "$IS_TABLET" == "true" ]]; then
  set_screen "$HEIGHT" "$WIDTH"
  adb shell settings put system accelerometer_rotation 0 >/dev/null 2>&1 || true
  adb shell settings put system user_rotation 1 >/dev/null 2>&1 || true
  sleep 3
  capture "13-tablet-landscape-settings"
  if tap_text_scroll "Сегодня" 4; then
    sleep 2
    capture "14-tablet-landscape-home"
  fi
  adb shell settings put system user_rotation 0 >/dev/null 2>&1 || true
fi

PID="$(adb shell pidof -s "$PACKAGE" 2>/dev/null | tr -d '\r')"
echo "${PID}" > "${RESULT_ROOT}/pid.txt"
if [[ -n "$PID" ]]; then
  adb logcat -d --pid "$PID" > "${LOG_DIR}/application-log.txt" 2>&1 || true
else
  adb logcat -d | grep -F "$PACKAGE" > "${LOG_DIR}/application-log.txt" 2>&1 || true
fi
adb logcat -d > "${LOG_DIR}/full-logcat.txt" 2>&1 || true
adb logcat -b crash -d > "${LOG_DIR}/crash-buffer.txt" 2>&1 || true
adb shell dumpsys activity top > "${LOG_DIR}/activity-top.txt" 2>&1 || true
adb shell dumpsys package "$PACKAGE" > "${LOG_DIR}/package-dumpsys.txt" 2>&1 || true
adb shell dumpsys notification > "${LOG_DIR}/notification-dumpsys.txt" 2>&1 || true

if grep -Eiq "FATAL EXCEPTION|ANR in ${PACKAGE}|Process: ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt"; then
  {
    echo "Обнаружено возможное падение или ANR."
    grep -Ein -A 40 -B 10 "FATAL EXCEPTION|ANR in ${PACKAGE}|Process: ${PACKAGE}" \
      "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" | head -n 300
  } > "${RESULT_ROOT}/crash-message.txt"
  record_failure "В логах найдено падение или ANR"
else
  echo "Падений и ANR процесса ${PACKAGE} в ходе сценария не обнаружено." > "${RESULT_ROOT}/crash-message.txt"
fi

{
  echo "# QA: ${PROFILE_NAME}"
  echo
  echo "- Экран: ${WIDTH}x${HEIGHT}, density ${DENSITY}"
  echo "- Планшетный профиль: ${IS_TABLET}"
  echo "- Критических ошибок сценария: ${FAILURES}"
  echo "- Скриншоты: $(find "${SCREEN_DIR}" -name '*.png' | wc -l)"
  echo "- XML-дампы: $(find "${XML_DIR}" -name '*.xml' | wc -l)"
  echo
  echo "Полная последовательность находится в actions.txt."
} > "$SUMMARY"

log_action "Тест завершён. Ошибок сценария: ${FAILURES}"
exit "$FAILURES"
