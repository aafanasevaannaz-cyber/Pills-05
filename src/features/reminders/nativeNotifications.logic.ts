import { LocalNotifications } from '@capacitor/local-notifications'
import { Medicine } from '@/types'
import { generateNotificationId, addToCache, removeFromCache, getCachedNotifications, getAllCachedNotifications } from './notificationIds.logic'

export const isNativeNotificationsAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.cordova || !!(window as any).capacitor
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) {
    return false
  }

  try {
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch (e) {
    console.error('Permission request failed:', e)
    return false
  }
}

export const scheduleNotification = async (
  medicineId: string,
  medicineName: string,
  dosage: string,
  scheduledTime: Date
): Promise<number | null> => {
  if (!isNativeNotificationsAvailable()) {
    return null
  }

  try {
    const time = scheduledTime.getHours().toString().padStart(2, '0') +
                ':' +
                scheduledTime.getMinutes().toString().padStart(2, '0')

    const notificationId = generateNotificationId(medicineId, time)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: 'Пора принять лекарство',
          body: `${medicineName} (${dosage})`,
          schedule: {
            at: new Date(scheduledTime.getTime()),
          },
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#488AFF',
          sound: 'beep',
        },
      ],
    })

    addToCache(notificationId, medicineId, time, scheduledTime)
    return notificationId
  } catch (e) {
    console.error('Schedule notification failed:', e)
    return null
  }
}

export const cancelNotification = async (notificationId: number): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] })
    removeFromCache(notificationId)
  } catch (e) {
    console.error('Cancel notification failed:', e)
  }
}

export const cancelAllNotificationsForMedicine = async (medicineId: string): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  try {
    const notificationIds = getCachedNotifications(medicineId)
    if (notificationIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: notificationIds.map((id) => ({ id })),
      })
      notificationIds.forEach((id) => removeFromCache(id))
    }
  } catch (e) {
    console.error('Cancel all notifications failed:', e)
  }
}

export const cancelAllNotifications = async (): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  try {
    const allIds = getAllCachedNotifications()
    if (allIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: allIds.map((id) => ({ id })),
      })
    }
  } catch (e) {
    console.error('Cancel all notifications failed:', e)
  }
}

export const scheduleNotificationsForMedicine = async (medicine: Medicine): Promise<number[]> => {
  const ids: number[] = []

  if (!medicine || !medicine.name) {
    return ids
  }

  let times: string[] = []

  if (medicine.customTimes && medicine.customTimes.length > 0) {
    times = medicine.customTimes
  } else {
    times = getTimesForScheduleType(medicine.scheduleType)
  }

  for (const time of times) {
    const [hours, minutes] = time.split(':').map(Number)
    const scheduledTime = new Date()
    scheduledTime.setHours(hours, minutes, 0, 0)

    // Если время уже прошло сегодня, расписываем на завтра
    const now = new Date()
    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }

    const id = await scheduleNotification(
      medicine.id,
      medicine.name,
      medicine.dosage,
      scheduledTime
    )

    if (id !== null) {
      ids.push(id)
    }
  }

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
