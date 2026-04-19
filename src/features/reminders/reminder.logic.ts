import { Medicine } from '@/types'
import { isNativeNotificationsAvailable, scheduleNotificationsForMedicine, cancelAllNotificationsForMedicine } from './nativeNotifications.logic'

export const scheduleReminderForMedicine = async (medicine: Medicine): Promise<void> => {
  // Для веб версии ничего не нужно делать — scheduler.ts сам генерирует
  // Для Android версии — используем native notifications

  if (!isNativeNotificationsAvailable()) {
    // Веб версия — используется browser scheduler
    return
  }

  // Android версия — запланировать native notifications
  if (medicine) {
    await scheduleNotificationsForMedicine(medicine)
  }
}

export const rescheduleReminderForMedicine = async (medicine: Medicine): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  // Отменить старые и создать новые
  await cancelAllNotificationsForMedicine(medicine.id)
  await scheduleNotificationsForMedicine(medicine)
}

export const cancelRemindersForMedicine = async (medicineId: string): Promise<void> => {
  if (!isNativeNotificationsAvailable()) {
    return
  }

  await cancelAllNotificationsForMedicine(medicineId)
}

export const getCurrentPlatform = (): 'web' | 'android' | 'ios' => {
  if (!isNativeNotificationsAvailable()) {
    return 'web'
  }

  // Capacitor apps работают как Android/iOS
  return 'android' // В нашем случае только Android
}

export const getNotificationStrategy = (): 'browser' | 'native' | 'hybrid' => {
  if (!isNativeNotificationsAvailable()) {
    return 'browser' // Только browser scheduler
  }

  // Hybrid: browser scheduler как fallback + native notifications
  return 'hybrid'
}
