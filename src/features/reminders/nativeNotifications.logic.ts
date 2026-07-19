import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Medicine } from '@/types'

const CHANNEL_ID = 'medicine-reminders'

function notificationId(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }
  return Math.max(1, Math.abs(hash) % 2147483647)
}

async function ensureNotificationChannel(): Promise<void> {
  if (!isNativeNotificationsAvailable() || Capacitor.getPlatform() !== 'android') {
    return
  }

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Напоминания о лекарствах',
    description: 'Ежедневные напоминания о приёме лекарств',
    importance: 5,
    visibility: 1,
    vibration: true,
  })
}

export const isNativeNotificationsAvailable = (): boolean => Capacitor.isNativePlatform()

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) {
    return false
  }

  try {
    await ensureNotificationChannel()
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') {
      return true
    }

    const requested = await LocalNotifications.requestPermissions()
    return requested.display === 'granted'
  } catch (error) {
    console.error('Permission request failed:', error)
    return false
  }
}

export const scheduleNotification = async (
  medicineId: string,
  medicineName: string,
  dosage: string,
  scheduledTime: Date,
): Promise<number | null> => {
  if (!isNativeNotificationsAvailable()) {
    return null
  }

  try {
    await ensureNotificationChannel()
    const id = notificationId(`${medicineId}-${scheduledTime.toISOString()}`)
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Пора принять лекарство',
          body: `${medicineName} (${dosage})`,
          schedule: {
            at: scheduledTime,
            allowWhileIdle: true,
          },
          channelId: CHANNEL_ID,
          extra: { medicineId },
        },
      ],
    })
    return id
  } catch (error) {
    console.error('Schedule notification failed:', error)
    return null
  }
}

export const cancelNotification = async (id: number): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  await LocalNotifications.cancel({ notifications: [{ id }] })
}

export const cancelAllNotificationsForMedicine = async (medicineId: string): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  try {
    const pending = await LocalNotifications.getPending()
    const notifications = pending.notifications
      .filter((notification) => notification.extra?.medicineId === medicineId)
      .map(({ id }) => ({ id }))

    if (notifications.length > 0) {
      await LocalNotifications.cancel({ notifications })
    }
  } catch (error) {
    console.error('Cancel medicine notifications failed:', error)
  }
}

export const cancelAllNotifications = async (): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map(({ id }) => ({ id })),
    })
  }
}

export const scheduleNotificationsForMedicine = async (medicine: Medicine): Promise<number[]> => {
  if (!isNativeNotificationsAvailable() || !medicine?.name) {
    return []
  }

  await cancelAllNotificationsForMedicine(medicine.id)
  if (medicine.frequency === 'as_needed') {
    return []
  }

  const times = medicine.customTimes?.length
    ? medicine.customTimes
    : getTimesForScheduleType(medicine.scheduleType)

  if (times.length === 0) {
    return []
  }

  await ensureNotificationChannel()
  const ids: number[] = []

  if (medicine.frequency === 'every_other') {
    const now = new Date()
    const created = new Date(medicine.createdAt)
    created.setHours(0, 0, 0, 0)

    for (let offset = 0; offset < 30; offset += 1) {
      const day = new Date(now)
      day.setDate(day.getDate() + offset)
      day.setHours(0, 0, 0, 0)
      const daysSinceCreation = Math.floor((day.getTime() - created.getTime()) / 86400000)
      if (daysSinceCreation % 2 !== 0) {
        continue
      }

      for (const time of times) {
        const [hour, minute] = time.split(':').map(Number)
        const at = new Date(day)
        at.setHours(hour, minute, 0, 0)
        if (at <= now) {
          continue
        }
        if (medicine.endDate && at > new Date(medicine.endDate)) {
          continue
        }

        const id = await scheduleNotification(medicine.id, medicine.name, medicine.dosage, at)
        if (id !== null) {
          ids.push(id)
        }
      }
    }

    return ids
  }

  const notifications = times.map((time) => {
    const [hour, minute] = time.split(':').map(Number)
    const id = notificationId(`${medicine.id}-${time}`)
    ids.push(id)
    return {
      id,
      title: 'Пора принять лекарство',
      body: `${medicine.name} (${medicine.dosage})`,
      schedule: {
        on: { hour, minute },
        repeats: true,
        allowWhileIdle: true,
      },
      channelId: CHANNEL_ID,
      extra: { medicineId: medicine.id },
    }
  })

  await LocalNotifications.schedule({ notifications })
  return ids
}

function getTimesForScheduleType(scheduleType: string): string[] {
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
