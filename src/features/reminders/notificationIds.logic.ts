// Логика для генерации и управления уникальными ID уведомлений
// Каждое лекарство + время = уникальный ID

const NOTIFICATION_ID_PREFIX = 'pill_'

export const generateNotificationId = (medicineId: string, time: string): number => {
  // Создаем уникальный hash из medicineId и времени
  const combined = `${NOTIFICATION_ID_PREFIX}${medicineId}_${time}`
  let hash = 0

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  // Преобразуем в положительное число и берем последние 8 цифр
  return Math.abs(hash) % 100000000
}

export const parseNotificationId = (id: number): { medicineId: string; time: string } | null => {
  // ID нельзя декодировать, но можем использовать для кэша
  return null
}

export const isNotificationIdForMedicine = (
  notificationId: number,
  medicineId: string,
  times: string[]
): boolean => {
  // Проверяем, принадлежит ли уведомление этому лекарству
  return times.some(
    (time) => generateNotificationId(medicineId, time) === notificationId
  )
}

// Кэш для отслеживания активных уведомлений
export const notificationCache = new Map<number, {
  medicineId: string
  time: string
  scheduledTime: Date
}>()

export const addToCache = (
  notificationId: number,
  medicineId: string,
  time: string,
  scheduledTime: Date
) => {
  notificationCache.set(notificationId, {
    medicineId,
    time,
    scheduledTime,
  })
}

export const removeFromCache = (notificationId: number) => {
  notificationCache.delete(notificationId)
}

export const getCachedNotifications = (medicineId: string): number[] => {
  return Array.from(notificationCache.entries())
    .filter(([_, data]) => data.medicineId === medicineId)
    .map(([id]) => id)
}

export const getAllCachedNotifications = (): number[] => {
  return Array.from(notificationCache.keys())
}

export const clearCache = () => {
  notificationCache.clear()
}
