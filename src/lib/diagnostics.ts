import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { findMedicineNameSuggestions } from '@/data/medicineNames'

const ERROR_KEY = 'diagnostic_errors_v2'
const EVENT_KEY = 'diagnostic_events_v2'
const MAX_ERRORS = 80
const MAX_EVENTS = 160

export type DiagnosticEntry = {
  time: string
  source: string
  message: string
}

export type DiagnosticEvent = {
  time: string
  source: string
  data: Record<string, string | number | boolean | null>
}

const clean = (value: unknown): string => {
  const text = value instanceof Error
    ? `${value.name}: ${value.message}`
    : typeof value === 'string'
      ? value
      : (() => {
          try { return JSON.stringify(value) } catch { return String(value) }
        })()
  return text
    .replace(/\b\d{2}:\d{2}\b/g, '[время]')
    .replace(/\b\d{6,}\b/g, '[число]')
    .slice(0, 700)
}

const readJson = (key: string): unknown => {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

export function recordDiagnosticError(source: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    const current = readJson(ERROR_KEY)
    const entries: DiagnosticEntry[] = Array.isArray(current) ? current : []
    entries.push({ time: new Date().toISOString(), source, message: clean(value) })
    localStorage.setItem(ERROR_KEY, JSON.stringify(entries.slice(-MAX_ERRORS)))
  } catch {
    // Диагностика не должна мешать работе приложения.
  }
}

export function recordDiagnosticEvent(
  source: string,
  data: Record<string, string | number | boolean | null>
): void {
  if (typeof window === 'undefined') return
  try {
    const current = readJson(EVENT_KEY)
    const events: DiagnosticEvent[] = Array.isArray(current) ? current : []
    events.push({ time: new Date().toISOString(), source, data })
    localStorage.setItem(EVENT_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch {
    // Журнал событий не должен влиять на работу приложения.
  }
}

export function installDiagnosticsCapture(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const originalConsoleError = console.error
  const onError = (event: ErrorEvent) => recordDiagnosticError('window.error', event.error || event.message)
  const onRejection = (event: PromiseRejectionEvent) => recordDiagnosticError('unhandledrejection', event.reason)

  console.error = (...args: unknown[]) => {
    recordDiagnosticError('console.error', args.map(clean).join(' | '))
    originalConsoleError(...args)
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  recordDiagnosticEvent('application.started', {
    native: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    width: window.screen.width,
    height: window.screen.height,
  })

  return () => {
    console.error = originalConsoleError
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

export function runMedicineAutocompleteSelfTest(): {
  passed: boolean
  checks: Array<{ query: string; expected: string; actual: string | null; passed: boolean }>
} {
  const cases = [
    { query: 'Амок', expected: 'Амоксициллин' },
    { query: 'Некс', expected: 'Нексиум' },
    { query: 'Ито', expected: 'Итомед' },
    { query: 'Пеп', expected: 'Пепсан' },
  ]
  const checks = cases.map(({ query, expected }) => {
    const suggestions = findMedicineNameSuggestions(query, [], 8)
    const actual = suggestions[0] ?? null
    return { query, expected, actual, passed: suggestions.includes(expected) }
  })
  return { passed: checks.every((check) => check.passed), checks }
}

export async function buildDiagnosticReport(): Promise<string> {
  const medicines = readJson('medicines')
  const history = readJson('history')
  const settings = readJson('settings') as Record<string, unknown> | null
  const errors = readJson(ERROR_KEY)
  const events = readJson(EVENT_KEY)
  const autocompleteSelfTest = runMedicineAutocompleteSelfTest()

  let permission = 'неизвестно'
  let exactAlarm = 'неизвестно'
  let pendingCount = 'неизвестно'
  if (Capacitor.isNativePlatform()) {
    try { permission = (await LocalNotifications.checkPermissions()).display }
    catch (error) { recordDiagnosticError('diagnostics.permissions', error) }
    try { exactAlarm = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm }
    catch (error) { recordDiagnosticError('diagnostics.exactAlarm', error) }
    try { pendingCount = String((await LocalNotifications.getPending()).notifications.length) }
    catch (error) { recordDiagnosticError('diagnostics.pending', error) }
  }

  const medicineCount = Array.isArray(medicines) ? medicines.length : 0
  const historyCount = Array.isArray(history) ? history.length : 0
  const safeSettings = settings
    ? {
        theme: settings.theme,
        textSize: settings.textSize,
        font: settings.font,
        reduceAnimations: settings.reduceAnimations,
        soundEnabled: settings.soundEnabled,
        soundChoice: settings.soundChoice,
        volumeChoice: settings.volumeChoice,
        defaultVoiceMode: settings.defaultVoiceMode,
        pushNotificationsEnabled: settings.pushNotificationsEnabled,
      }
    : null

  return [
    'МОИ ТАБЛЕТКИ — ДИАГНОСТИЧЕСКИЙ ОТЧЁТ',
    'Версия: 1.9-full-android-qa',
    `Создан: ${new Date().toISOString()}`,
    `Платформа: ${Capacitor.getPlatform()}`,
    `User-Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'нет'}`,
    `Язык: ${typeof navigator !== 'undefined' ? navigator.language : 'нет'}`,
    `Экран: ${typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'нет'}`,
    `Интернет: ${typeof navigator !== 'undefined' ? String(navigator.onLine) : 'нет'}`,
    '',
    'РАЗРЕШЕНИЯ И ПЛАНИРОВАНИЕ',
    `Уведомления: ${permission}`,
    `Точные напоминания: ${exactAlarm}`,
    `Запланировано уведомлений: ${pendingCount}`,
    '',
    'СОСТОЯНИЕ ПРИЛОЖЕНИЯ',
    `Лекарств сохранено: ${medicineCount}`,
    `Записей истории: ${historyCount}`,
    `Настройки: ${JSON.stringify(safeSettings)}`,
    '',
    'САМОПРОВЕРКА ПОДСКАЗОК',
    JSON.stringify(autocompleteSelfTest, null, 2),
    '',
    'ПОСЛЕДНИЕ СОБЫТИЯ ИНТЕРФЕЙСА',
    JSON.stringify(Array.isArray(events) ? events.slice(-50) : [], null, 2),
    '',
    'ПОСЛЕДНИЕ ОШИБКИ',
    JSON.stringify(Array.isArray(errors) ? errors.slice(-30) : [], null, 2),
    '',
    'Названия лекарств, дозировки и голосовые записи в отчёт не включаются.',
    'Для автодополнения записываются только длина введённого текста, число вариантов, состояние клавиатуры и нажатия на подсказки.',
  ].join('\n')
}

export async function downloadDiagnosticReport(): Promise<void> {
  if (typeof window === 'undefined') return
  const report = await buildDiagnosticReport()
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `moi-tabletki-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareDiagnosticReport(): Promise<'shared' | 'copied' | 'downloaded'> {
  if (typeof window === 'undefined') return 'downloaded'
  const report = await buildDiagnosticReport()
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Диагностика приложения «Мои таблетки»', text: report })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared'
      recordDiagnosticError('diagnostics.share', error)
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(report)
      return 'copied'
    } catch (error) {
      recordDiagnosticError('diagnostics.clipboard', error)
    }
  }
  await downloadDiagnosticReport()
  return 'downloaded'
}
