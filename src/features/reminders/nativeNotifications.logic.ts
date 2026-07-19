import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Medicine } from '@/types'
import {
  addToCache,
  generateNotificationId,
  getCachedNotifications,
  removeFromCache,
} from './notificationIds.logic'

export const isNativeNotificationsAvailable = (): boolean =>
  Capacitor.isNativePlatform()

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) return false

  try {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return true

    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch (error) {
    console.error('Permission request failed:', error)
    return false
  }
}

const scheduleDailyNotification = async (
  medicine: Medicine,
  time: string
): Promise<number | null> => {
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null

  const notificationId = generateNotificationId(medicine.id, time)

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: 'Пора принять лекарство',
        body: `${medicine.name} (${medicine.dosage})`,
        schedule: {
          on: { hour, minute },
          allowWhileIdle: true,
        },
        extra: { medicineId: medicine.id, time },
      },
    ],
  })

  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  addToCache(notificationId, medicine.id, time, next)
  return notificationId
}

const scheduleOneTimeNotification = async (
  medicine: Medicine,
  time: string,
  scheduledTime: Date
): Promise<number | null> => {
  const dateKey = scheduledTime.toISOString().slice(0, 10)
  const notificationId = generateNotificationId(medicine.id, `${time}-${dateKey}`)

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: 'Пора принять лекарство',
        body: `${medicine.name} (${medicine.dosage})`,
        schedule: {
          at: scheduledTime,
          allowWhileIdle: true,
        },
        extra: { medicineId: medicine.id, time },
      },
    ],
  })

  addToCache(notificationId, medicine.id, time, scheduledTime)
  return notificationId
}

export const cancelNotification = async (notificationId: number): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return

  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] })
    removeFromCache(notificationId)
  } catch (error) {
    console.error('Cancel notification failed:', error)
  }
}

export const cancelAllNotificationsForMedicine = async (
  medicineId: string
): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return

  try {
    const pending = await LocalNotifications.getPending()
    const pendingIds = pending.notifications
      .filter((notification) => notification.extra?.medicineId === medicineId)
      .map((notification) => notification.id)

    const cachedIds = getCachedNotifications(medicineId)
    const ids = Array.from(new Set([...pendingIds, ...cachedIds]))

    if (ids.length > 0) {
      await LocalNotifications.cancel({
        notifications: ids.map((id) => ({ id })),
      })
      ids.forEach(removeFromCache)
    }
  } catch (error) {
    console.error('Cancel all notifications failed:', error)
  }
}

export const cancelAllNotifications = async (): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return

  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((notification) => ({
          id: notification.id,
        })),
      })
    }
  } catch (error) {
    console.error('Cancel all notifications failed:', error)
  }
}

const getTimesForScheduleType = (scheduleType: string): string[] => {
  const times: Record<string, string[]> = {
    morning: ['08:00'],
    afternoon: ['14:00'],
    evening: ['20:00'],
    night: ['22:00'],
    twice: ['08:00', '20:00'],
    three_times: ['08:00', '14:00', '20:00'],
  }

  return times[scheduleType] || []
}

const getEveryOtherOccurrences = (
  medicine: Medicine,
  time: string,
  count = 30
): Date[] => {
  const [hour, minute] = time.split(':').map(Number)
  const created = new Date(medicine.createdAt)
  created.setHours(0, 0, 0, 0)

  const candidate = new Date()
  candidate.setHours(hour, minute, 0, 0)

  while (candidate.getTime() <= Date.now()) {
    candidate.setDate(candidate.getDate() + 1)
  }

  const candidateDay = new Date(candidate)
  candidateDay.setHours(0, 0, 0, 0)
  const daysSinceCreation = Math.floor(
    (candidateDay.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)
  )
  if (Math.abs(daysSinceCreation) % 2 !== 0) {
    candidate.setDate(candidate.getDate() + 1)
  }

  const occurrences: Date[] = []
  const endDate = medicine.endDate ? new Date(medicine.endDate) : null

  for (let index = 0; index < count; index += 1) {
    if (endDate && candidate > endDate) break
    occurrences.push(new Date(candidate))
    candidate.setDate(candidate.getDate() + 2)
  }

  return occurrences
}

export const scheduleNotificationsForMedicine = async (
  medicine: Medicine
): Promise<number[]> => {
  if (!isNativeNotificationsAvailable() || !medicine?.name) return []
  if (medicine.frequency === 'as_needed') return []

  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) return []

  await cancelAllNotificationsForMedicine(medicine.id)

  const times =
    medicine.customTimes && medicine.customTimes.length > 0
      ? medicine.customTimes
      : getTimesForScheduleType(medicine.scheduleType)

  const ids: number[] = []

  for (const time of times) {
    if (medicine.frequency === 'every_other') {
      const occurrences = getEveryOtherOccurrences(medicine, time)
      for (const occurrence of occurrences) {
        const id = await scheduleOneTimeNotification(medicine, time, occurrence)
        if (id !== null) ids.push(id)
      }
    } else {
      const id = await scheduleDailyNotification(medicine, time)
      if (id !== null) ids.push(id)
    }
  }

  return ids
}