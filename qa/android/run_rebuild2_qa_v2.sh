#!/usr/bin/env bash
set -euo pipefail

SOURCE="qa/android/run_rebuild2_qa.sh"
RUNTIME="/tmp/run_rebuild2_qa_runtime.sh"
cp "$SOURCE" "$RUNTIME"

python3 - "$RUNTIME" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
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
# Кнопка действия не должна прятаться за клавиатурой. Основной путь — синяя клавиша «Далее».
adb_quick shell input keyevent KEYCODE_ENTER >/dev/null 2>&1 || true
log_action "Нажата клавиша «Далее» на клавиатуре"
sleep 3
snapshot "02-frequency"
if ! contains_text "${XML_DIR}/02-frequency.xml" "Как часто принимать"; then
  fail "Клавиатура не перевела на шаг частоты"
  exit 1
fi
'''
if old_navigation not in text:
    raise SystemExit('QA navigation patch target was not found')
if old_continue not in text:
    raise SystemExit('QA keyboard continue patch target was not found')
text = text.replace(old_navigation, new_navigation).replace(old_continue, new_continue)
path.write_text(text, encoding='utf-8')
PY

chmod +x "$RUNTIME"
exec bash "$RUNTIME" "$@"
