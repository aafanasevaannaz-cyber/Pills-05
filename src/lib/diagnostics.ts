import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const ERROR_KEY = 'diagnostic_errors_v1'
const MAX_ERRORS = 80

export type DiagnosticEntry = {
  time: string
  source: string
  message: string
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

export function recordDiagnosticError(source: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    const current = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]')
    const entries: DiagnosticEntry[] = Array.isArray(current) ? current : []
    entries.push({ time: new Date().toISOString(), source, message: clean(value) })
    localStorage.setItem(ERROR_KEY, JSON.stringify(entries.slice(-MAX_ERRORS)))
  } catch {
    // Диагностика не должна мешать работе приложения.
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

  return () => {
    console.error = originalConsoleError
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

const readJson = (key: string): unknown => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

export async function buildDiagnosticReport(): Promise<string> {
  const medicines = readJson('medicines')
  const history = readJson('history')
  const settings = readJson('settings') as Record<string, unknown> | null
  const errors = readJson(ERROR_KEY)

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
        soundEnabled: settings.soundEnabled,
        soundChoice: settings.soundChoice,
        volumeChoice: settings.volumeChoice,
        defaultVoiceMode: settings.defaultVoiceMode,
        pushNotificationsEnabled: settings.pushNotificationsEnabled,
      }
    : null

  return [
    'МОИ ТАБЛЕТКИ — ДИАГНОСТИЧЕСКИЙ ОТЧЁТ',
    'Версия: 1.6-smart-course',
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
    'ПОСЛЕДНИЕ ОШИБКИ',
    JSON.stringify(Array.isArray(errors) ? errors.slice(-30) : [], null, 2),
    '',
    'Названия лекарств, дозировки и тексты голосовых записей в отчёт не включаются.',
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
