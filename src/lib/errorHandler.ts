// Централизованная обработка ошибок

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

interface ErrorLog {
  timestamp: Date
  category: string
  message: string
  severity: ErrorSeverity
  details?: string
}

const errorLogs: ErrorLog[] = []

export const logError = (
  category: string,
  error: unknown,
  severity: ErrorSeverity = 'error'
): void => {
  const message = error instanceof Error ? error.message : String(error)
  const details = error instanceof Error ? error.stack : undefined

  const log: ErrorLog = {
    timestamp: new Date(),
    category,
    message,
    severity,
    details,
  }

  errorLogs.push(log)

  // Сохранить последние 50 ошибок
  if (errorLogs.length > 50) {
    errorLogs.shift()
  }

  // Логировать в консоль
  const logFn = severity === 'critical' ? console.error : console.warn
  logFn(`[${category}] ${message}`, details ? '\n' + details : '')

  // Сохранить в localStorage для отладки
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('error_logs', JSON.stringify(errorLogs.slice(-10)))
    } catch (e) {
      // Игнорируем ошибку при сохранении логов
    }
  }
}

export const getErrorLogs = (): ErrorLog[] => {
  return [...errorLogs]
}

export const clearErrorLogs = (): void => {
  errorLogs.length = 0
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('error_logs')
    } catch (e) {
      // Игнорируем
    }
  }
}

// Безопасное выполнение функций с обработкой ошибок

export const safeExecute = async <T>(
  fn: () => Promise<T>,
  category: string,
  defaultValue?: T
): Promise<T | undefined> => {
  try {
    return await fn()
  } catch (error) {
    logError(category, error, 'warning')
    return defaultValue
  }
}

export const safeExecuteSync = <T>(
  fn: () => T,
  category: string,
  defaultValue?: T
): T | undefined => {
  try {
    return fn()
  } catch (error) {
    logError(category, error, 'warning')
    return defaultValue
  }
}

// Специфичные обработчики

export const handleNotificationError = (error: unknown): void => {
  logError('notifications', error, 'warning')
  // Продолжаем работу, просто логируем
}

export const handleSoundError = (error: unknown): void => {
  logError('sound', error, 'info')
  // Звук не критичен, продолжаем
}

export const handleVoiceError = (error: unknown): void => {
  logError('voice', error, 'info')
  // Голос не критичен, продолжаем
}

export const handleStorageError = (error: unknown): void => {
  logError('storage', error, 'error')
  // Storage критичен, но не падаем
}

export const handleCapacitorError = (error: unknown): void => {
  logError('capacitor', error, 'warning')
  // Capacitor ошибка не критична, работаем в браузере
}
