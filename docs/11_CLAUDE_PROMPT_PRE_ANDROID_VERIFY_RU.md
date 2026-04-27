# Claude prompt — честная pre-Android проверка для Pills-05

Скопируй и отправь Claude этот prompt целиком:

```text
Работаем в репозитории Pills-05.

Нужен НЕ новый feature PR, а ЧЕСТНАЯ PRE-ANDROID-ПРОВЕРКА перед реальной локальной сборкой.

Очень важно:
- не придумывай неподтверждённую готовность;
- не пиши 100%;
- не пиши production-ready;
- не объявляй Android-часть работающей, если это не подтверждено реальной сборкой;
- не объявляй testing complete, если не было реальных проверок.

Что нужно сделать:

1. Проведи тихий аудит текущего состояния репозитория.
2. Проверь, не завышены ли claims в docs/LIVE_WORKLOG_RU.md.
3. Если там есть неподтверждённые утверждения вроде:
   - production ready
   - 100%
   - testing complete
   - Android notifications work
   - security checks passed
   то исправь их на честные формулировки.
4. Не добавляй новые product features.
5. Не делай большой рефактор.
6. Не трогай UI/theme без необходимости.
7. Исправляй только blocker-уровень, если он реально мешает следующему шагу.

Следующий шаг для проекта должен быть только такой:
- npm install
- npm run build
- npx cap sync android
- open android/ in Android Studio
- build debug APK
- install APK on device
- run manual smoke test

Обязательное правило:
если ты меняешь любой файл в репозитории, ты обязан обновить docs/LIVE_WORKLOG_RU.md честно и без преувеличений.

ОЧЕНЬ ВАЖНО:
Ответь ТОЛЬКО ОДНИМ markdown code block.
Никакого текста до code block.
Никакого текста после code block.
Никаких двух и более code block.
Никаких вложенных code block.
Не показывай промежуточные команды анализа.
Не показывай git status, git log, ls и внутреннюю кухню.
Проведи проверку молча и верни только итог.

Формат ответа строго такой:

1) STATUS
- READY / PARTIALLY VERIFIED / BLOCKED

2) WHAT IS ACTUALLY CONFIRMED
- ...
- ...
- ...

3) WHAT IS NOT CONFIRMED YET
- ...
- ...
- ...

4) WHAT YOU CHANGED NOW
- ...
- ...
- ...
или
- no code changes made

5) WORKLOG STATUS
- docs/LIVE_WORKLOG_RU.md
- created / updated / corrected / not touched

6) WHAT WAS FIXED IN THE WORKLOG
- ...
- ...
- ...
или
- no worklog fixes needed

7) EXACT NEXT STEPS FOR ME
- npm install
- npm run build
- npx cap sync android
- open android/ in Android Studio
- build debug APK
- install APK on device
- run manual smoke test

8) WHAT REMAINS AFTER THAT
- ...
- ...
- ...

9) VERDICT
- safe to continue verification / fix X first / blocked

Проверь себя перед отправкой:
1. У тебя ровно один code block?
2. Вне code block нет ни одного символа?
3. Ты не написал 100% / production-ready / fully ready без доказательств?
4. Ты не показал промежуточные команды?

Только если на все 4 ответа "да" — отправляй.
```
