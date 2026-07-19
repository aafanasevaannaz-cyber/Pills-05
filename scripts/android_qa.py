#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable

PACKAGE = "com.pills.reminder"


def run(command: list[str], *, check: bool = True, capture: bool = True) -> str:
    result = subprocess.run(
        command,
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )
    output = result.stdout or ""
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{output}")
    return output


def adb(*args: str, check: bool = True) -> str:
    return run(["adb", *args], check=check)


def shell(*args: str, check: bool = True) -> str:
    return adb("shell", *args, check=check)


def bounds_center(bounds: str) -> tuple[int, int]:
    values = [int(value) for value in re.findall(r"\d+", bounds)]
    if len(values) != 4:
        raise ValueError(f"Bad bounds: {bounds}")
    return ((values[0] + values[2]) // 2, (values[1] + values[3]) // 2)


class QA:
    def __init__(self, model: str, width: int, height: int, density: int, orientation: str, out: Path):
        self.model = model
        self.width = width
        self.height = height
        self.density = density
        self.orientation = orientation
        self.out = out
        self.out.mkdir(parents=True, exist_ok=True)
        self.actions: list[str] = []
        self.failures: list[str] = []
        self.step = 0

    def action(self, text: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        self.actions.append(f"{stamp} — {text}")
        print(text, flush=True)

    def fail(self, text: str) -> None:
        self.failures.append(text)
        self.action(f"ОШИБКА: {text}")

    def configure_device(self) -> None:
        self.action(f"Настраиваем профиль {self.model}: {self.width}x{self.height}, {self.density} dpi, {self.orientation}")
        shell("wm", "size", f"{self.width}x{self.height}")
        shell("wm", "density", str(self.density))
        shell("settings", "put", "system", "accelerometer_rotation", "0", check=False)
        rotation = "1" if self.orientation == "landscape" else "0"
        shell("settings", "put", "system", "user_rotation", rotation, check=False)
        shell("settings", "put", "global", "window_animation_scale", "0", check=False)
        shell("settings", "put", "global", "transition_animation_scale", "0", check=False)
        shell("settings", "put", "global", "animator_duration_scale", "0", check=False)
        shell("settings", "put", "system", "font_scale", "1.0", check=False)
        time.sleep(2)

    def install_and_launch(self, apk: Path) -> None:
        self.action("Удаляем предыдущую установку и очищаем logcat")
        adb("uninstall", PACKAGE, check=False)
        adb("logcat", "-c", check=False)
        self.action(f"Устанавливаем APK: {apk.name}")
        adb("install", "-r", "-t", str(apk))
        api = int(shell("getprop", "ro.build.version.sdk").strip() or "0")
        if api >= 33:
            shell("pm", "grant", PACKAGE, "android.permission.POST_NOTIFICATIONS", check=False)
        if api >= 31:
            shell("appops", "set", PACKAGE, "SCHEDULE_EXACT_ALARM", "allow", check=False)
            shell("appops", "set", PACKAGE, "USE_EXACT_ALARM", "allow", check=False)
        activity = shell("cmd", "package", "resolve-activity", "--brief", PACKAGE).strip().splitlines()[-1]
        self.action(f"Запускаем activity: {activity}")
        shell("am", "start", "-W", "-n", activity)
        time.sleep(5)

    def dump_xml(self, name: str) -> Path:
        destination = self.out / f"{name}.xml"
        result = adb("exec-out", "uiautomator", "dump", "/dev/tty", check=False)
        start = result.find("<?xml")
        if start >= 0:
            result = result[start:]
        destination.write_text(result, encoding="utf-8")
        return destination

    def screenshot(self, name: str) -> Path:
        destination = self.out / f"{name}.png"
        with destination.open("wb") as handle:
            process = subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=handle, stderr=subprocess.PIPE)
        if process.returncode != 0:
            raise RuntimeError(process.stderr.decode("utf-8", errors="replace"))
        return destination

    def summarize_xml(self, xml_path: Path, name: str) -> None:
        destination = self.out / f"{name}-ui-summary.txt"
        lines: list[str] = []
        try:
            root = ET.fromstring(xml_path.read_text(encoding="utf-8"))
            for node in root.iter("node"):
                text = (node.attrib.get("text") or "").strip()
                desc = (node.attrib.get("content-desc") or "").strip()
                cls = node.attrib.get("class", "")
                bounds = node.attrib.get("bounds", "")
                clickable = node.attrib.get("clickable", "false")
                if text or desc or clickable == "true" or cls.endswith("EditText"):
                    lines.append(f"class={cls} text={text!r} desc={desc!r} clickable={clickable} bounds={bounds}")
        except Exception as error:
            lines.append(f"XML parse failed: {error}")
        destination.write_text("\n".join(lines), encoding="utf-8")

    def capture(self, label: str) -> None:
        self.step += 1
        safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", label).strip("-")
        name = f"{self.step:02d}-{safe}"
        self.action(f"Сохраняем скриншот и XML: {name}")
        self.screenshot(name)
        xml = self.dump_xml(name)
        self.summarize_xml(xml, name)

    def current_nodes(self) -> list[ET.Element]:
        path = self.dump_xml("_current")
        try:
            return list(ET.fromstring(path.read_text(encoding="utf-8")).iter("node"))
        except Exception as error:
            self.fail(f"Не удалось разобрать XML: {error}")
            return []

    def find_node(self, texts: Iterable[str], *, exact: bool = False, class_suffix: str | None = None) -> ET.Element | None:
        wanted = [text.casefold() for text in texts]
        nodes = self.current_nodes()
        for node in nodes:
            if class_suffix and not node.attrib.get("class", "").endswith(class_suffix):
                continue
            candidates = [node.attrib.get("text", ""), node.attrib.get("content-desc", "")]
            for candidate in candidates:
                normalized = candidate.strip().casefold()
                if not normalized:
                    continue
                if any(normalized == value if exact else value in normalized for value in wanted):
                    return node
        return None

    def tap_node(self, texts: Iterable[str], *, exact: bool = False, optional: bool = False) -> bool:
        node = self.find_node(texts, exact=exact)
        if node is None:
            if optional:
                return False
            self.fail(f"Не найден элемент: {list(texts)}")
            return False
        x, y = bounds_center(node.attrib.get("bounds", ""))
        self.action(f"Нажимаем {list(texts)} по координатам из XML: {x},{y}")
        shell("input", "tap", str(x), str(y))
        time.sleep(1.2)
        return True

    def tap_first_edit(self) -> bool:
        nodes = self.current_nodes()
        for node in nodes:
            if node.attrib.get("class", "").endswith("EditText"):
                x, y = bounds_center(node.attrib.get("bounds", ""))
                self.action(f"Нажимаем первое поле ввода по XML: {x},{y}")
                shell("input", "tap", str(x), str(y))
                time.sleep(0.5)
                return True
        self.fail("Не найдено поле ввода")
        return False

    def type_text(self, text: str) -> None:
        self.action(f"Вводим тестовое значение: {text}")
        shell("input", "text", text.replace(" ", "%s"))
        time.sleep(0.7)

    def dismiss_permission_screen(self) -> None:
        if self.tap_node(["Разрешить уведомления"], optional=True):
            time.sleep(1)
            # System prompt can still appear on some API levels.
            self.tap_node(["Разрешить", "Allow"], exact=True, optional=True)
            time.sleep(2)

    def add_medicine_flow(self) -> None:
        if not self.tap_node(["+ Добавить", "Добавить первое лекарство", "Добавить"]):
            return
        self.capture("add-name")
        if not self.tap_first_edit():
            return
        self.type_text("D3")
        self.capture("add-name-filled")
        if not self.tap_node(["Продолжить"]):
            return
        self.capture("add-frequency")
        self.tap_node(["Каждый день"])
        self.tap_node(["Продолжить"])
        self.capture("add-time")
        self.tap_node(["08:00"], exact=True)
        self.tap_node(["Продолжить"])
        self.capture("add-dosage")
        self.tap_node(["1 таблетка"], exact=True)
        self.tap_node(["Сохранить"])
        time.sleep(3)
        self.capture("home-with-medicine")

    def navigation_and_settings(self) -> None:
        self.tap_node(["Лекарства"], exact=True)
        self.capture("medicines")
        self.tap_node(["История"], exact=True)
        self.capture("history")
        self.tap_node(["Настройки"], exact=True)
        self.capture("settings-light")

        self.tap_node(["Тёмная"], exact=True, optional=True)
        time.sleep(1)
        self.capture("settings-dark")
        self.tap_node(["Очень большой"], exact=True, optional=True)
        time.sleep(1)
        self.capture("settings-dark-extra-large")
        self.tap_node(["Высокий контраст"], exact=True, optional=True)
        time.sleep(1)
        self.capture("settings-high-contrast")

        # Scroll to notification test, re-dump and use XML-derived target after scroll.
        for _ in range(3):
            if self.find_node(["Проверить звук и уведомление"]):
                break
            shell("input", "swipe", str(self.width // 2), str(int(self.height * 0.78)), str(self.width // 2), str(int(self.height * 0.28)), "450")
            time.sleep(0.8)
        if self.tap_node(["Проверить звук и уведомление"], optional=True):
            self.action("Ждём тестовое уведомление 5 секунд")
            time.sleep(5)
            shell("cmd", "statusbar", "expand-notifications", check=False)
            time.sleep(2)
            self.capture("notification-shade")
            shell("cmd", "statusbar", "collapse", check=False)
            shell("input", "keyevent", "4", check=False)
            time.sleep(1)

        # Backup/share flow.
        for _ in range(4):
            if self.find_node(["Сохранить резервную копию"]):
                break
            shell("input", "swipe", str(self.width // 2), str(int(self.height * 0.78)), str(self.width // 2), str(int(self.height * 0.28)), "450")
            time.sleep(0.8)
        if self.tap_node(["Сохранить резервную копию"], optional=True):
            time.sleep(2)
            self.capture("backup-share-sheet")
            shell("input", "keyevent", "4", check=False)
            time.sleep(1)

    def rotate_and_capture(self) -> None:
        if "tab" not in self.model.lower() and "lenovo" not in self.model.lower() and "samsung" not in self.model.lower():
            return
        self.action("Проверяем противоположную ориентацию планшета")
        current = shell("settings", "get", "system", "user_rotation", check=False).strip()
        new_rotation = "0" if current == "1" else "1"
        shell("settings", "put", "system", "user_rotation", new_rotation, check=False)
        time.sleep(3)
        self.tap_node(["Сегодня"], exact=True, optional=True)
        self.capture("tablet-opposite-orientation-home")
        shell("settings", "put", "system", "user_rotation", current or "0", check=False)
        time.sleep(2)

    def collect_diagnostics(self) -> None:
        self.action("Собираем device info, app logs, полный logcat, crash buffer и notification dump")
        commands = {
            "device-info.txt": ["adb", "shell", "sh", "-c", "getprop; echo; wm size; wm density; echo; dumpsys display | head -200"],
            "package-info.txt": ["adb", "shell", "dumpsys", "package", PACKAGE],
            "notification-dump.txt": ["adb", "shell", "dumpsys", "notification", "--noredact"],
            "full-logcat.txt": ["adb", "logcat", "-d", "-v", "threadtime"],
            "crash-logcat.txt": ["adb", "logcat", "-b", "crash", "-d", "-v", "threadtime"],
            "activity-exit-info.txt": ["adb", "shell", "dumpsys", "activity", "exit-info", PACKAGE],
        }
        for filename, command in commands.items():
            output = run(command, check=False)
            (self.out / filename).write_text(output, encoding="utf-8", errors="replace")

        pid = shell("pidof", "-s", PACKAGE, check=False).strip()
        if pid:
            output = adb("logcat", "-d", "-v", "threadtime", "--pid", pid, check=False)
        else:
            output = "Процесс приложения не найден в момент сбора. См. full-logcat.txt и activity-exit-info.txt.\n"
        (self.out / "app-process-logcat.txt").write_text(output, encoding="utf-8")

        crash_text = (self.out / "crash-logcat.txt").read_text(encoding="utf-8", errors="replace").strip()
        fatal_lines = [line for line in (self.out / "full-logcat.txt").read_text(encoding="utf-8", errors="replace").splitlines() if "FATAL EXCEPTION" in line or "AndroidRuntime" in line and "FATAL" in line]
        if crash_text or fatal_lines:
            summary = "Обнаружены признаки падения.\n\n" + crash_text + "\n" + "\n".join(fatal_lines)
        else:
            summary = "Падений приложения во время сценария не обнаружено. Crash buffer пуст, FATAL EXCEPTION в logcat отсутствует.\n"
        (self.out / "crash-message.txt").write_text(summary, encoding="utf-8")
        (self.out / "actions.txt").write_text("\n".join(self.actions) + "\n", encoding="utf-8")
        (self.out / "failures.txt").write_text("\n".join(self.failures) + ("\n" if self.failures else "Проверочный сценарий завершён без ошибок автоматизации.\n"), encoding="utf-8")

    def run_flow(self, apk: Path) -> int:
        try:
            self.configure_device()
            self.install_and_launch(apk)
            self.capture("first-launch")
            self.dismiss_permission_screen()
            self.capture("today-empty")
            self.add_medicine_flow()
            self.navigation_and_settings()
            self.rotate_and_capture()
        except Exception as error:
            self.fail(f"Необработанная ошибка сценария: {error}")
        finally:
            self.collect_diagnostics()
        return 1 if self.failures else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--density", type=int, required=True)
    parser.add_argument("--orientation", choices=["portrait", "landscape"], required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    qa = QA(args.model, args.width, args.height, args.density, args.orientation, args.out)
    return qa.run_flow(args.apk)


if __name__ == "__main__":
    sys.exit(main())
