#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import websocket

PACKAGE = "com.pills.reminder"
CDP_PORT = 9222


def run(command: list[str], *, check: bool = True) -> str:
    result = subprocess.run(
        command,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    output = result.stdout or ""
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{output}")
    return output


def adb(*args: str, check: bool = True) -> str:
    return run(["adb", *args], check=check)


def shell(*args: str, check: bool = True) -> str:
    return adb("shell", *args, check=check)


def trim_ui_xml(value: str) -> str:
    start = value.find("<?xml")
    end_marker = "</hierarchy>"
    end = value.rfind(end_marker)
    if start < 0 or end < 0:
        return value
    return value[start : end + len(end_marker)]


class CDP:
    def __init__(self) -> None:
        self.socket: websocket.WebSocket | None = None
        self.message_id = 0

    def connect(self, timeout: int = 30) -> None:
        deadline = time.time() + timeout
        last_error: Exception | None = None
        while time.time() < deadline:
            try:
                sockets = shell("cat", "/proc/net/unix", check=False)
                names = re.findall(r"@?(webview_devtools_remote_\d+)", sockets)
                if not names:
                    raise RuntimeError("WebView DevTools socket not found")
                name = names[-1]
                adb("forward", "--remove", f"tcp:{CDP_PORT}", check=False)
                adb("forward", f"tcp:{CDP_PORT}", f"localabstract:{name}")
                with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json", timeout=5) as response:
                    pages = json.loads(response.read().decode("utf-8"))
                page = next((item for item in pages if item.get("type") == "page"), pages[0])
                ws_url = page["webSocketDebuggerUrl"].replace("localhost", "127.0.0.1")
                self.socket = websocket.create_connection(ws_url, timeout=10, suppress_origin=True)
                self.call("Runtime.enable")
                self.call("Page.enable")
                self.wait_ready()
                return
            except Exception as error:
                last_error = error
                time.sleep(1)
        raise RuntimeError(f"Could not connect to WebView DevTools: {last_error}")

    def close(self) -> None:
        if self.socket:
            try:
                self.socket.close()
            except Exception:
                pass
            self.socket = None
        adb("forward", "--remove", f"tcp:{CDP_PORT}", check=False)

    def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.socket:
            raise RuntimeError("CDP is not connected")
        self.message_id += 1
        message_id = self.message_id
        self.socket.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        while True:
            response = json.loads(self.socket.recv())
            if response.get("id") == message_id:
                if "error" in response:
                    raise RuntimeError(f"CDP {method} failed: {response['error']}")
                return response.get("result", {})

    def evaluate(self, expression: str, *, await_promise: bool = False) -> Any:
        result = self.call(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": await_promise,
                "userGesture": True,
            },
        )
        remote = result.get("result", {})
        if remote.get("subtype") == "error":
            raise RuntimeError(remote.get("description") or "JavaScript evaluation failed")
        return remote.get("value")

    def wait_ready(self, timeout: int = 20) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if self.evaluate("document.readyState") in {"interactive", "complete"}:
                    return
            except Exception:
                pass
            time.sleep(0.5)
        raise RuntimeError("Web page did not become ready")

    def click_text(self, texts: list[str], *, exact: bool = False, optional: bool = False) -> dict[str, Any] | None:
        payload = json.dumps(texts, ensure_ascii=False)
        exact_js = "true" if exact else "false"
        script = f"""
(() => {{
  const wanted = {payload}.map(v => v.toLocaleLowerCase('ru-RU').replace(/\\s+/g, ' ').trim());
  const exact = {exact_js};
  const norm = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/\\s+/g, ' ').trim();
  const visible = el => {{
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  }};
  const elements = Array.from(document.querySelectorAll('button,a,label,[role="button"],[role="radio"],[role="checkbox"]')).filter(visible);
  const found = elements.find(el => {{
    const text = norm(el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title'));
    return wanted.some(value => exact ? text === value : text.includes(value));
  }});
  if (!found) return {{ok:false, available:elements.map(el => norm(el.innerText || el.textContent || el.getAttribute('aria-label'))).filter(Boolean).slice(0,80)}};
  found.scrollIntoView({{block:'center', inline:'center'}});
  found.click();
  const r = found.getBoundingClientRect();
  return {{ok:true, tag:found.tagName, text:norm(found.innerText || found.textContent || found.getAttribute('aria-label')), rect:{{x:r.x,y:r.y,width:r.width,height:r.height}}, href:found.getAttribute('href')}};
}})()
"""
        result = self.evaluate(script)
        if not result or not result.get("ok"):
            if optional:
                return None
            available = (result or {}).get("available", [])
            raise RuntimeError(f"Interactive text not found: {texts}; available={available}")
        return result

    def set_first_input(self, value: str) -> dict[str, Any]:
        payload = json.dumps(value, ensure_ascii=False)
        script = f"""
(() => {{
  const visible = el => {{ const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden'; }};
  const input = Array.from(document.querySelectorAll('input,textarea')).find(el => visible(el) && !['radio','checkbox','file','hidden'].includes(el.type));
  if (!input) return {{ok:false}};
  input.scrollIntoView({{block:'center'}});
  input.focus();
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(input, {payload});
  input.dispatchEvent(new Event('input', {{bubbles:true}}));
  input.dispatchEvent(new Event('change', {{bubbles:true}}));
  const r=input.getBoundingClientRect();
  return {{ok:true, tag:input.tagName, type:input.type, value:input.value, rect:{{x:r.x,y:r.y,width:r.width,height:r.height}}}};
}})()
"""
        result = self.evaluate(script)
        if not result or not result.get("ok"):
            raise RuntimeError("Visible text input not found")
        return result

    def page_info(self) -> dict[str, Any]:
        return self.evaluate("({url:location.href,title:document.title,readyState:document.readyState,bodyText:(document.body?.innerText||'').slice(0,20000)})")

    def outer_html(self) -> str:
        return self.evaluate("document.documentElement.outerHTML") or ""

    def dom_tree(self) -> dict[str, Any]:
        script = """
(() => {
  const compact = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0,500);
  const build = el => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const node = {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      class: compact(el.className),
      text: compact(el.childElementCount === 0 ? (el.innerText || el.textContent) : ''),
      role: el.getAttribute('role') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      type: el.getAttribute('type') || '',
      value: 'value' in el ? compact(el.value) : '',
      checked: 'checked' in el ? Boolean(el.checked) : false,
      disabled: Boolean(el.disabled),
      visible: r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
      rect: {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},
      children: []
    };
    node.children = Array.from(el.children).map(build);
    return node;
  };
  return {url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},root:build(document.body)};
})()
"""
        return self.evaluate(script)


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
        self.cdp = CDP()

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
        shell("settings", "put", "system", "user_rotation", "1" if self.orientation == "landscape" else "0", check=False)
        for key in ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"]:
            shell("settings", "put", "global", key, "0", check=False)
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
        self.action("Подключаемся к DOM WebView через Chrome DevTools Protocol")
        self.cdp.connect()

    def dump_ui_xml(self, name: str) -> Path:
        destination = self.out / f"{name}-uiautomator.xml"
        result = adb("exec-out", "uiautomator", "dump", "/dev/tty", check=False)
        destination.write_text(trim_ui_xml(result), encoding="utf-8")
        return destination

    def screenshot(self, name: str) -> Path:
        destination = self.out / f"{name}.png"
        with destination.open("wb") as handle:
            process = subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=handle, stderr=subprocess.PIPE)
        if process.returncode != 0:
            raise RuntimeError(process.stderr.decode("utf-8", errors="replace"))
        return destination

    def save_dom_xml(self, name: str, tree: dict[str, Any]) -> None:
        document = ET.Element(
            "document",
            {
                "url": str(tree.get("url", "")),
                "title": str(tree.get("title", "")),
                "viewportWidth": str(tree.get("viewport", {}).get("width", "")),
                "viewportHeight": str(tree.get("viewport", {}).get("height", "")),
                "devicePixelRatio": str(tree.get("viewport", {}).get("devicePixelRatio", "")),
            },
        )

        def add(parent: ET.Element, value: dict[str, Any]) -> None:
            rect = value.get("rect", {})
            attributes = {
                "tag": str(value.get("tag", "")),
                "id": str(value.get("id", "")),
                "class": str(value.get("class", "")),
                "text": str(value.get("text", "")),
                "role": str(value.get("role", "")),
                "ariaLabel": str(value.get("ariaLabel", "")),
                "type": str(value.get("type", "")),
                "value": str(value.get("value", "")),
                "checked": str(bool(value.get("checked"))).lower(),
                "disabled": str(bool(value.get("disabled"))).lower(),
                "visible": str(bool(value.get("visible"))).lower(),
                "x": str(rect.get("x", "")),
                "y": str(rect.get("y", "")),
                "width": str(rect.get("width", "")),
                "height": str(rect.get("height", "")),
            }
            node = ET.SubElement(parent, "node", attributes)
            for child in value.get("children", []):
                add(node, child)

        add(document, tree["root"])
        ET.ElementTree(document).write(self.out / f"{name}-web-dom.xml", encoding="utf-8", xml_declaration=True)

    def save_dom_summary(self, name: str, tree: dict[str, Any]) -> None:
        lines: list[str] = []

        def walk(value: dict[str, Any], depth: int = 0) -> None:
            if value.get("visible") and (
                value.get("text")
                or value.get("ariaLabel")
                or value.get("tag") in {"button", "a", "input", "label", "textarea", "select"}
            ):
                rect = value.get("rect", {})
                lines.append(
                    f"{'  '*depth}<{value.get('tag')}> text={value.get('text')!r} aria={value.get('ariaLabel')!r} "
                    f"type={value.get('type')!r} value={value.get('value')!r} disabled={value.get('disabled')} "
                    f"rect=[{rect.get('x')},{rect.get('y')},{rect.get('width')},{rect.get('height')}]"
                )
            for child in value.get("children", []):
                walk(child, depth + 1)

        walk(tree["root"])
        (self.out / f"{name}-web-dom-summary.txt").write_text("\n".join(lines), encoding="utf-8")

    def capture(self, label: str) -> None:
        self.step += 1
        safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", label).strip("-")
        name = f"{self.step:02d}-{safe}"
        self.action(f"Сохраняем скриншот, системный XML и DOM XML: {name}")
        self.screenshot(name)
        self.dump_ui_xml(name)
        try:
            page = self.cdp.page_info()
            (self.out / f"{name}-page-info.json").write_text(json.dumps(page, ensure_ascii=False, indent=2), encoding="utf-8")
            (self.out / f"{name}-web.html").write_text(self.cdp.outer_html(), encoding="utf-8")
            tree = self.cdp.dom_tree()
            self.save_dom_xml(name, tree)
            self.save_dom_summary(name, tree)
        except Exception as error:
            self.fail(f"Не удалось сохранить DOM для {name}: {error}")

    def click(self, texts: list[str], *, exact: bool = False, optional: bool = False) -> bool:
        try:
            result = self.cdp.click_text(texts, exact=exact, optional=optional)
            if result is None:
                return False
            self.action(f"DOM-клик {texts}: {result}")
            time.sleep(1.2)
            return True
        except Exception as error:
            if optional:
                return False
            self.fail(str(error))
            return False

    def set_input(self, value: str) -> bool:
        try:
            result = self.cdp.set_first_input(value)
            self.action(f"Вводим {value!r} через DOM: {result}")
            time.sleep(0.8)
            return True
        except Exception as error:
            self.fail(str(error))
            return False

    def dismiss_permission_screen(self) -> None:
        if self.click(["Разрешить уведомления"], optional=True):
            time.sleep(2)
            # Permission is pre-granted with pm grant on API 33+, but keep a fallback.
            shell("input", "keyevent", "66", check=False)
            time.sleep(1)

    def add_medicine_flow(self) -> None:
        if not self.click(["+ Добавить", "Добавить первое лекарство"]):
            return
        self.capture("add-name")
        if not self.set_input("D3"):
            return
        self.capture("add-name-filled")
        if not self.click(["Продолжить"], exact=True):
            return
        self.capture("add-frequency")
        self.click(["Каждый день"], exact=False)
        self.click(["Продолжить"], exact=True)
        self.capture("add-time")
        self.click(["08:00"], exact=False)
        self.click(["Продолжить"], exact=True)
        self.capture("add-dosage")
        self.click(["1 таблетка"], exact=True)
        self.click(["Сохранить"], exact=False)
        time.sleep(3)
        self.cdp.wait_ready()
        self.capture("home-with-medicine")

    def navigation_and_settings(self) -> None:
        self.click(["Лекарства"], exact=True)
        self.capture("medicines")
        self.click(["История"], exact=True)
        self.capture("history")
        self.click(["Настройки"], exact=True)
        self.capture("settings-light")

        self.click(["Тёмная"], exact=True, optional=True)
        self.capture("settings-dark")
        self.click(["Очень большой"], exact=True, optional=True)
        self.capture("settings-dark-extra-large")
        self.click(["Высокий контраст"], exact=True, optional=True)
        self.capture("settings-high-contrast")

        if self.click(["Проверить звук и уведомление"], exact=False, optional=True):
            self.action("Ждём тестовое уведомление 5 секунд")
            time.sleep(5)
            shell("cmd", "statusbar", "expand-notifications", check=False)
            time.sleep(2)
            self.capture("notification-shade")
            shell("cmd", "statusbar", "collapse", check=False)
            shell("input", "keyevent", "4", check=False)
            time.sleep(1)

        if self.click(["Сохранить резервную копию"], exact=False, optional=True):
            time.sleep(3)
            self.capture("backup-share-sheet")
            shell("input", "keyevent", "4", check=False)
            time.sleep(1)

    def rotate_and_capture(self) -> None:
        if not any(value in self.model.lower() for value in ["tab", "lenovo", "samsung"]):
            return
        self.action("Проверяем противоположную ориентацию планшета")
        current = shell("settings", "get", "system", "user_rotation", check=False).strip() or "0"
        shell("settings", "put", "system", "user_rotation", "0" if current == "1" else "1", check=False)
        time.sleep(4)
        self.cdp.close()
        self.cdp.connect()
        self.click(["Сегодня"], exact=True, optional=True)
        self.capture("tablet-opposite-orientation-home")
        shell("settings", "put", "system", "user_rotation", current, check=False)
        time.sleep(2)

    def collect_diagnostics(self) -> None:
        self.action("Собираем device info, app logs, полный logcat, crash buffer и notification dump")
        commands = {
            "device-info.txt": ["adb", "shell", "sh", "-c", "getprop; echo; wm size; wm density; echo; dumpsys display | head -250"],
            "package-info.txt": ["adb", "shell", "dumpsys", "package", PACKAGE],
            "notification-dump.txt": ["adb", "shell", "dumpsys", "notification", "--noredact"],
            "full-logcat.txt": ["adb", "logcat", "-d", "-v", "threadtime"],
            "crash-logcat.txt": ["adb", "logcat", "-b", "crash", "-d", "-v", "threadtime"],
            "activity-exit-info.txt": ["adb", "shell", "dumpsys", "activity", "exit-info", PACKAGE],
        }
        for filename, command in commands.items():
            (self.out / filename).write_text(run(command, check=False), encoding="utf-8", errors="replace")

        pid = shell("pidof", "-s", PACKAGE, check=False).strip()
        app_log = adb("logcat", "-d", "-v", "threadtime", "--pid", pid, check=False) if pid else "Процесс приложения не найден при сборе.\n"
        (self.out / "app-process-logcat.txt").write_text(app_log, encoding="utf-8")

        full = (self.out / "full-logcat.txt").read_text(encoding="utf-8", errors="replace")
        crash = (self.out / "crash-logcat.txt").read_text(encoding="utf-8", errors="replace")
        app_crash_lines = [line for line in (crash + "\n" + full).splitlines() if PACKAGE in line and ("FATAL" in line or "crash" in line.lower())]
        if app_crash_lines:
            summary = "Обнаружены признаки падения Pills-05:\n\n" + "\n".join(app_crash_lines)
        else:
            summary = "Падений Pills-05 во время сценария не обнаружено. В crash buffer и полном logcat нет FATAL EXCEPTION, относящегося к com.pills.reminder.\n"
        (self.out / "crash-message.txt").write_text(summary, encoding="utf-8")
        (self.out / "actions.txt").write_text("\n".join(self.actions) + "\n", encoding="utf-8")
        (self.out / "failures.txt").write_text("\n".join(self.failures) + ("\n" if self.failures else "Сценарий завершён без ошибок автоматизации.\n"), encoding="utf-8")

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
            try:
                self.collect_diagnostics()
            finally:
                self.cdp.close()
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
    return QA(args.model, args.width, args.height, args.density, args.orientation, args.out).run_flow(args.apk)


if __name__ == "__main__":
    sys.exit(main())
