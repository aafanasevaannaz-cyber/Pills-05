# Архитектура проекта Pills-05

Полное описание технической архитектуры приложения "Напоминание о лекарствах".

## 📋 Обзор

**Тип приложения:** Progressive Web App (PWA)  
**Платформы:** Web (браузер), Android (через TWA)  
**Язык:** TypeScript + React (Next.js 14)  
**Данные:** localStorage (offline-first)

## 🎯 Основная логика потока

```
Лекарство (Medicine)
        ↓
   Расписание (Schedule)
        ↓
  Напоминание (Reminder)
        ↓
Действие пользователя (UserAction)
        ↓
   История (History)
```

### Важно
- Напоминания **генерируются** из расписания (не хранятся отдельно)
- История содержит факт приёма (когда пользователь нажал "Я принял")
- Расписание — источник истины для напоминаний

## 🏗 Структура проекта

```
Pills-05/
├── public/
│   ├── manifest.json              # PWA манифест
│   ├── service-worker.js          # Service Worker
│   ├── sounds/                    # Встроенные звуки
│   │   └── reminder.mp3
│   └── icons/                     # Иконки приложения
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Главный layout
│   │   ├── page.tsx               # Главный экран
│   │   ├── add/
│   │   │   └── page.tsx           # Страница добавления лекарства
│   │   ├── settings/
│   │   │   └── page.tsx           # Настройки
│   │   └── history/
│   │       └── page.tsx           # История приёма
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Select.tsx
│   │   │
│   │   └── screens/
│   │       ├── MainScreen.tsx
│   │       ├── AddMedicineScreen.tsx
│   │       ├── ReminderScreen.tsx
│   │       └── HistoryScreen.tsx
│   │
│   ├── features/
│   │   ├── medicines/
│   │   │   ├── store.ts           # Zustand store для лекарств
│   │   │   ├── types.ts           # Типы Medicine
│   │   │   └── hooks.ts           # Custom hooks
│   │   │
│   │   ├── reminders/
│   │   │   ├── generator.ts       # Генерация напоминаний
│   │   │   ├── scheduler.ts       # Планировщик
│   │   │   ├── types.ts           # Типы Reminder
│   │   │   └── hooks.ts           # Custom hooks
│   │   │
│   │   ├── history/
│   │   │   ├── store.ts           # История приёма
│   │   │   ├── types.ts           # Типы History
│   │   │   └── hooks.ts           # Custom hooks
│   │   │
│   │   ├── voice/
│   │   │   ├── synthesizer.ts     # Web Speech API
│   │   │   └── types.ts
│   │   │
│   │   ├── sound/
│   │   │   ├── player.ts          # Audio воспроизведение
│   │   │   └── types.ts
│   │   │
│   │   └── notifications/
│   │       ├── push.ts            # Push API
│   │       └── types.ts
│   │
│   ├── store/
│   │   ├── index.ts               # Главный store (Zustand)
│   │   ├── medicines.ts
│   │   ├── history.ts
│   │   ├── settings.ts
│   │   └── reminders.ts
│   │
│   ├── lib/
│   │   ├── storage.ts             # localStorage helpers
│   │   ├── time.ts                # Утилиты времени
│   │   ├── validation.ts          # Валидация данных
│   │   └── cleanup.ts             # Очистка старых данных
│   │
│   ├── types/
│   │   ├── medicine.ts            # Типы лекарств
│   │   ├── reminder.ts            # Типы напоминаний
│   │   ├── history.ts             # Типы истории
│   │   └── index.ts               # Экспорт всех типов
│   │
│   └── styles/
│       └── globals.css            # Глобальные стили Tailwind
│
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── README.md
├── CLAUDE.md
├── AGENTS.md
└── ARCHITECTURE.md (этот файл)
```

## 💾 Модель данных

### Medicine (Лекарство)

```typescript
interface Medicine {
  id: string;                    // UUID или hash названия
  name: string;                  // "Аспирин", "Витамин D"
  dosage: string;                // "1 таблетка", "500мг"
  frequency: 'daily' | 'every_other' | 'as_needed'; // Частота
  scheduleType: 'morning' | 'evening' | 'twice' | 'three_times' | 'custom';
  customTimes?: string[];        // ["08:00", "14:00", "20:00"]
  endDate?: Date;                // Дата окончания приема
  createdAt: Date;
  notes?: string;
}
```

### Reminder (Напоминание)

```typescript
interface Reminder {
  id: string;
  medicineId: string;
  scheduledTime: Date;           // Когда должно прозвучать
  status: 'pending' | 'shown' | 'taken' | 'skipped';
  attempts: number;              // Сколько раз повторяли (max 3)
  nextRetryTime?: Date;          // Время следующего повтора
  createdAt: Date;
}
```

### History Entry (История приёма)

```typescript
interface HistoryEntry {
  id: string;
  medicineId: string;
  takenAt: Date;                 // Когда реально принял
  scheduledFor: Date;            // На когда было запланировано
  status: 'taken' | 'skipped' | 'late'; // Как было
  notes?: string;
}
```

## 🔊 Система напоминаний

### Архитектура

