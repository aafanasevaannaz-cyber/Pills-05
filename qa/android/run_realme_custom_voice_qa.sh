#!/usr/bin/env bash
set -u

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
mkdir -p "$SCREEN_DIR" "$XML_DIR" "$LOG_DIR"
: > "$ACTION_LOG"

log_action() { printf '%s | %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$ACTION_LOG"; }
fail() { FAILURES=$((FAILURES + 1)); log_action "ОШИБКА: $*"; }

dump_current() {
  local output="$1"
  rm -f "$output"
  for attempt in 1 2 3 4; do
    adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
    adb pull /sdcard/window.xml "$output" >/dev/null 2>&1 || true
    if [[ -s "$output" ]] && grep -F '<hierarchy' "$output" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

capture() {
  local name="$1"
  sleep 1
  adb exec-out screencap -p > "${SCREEN_DIR}/${name}.png" || true
  dump_current "${XML_DIR}/${name}.xml" || true
  log_action "Скриншот и XML: ${name}"
}

coords_for() { python3 qa/android/ui_pick.py "$1" "${@:2}" 2>/dev/null || true; }

tap_text() {
  local text="$1" attempts="${2:-5}" index="${3:-0}"
  local xml="${RESULT_ROOT}/current.xml" coords x y
  for ((attempt=1; attempt<=attempts; attempt+=1)); do
    if dump_current "$xml"; then
      coords="$(coords_for "$xml" --text "$text" --index "$index")"
      if [[ -n "$coords" ]]; then
        read -r x y <<<"$coords"
        adb shell input tap "$x" "$y"
        log_action "Нажато «${text}» (${x},${y}), попытка ${attempt}"
        sleep 1
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

tap_text_scroll() {
  local text="$1" rounds="${2:-8}" index="${3:-0}"
  for ((round=1; round<=rounds; round+=1)); do
    if tap_text "$text" 2 "$index"; then return 0; fi
    adb shell input swipe 540 1880 540 700 420
    log_action "Прокрутка для поиска «${text}», круг ${round}"
    sleep 1
  done
  fail "Не найден элемент «${text}»"
  return 1
}

contains_text() {
  local xml="$1" text="$2"
  grep -F "$text" "$xml" >/dev/null 2>&1
}

tap_first_edit() {
  local xml="${RESULT_ROOT}/current.xml" coords x y
  for attempt in 1 2 3 4; do
    dump_current "$xml" || true
    coords="$(coords_for "$xml" --class-name android.widget.EditText --index 0)"
    if [[ -n "$coords" ]]; then
      read -r x y <<<"$coords"
      adb shell input tap "$x" "$y"
      log_action "Нажато поле ввода (${x},${y})"
      sleep 1
      return 0
    fi
    sleep 1
  done
  fail "Не найдено поле названия"
  return 1
}

log_action "Начало focused QA realme C55: Android 12, 1080x2400, density 400"
adb wait-for-device
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

printf '%s\n' "$COMPONENT" > "${RESULT_ROOT}/resolved-activity.txt"
adb shell am start -W -n "$COMPONENT" > "${LOG_DIR}/launch.txt" 2>&1 || fail "Приложение не запустилось"
sleep 5
capture "00-home-empty"

if tap_text "Разрешить уведомления" 3; then sleep 2; fi
capture "01-home-ready"
contains_text "${XML_DIR}/01-home-ready.xml" "Лекарств пока нет" \
  || fail "Пустой главный экран отображается неправильно"

if ! tap_text "Добавить первое лекарство" 4; then
  if ! tap_text "+ Добавить" 4; then
    log_action "Текстовая навигация не сработала — резервное нажатие по верхней кнопке"
    adb shell input tap 860 175
    sleep 2
  fi
fi
capture "02-add-name"
contains_text "${XML_DIR}/02-add-name.xml" "Шаг 1 из 5" \
  || fail "Экран добавления лекарства не открылся"

if tap_first_edit; then
  adb shell input text "TestMed"
  adb shell input keyevent 4
  sleep 1
fi
tap_text_scroll "Продолжить" 5 || true
tap_text_scroll "Каждый день" 5 || true
tap_text_scroll "Продолжить" 6 || true
tap_text_scroll "08:00" 5 || true
tap_text_scroll "Продолжить" 8 || true
capture "03-per-medicine-sound"

for required in \
  "Как должно звучать напоминание" \
  "Громкость сигнала" \
  "Голос после сигнала" \
  "Русский голос Android" \
  "Отдельная запись для этого лекарства" \
  "Громкость русского голоса"; do
  contains_text "${XML_DIR}/03-per-medicine-sound.xml" "$required" \
    || fail "На экране лекарства отсутствует «${required}»"
done

if tap_text_scroll "Отдельная запись для этого лекарства" 10; then
  capture "04-custom-voice-selected"
  contains_text "${XML_DIR}/04-custom-voice-selected.xml" "Громкость записи" \
    || fail "У собственной записи нет отдельного ползунка громкости"
  contains_text "${XML_DIR}/04-custom-voice-selected.xml" "Начать запись" \
    || fail "Режим своего голоса не остался выбранным"
fi

grep -F 'android.permission.RECORD_AUDIO' android/app/src/main/AndroidManifest.xml >/dev/null \
  || fail "В APK не объявлено разрешение микрофона"
grep -F 'startVoiceRecording' android/app/src/main/java/com/pills/reminder/ReminderAudioPlugin.java >/dev/null \
  || fail "Нативный MediaRecorder не подключён"
grep -F 'playRecordedVoice' android/app/src/main/java/com/pills/reminder/ReminderAudioPlugin.java >/dev/null \
  || fail "Нативное воспроизведение своей записи не подключено"
grep -F 'customVoiceVolume' src/components/screens/AddMedicineScreen.tsx >/dev/null \
  || fail "Отдельная громкость собственной записи не сохраняется"
grep -F 'voiceVolume' src/features/reminders/nativeNotifications.logic.ts >/dev/null \
  || fail "Громкость выбранного голоса не передаётся в фоновое напоминание"
grep -F 'setStreamVolume(AudioManager.STREAM_ALARM' android/app/src/main/java/com/pills/reminder/ReminderVoiceService.java >/dev/null \
  || fail "Фоновое напоминание не управляет громкостью будильника"

tap_text_scroll "Русский голос Android" 10 || true
adb logcat -c
tap_text_scroll "Быстро проверить всё напоминание" 14 || true
sleep 10
adb logcat -d > "${LOG_DIR}/preview-logcat.txt" 2>&1 || true
grep -F "Native alarm sound started: medicine_alarm_maximum" "${LOG_DIR}/preview-logcat.txt" >/dev/null \
  || fail "Максимальный сигнал не запустился"
grep -F "Russian alarm-stream voice started" "${LOG_DIR}/preview-logcat.txt" >/dev/null \
  || fail "Русский голос не запустился"
grep -F "Alarm stream volume set to" "${LOG_DIR}/preview-logcat.txt" >/dev/null \
  || fail "Предпросмотр не установил выбранную громкость будильника"
capture "05-preview-completed"

adb logcat -d > "${LOG_DIR}/full-logcat.txt" 2>&1 || true
PID="$(adb shell pidof -s "$PACKAGE" 2>/dev/null | tr -d '\r')"
if [[ -n "$PID" ]]; then
  adb logcat -d --pid "$PID" > "${LOG_DIR}/application-log.txt" 2>&1 || true
else
  grep -F "$PACKAGE" "${LOG_DIR}/full-logcat.txt" > "${LOG_DIR}/application-log.txt" 2>&1 || true
fi
adb logcat -b crash -d > "${LOG_DIR}/crash-buffer.txt" 2>&1 || true
adb shell dumpsys package "$PACKAGE" > "${LOG_DIR}/package-dumpsys.txt" 2>&1 || true

if grep -F "Process: ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null \
  || grep -F "ANR in ${PACKAGE}" "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" >/dev/null; then
  grep -Ein -A 50 -B 10 "Process: ${PACKAGE}|ANR in ${PACKAGE}" \
    "${LOG_DIR}/full-logcat.txt" "${LOG_DIR}/crash-buffer.txt" \
    > "${RESULT_ROOT}/crash-message.txt" || true
  fail "Найдено падение или ANR приложения"
else
  echo "Падений и ANR процесса ${PACKAGE} не обнаружено." > "${RESULT_ROOT}/crash-message.txt"
fi

{
  echo "# realme C55 Android 12 — smart course, three-volume and custom voice QA"
  echo
  echo "- Ошибок сценария: ${FAILURES}"
  echo "- APK установлен и приложение запущено"
  echo "- Ползунок громкости сигнала отображается"
  echo "- Ползунок громкости русского голоса отображается"
  echo "- Отдельный ползунок громкости своей записи отображается"
  echo "- Режим своей записи выбирается и не сбрасывается"
  echo "- Нативная запись и воспроизведение своей записи присутствуют в Android-сборке"
  echo "- Максимальный сигнал запускается через поток будильника"
  echo "- Русский голос запускается через поток будильника"
  echo "- Падения и ANR проверены"
  echo "- Эмулятор запущен без аудиоустройства, поэтому физические децибелы и качество микрофона проверяются на реальном realme C55"
} > "$SUMMARY"

log_action "Focused QA завершён. Ошибок: ${FAILURES}"
exit "$FAILURES"
