#!/usr/bin/env python3
from __future__ import annotations

import time

import android_qa as qa


def page_info_compat(self: qa.CDP):
    return self.evaluate(
        "({url:location.href,title:document.title,readyState:document.readyState,"
        "bodyText:(document.body ? document.body.innerText : '').slice(0,20000)})"
    )


def navigation_and_settings_compat(self: qa.QA) -> None:
    self.click(["Лекарства"], exact=False)
    self.capture("medicines")
    self.click(["История"], exact=False)
    self.capture("history")
    self.click(["Настройки"], exact=False)
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
        qa.shell("cmd", "statusbar", "expand-notifications", check=False)
        time.sleep(2)
        self.capture("notification-shade")
        qa.shell("cmd", "statusbar", "collapse", check=False)
        qa.shell("input", "keyevent", "4", check=False)
        time.sleep(1)

    if self.click(["Сохранить резервную копию"], exact=False, optional=True):
        time.sleep(3)
        self.capture("backup-share-sheet")
        qa.shell("input", "keyevent", "4", check=False)
        time.sleep(1)


def rotate_and_capture_compat(self: qa.QA) -> None:
    if not any(value in self.model.lower() for value in ["tab", "lenovo", "samsung"]):
        return
    self.action("Проверяем противоположную ориентацию планшета")
    current = qa.shell("settings", "get", "system", "user_rotation", check=False).strip() or "0"
    qa.shell("settings", "put", "system", "user_rotation", "0" if current == "1" else "1", check=False)
    time.sleep(4)
    self.cdp.close()
    self.cdp.connect()
    self.click(["Сегодня"], exact=False, optional=True)
    self.capture("tablet-opposite-orientation-home")
    qa.shell("settings", "put", "system", "user_rotation", current, check=False)
    time.sleep(2)


qa.CDP.page_info = page_info_compat
qa.QA.navigation_and_settings = navigation_and_settings_compat
qa.QA.rotate_and_capture = rotate_and_capture_compat

if __name__ == "__main__":
    raise SystemExit(qa.main())