```
CheckReminders (интервал 1 минута)
       ↓
IsTimeForReminder?
       ├─ YES → TriggerReminder
       │         ├─ ShowScreen
       │         ├─ PlaySound
       │         ├─ SpeakText
       │         └─ SendPush
       │
       └─ Attempt >= 3?
           ├─ YES → MarkAsMissed
           └─ NO → ScheduleRetry (after 5 min)
```

### Параметры

- **Интервал проверки:** 1 минута (каждую минуту проверяем)
- **Первое напоминание:** в назначенное время
- **Повтор 1:** через 5 минут
- **Повтор 2:** через 10 минут (всего 15 мин после первого)
- **Максимум:** 3 напоминания, потом стоп

### Каналы уведомлений

1. **Экран** (ReminderScreen.tsx)
   - Большое, яркое окно
   - Три кнопки: "Я принял", "Пропустил", "Отложить на 10 мин"

2. **Звук** (sound/player.ts)
   - MP3 файл из `/public/sounds/reminder.mp3`
   - Громкость 100%
   - Также поддержка custom файлов

3. **Голос** (voice/synthesizer.ts)
   - Web Speech API
   - Текст: "Время принимать таблетки"
   - Язык: ru-RU
   - Скорость: 1.0

4. **Push-уведомление** (notifications/push.ts)
   - System notification API
   - Заголовок: лекарство
   - Текст: время приёма

## 🎵 Система звука

### Проигрывание

```typescript
interface SoundPlayer {
  play(soundUrl: string): Promise<void>;
  stop(): void;
  setVolume(0-1): void;
}
```

### Форматы
- ✅ MP3 (основной)
- ✅ WAV (без сжатия)
- ✅ OGG (альтернатива)

### Встроенные звуки
- Основной: `/public/sounds/reminder.mp3`

## 🗣 Система голоса

### Web Speech API

```typescript
interface VoiceSynthesizer {
  speak(text: string, lang?: string): Promise<void>;
  stop(): void;
  setRate(speed: 0.5-2.0): void;
  setVolume(0-1): void;
}
```

### Параметры
- **Язык:** `ru-RU`
- **Скорость:** 1.0 (нормальная)
- **Громкость:** 1.0 (максимальная)
- **Текст:** "Время принимать таблетки"

## 📱 PWA и offline

### Service Worker

- Кэширует основные файлы при установке
- Offline fallback для главного экрана
- Background sync для истории

### Manifest.json

```json
{
  "name": "Напоминание о лекарствах",
  "short_name": "Лекарства",
  "description": "Помощник для приёма лекарств",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [...]
}
```

### Offline режим
- Данные берутся из localStorage
- Напоминания работают при отключении интернета
- Push уведомления могут требовать online (зависит от браузера)

## 🎨 Состояние приложения (Store)

### Zustand

```typescript
interface AppStore {
  // Medicines
  medicines: Medicine[];
  addMedicine(m: Medicine): void;
  removeMedicine(id: string): void;
  updateMedicine(id: string, m: Partial<Medicine>): void;
  getMedicine(id: string): Medicine | null;

  // Reminders (generated on-the-fly)
  getRemindersForDay(date: Date): Reminder[];
  getCurrentReminder(): Reminder | null;

  // History
  history: HistoryEntry[];
  recordTaken(medicineId: string): void;
  recordSkipped(medicineId: string): void;

  // Settings
  soundEnabled: boolean;
  voiceEnabled: boolean;
  pushEnabled: boolean;
  setSoundEnabled(bool): void;
  setVoiceEnabled(bool): void;
  setPushEnabled(bool): void;

  // Cleanup
  cleanup(): void;  // Удалить старые данные
}
```

## 🔄 Жизненный цикл приложения

### На старте
1. Загрузить данные из localStorage
2. Проверить давность данных (удалить старее 30 дней)
3. Инициализировать scheduler для напоминаний
4. Показать главный экран

### Каждую минуту
1. Проверить есть ли запланированные напоминания
2. Если есть → TriggerReminder()
3. Обновить UI

### При выходе
1. Сохранить состояние в localStorage
2. Остановить scheduler (если нужно)
3. Service Worker продолжит работать в фоне

## 🧪 Тестирование

### Manual Testing

```
1. Добавить лекарство с расписанием на "сейчас"
2. Подождать напоминание (экран + звук + голос)
3. Нажать "Я принял"
4. Проверить историю
5. Закрыть приложение
6. Открыть заново → данные сохранились
7. Отключить интернет → напоминания всё равно работают
```

### Critical Flows

- ✅ Напоминание появляется в назначенное время
- ✅ Экран, звук, голос, push приходят вместе
- ✅ Повторения работают (5 мин, 10 мин)
- ✅ История сохраняется
- ✅ Удаление лекарства удаляет и напоминания
- ✅ localStorage не переполняется

## 📦 APK и Trusted Web Activity

### Подготовка

1. Убедиться что manifest.json валидный
2. Service Worker кэширует нужные файлы
3. Icons in manifest (192x192, 512x512)
4. HTTPS на production сервере

### TWA (Trusted Web Activity)

- Использует Android WebView
- Может быть распространен через Google Play
- Работает как нативное приложение
- Push уведомления работают через FCM

---

**Документация актуальна:** 2026-04-19  
**Версия:** 1.0  
**Статус:** READY FOR DEVELOPMENT
