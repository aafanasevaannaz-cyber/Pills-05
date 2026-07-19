# Android emulator QA evidence

This QA run covers only **Pills-05** and produces a separate artifact for each target profile:

- realme C55 — Android API 35, 1080×2400, 400 dpi, portrait;
- Samsung Galaxy Tab A11+ — Android API 35, 1920×1200, 240 dpi, landscape plus opposite-orientation capture;
- Lenovo Tab M10 FHD Plus — Android API 29 (Android 10), 1920×1200, 240 dpi, landscape plus opposite-orientation capture.

Each artifact contains:

- screenshots for every completed step;
- full UIAutomator XML for every screenshot;
- compact UI-tree summaries;
- complete logcat;
- app-process logcat;
- crash-buffer output and a plain-language crash result;
- package/device/notification diagnostics;
- exact action sequence and any automation failures.
