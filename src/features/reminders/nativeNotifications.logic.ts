import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Medicine } from '@/types'
import { formatDosage } from '@/lib/formatMedicine'
import { useSettingsStore } from '@/features/settings/store'
import {
  cancelAllNativeVoiceAlarms,
  cancelNativeVoiceAlarmsForMedicine,
  ensureNativeReminderChannel,
  scheduleNativeVoiceAlarm,
} from '@/features/sound/nativeAudio'
import {
  defaultReminderSound,
  defaultReminderVolume,
  defaultVoiceVolume,
  getReminderChannelId,
  getReminderResource,
  getReminderSoundOption,
  getReminderVolumeOption,
  type ReminderSound,
  type ReminderVolume,
  type VoiceMode,
} from '@/features/sound/options'
import {
  addToCache,
  generateNotificationId,
  getCachedNotifications,
  removeFromCache,
} from './notificationIds.logic'

export const isNativeNotificationsAvailable = (): boolean => Capacitor.isNativePlatform()

const selectedSound = (): ReminderSound => useSettingsStore.getState().soundChoice
const selectedVolume = (): ReminderVolume => useSettingsStore.getState().volumeChoice

const voiceRequestCode = (notificationId: number): number => {
  const code = (Math.abs(notificationId) + 611_000_000) % 2_000_000_000
  return code === 0 ? 611_000_001 : code
}

const getVoiceMode = (medicine: Medicine): VoiceMode => {
  if (medicine.voiceMode === 'android' || medicine.voiceMode === 'recorded' || medicine.voiceMode === 'off') {
    return medicine.voiceMode
  }
  if (medicine.voiceEnabled === false) return 'off'
  return medicine.customVoicePath ? 'recorded' : 'android'
}

const scheduleAudioForNotification = async (
  notificationId: number,
  medicine: Medicine,
  triggerAt: Date,
  repeatDays: number,
  soundChoice: ReminderSound,
  alarmVolume: ReminderVolume
): Promise<void> => {
  const desiredLeadMs = 700
  const availableLeadMs = Math.max(0, triggerAt.getTime() - Date.now() - 150)
  const leadMs = Math.min(desiredLeadMs, availableLeadMs)
  const serviceTime = new Date(triggerAt.getTime() - leadMs)
  const delayBeforeVoiceMs = getReminderSoundOption(soundChoice).previewDelayMs + leadMs + 300

  await scheduleNativeVoiceAlarm({
    requestCode: voiceRequestCode(notificationId),
    medicineId: medicine.id,
    triggerAt: serviceTime,
    repeatDays,
    medicineName: medicine.name,
    dosage: formatDosage(medicine.dosage),
    voiceRate: medicine.voiceRate ?? 'slow',
    voiceMode: getVoiceMode(medicine),
    voiceVolume: medicine.voiceVolume ?? defaultVoiceVolume,
    alarmVolume,
    delayBeforeVoiceMs,
    customVoicePath: medicine.customVoicePath,
  }).catch((error) => {
    console.error('Background reminder audio scheduling failed:', error)
  })
}

export const ensureReminderChannel = async (
  soundChoice: ReminderSound = selectedSound(),
  volumeChoice: ReminderVolume = selectedVolume()
): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) return false

  try {
    await ensureNativeReminderChannel(soundChoice, volumeChoice)
    return true
  } catch (nativeError) {
    console.error('Native alarm channel creation failed:', nativeError)
  }

  const soundOption = getReminderSoundOption(soundChoice)
  const volumeOption = getReminderVolumeOption(volumeChoice)
  const channelId = getReminderChannelId(soundChoice, volumeChoice)

  try {
    const result = await LocalNotifications.listChannels()
    const exists = result.channels.some((channel) => channel.id === channelId)
    if (exists) return true

    await LocalNotifications.createChannel({
      id: channelId,
      name: `Лекарства — ${soundOption.title}, ${volumeOption.title.toLowerCase()}`,
      description: 'Громкие напоминания о лекарствах.',
      sound: getReminderResource(soundChoice, volumeChoice),
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#2F6B4F',
    })
    return true
  } catch (error) {
    console.error('Notification channel creation failed:', error)
    return false
  }
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) return false

  try {
    const current = await LocalNotifications.checkPermissions()
    const granted = current.display === 'granted'
      ? true
      : (await LocalNotifications.requestPermissions()).display === 'granted'

    if (granted) await ensureReminderChannel()
    return granted
  } catch (error) {
    console.error('Permission request failed:', error)
    return false
  }
}

export const hasExactReminderPermission = async (): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) return true

  try {
    const result = await LocalNotifications.checkExactNotificationSetting()
    return result.exact_alarm === 'granted'
  } catch {
    return true
  }
}

export const openExactReminderSettings = async (): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return
  try {
    await LocalNotifications.changeExactNotificationSetting()
  } catch (error) {
    console.error('Exact reminder settings failed:', error)
  }
}

const notificationBody = (medicine: Medicine) =>
  `${medicine.name}. Дозировка: ${formatDosage(medicine.dosage)}`

const notificationBase = (
  medicine: Medicine,
  time: string,
  soundChoice: ReminderSound,
  volumeChoice: ReminderVolume
) => ({
  title: 'Пора принять лекарство',
  body: notificationBody(medicine),
  largeBody: `${notificationBody(medicine)}. Запланированное время: ${time}.`,
  sound: getReminderResource(soundChoice, volumeChoice),
  channelId: getReminderChannelId(soundChoice, volumeChoice),
  extra: {
    medicineId: medicine.id,
    time,
    soundChoice,
    volumeChoice,
    voiceMode: getVoiceMode(medicine),
    voiceVolume: medicine.voiceVolume ?? defaultVoiceVolume,
    voiceRate: medicine.voiceRate ?? 'slow',
    hasCustomVoice: Boolean(medicine.customVoicePath),
  },
  autoCancel: true,
})

const scheduleDailyNotification = async (
  medicine: Medicine,
  time: string,
  soundChoice: ReminderSound,
  volumeChoice: ReminderVolume
): Promise<number | null> => {
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null

  const notificationId = generateNotificationId(medicine.id, time)
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        ...notificationBase(medicine, time, soundChoice, volumeChoice),
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  })

  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  addToCache(notificationId, medicine.id, time, next)
  await scheduleAudioForNotification(
    notificationId,
    medicine,
    next,
    1,
    soundChoice,
    volumeChoice
  )
  return notificationId
}

const scheduleOneTimeNotification = async (
  medicine: Medicine,
  time: string,
  scheduledTime: Date,
  soundChoice: ReminderSound,
  volumeChoice: ReminderVolume
): Promise<number | null> => {
  const dateKey = scheduledTime.toISOString().slice(0, 10)
  const notificationId = generateNotificationId(medicine.id, `${time}-${dateKey}`)

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        ...notificationBase(medicine, time, soundChoice, volumeChoice),
        schedule: { at: scheduledTime, allowWhileIdle: true },
      },
    ],
  })

  addToCache(notificationId, medicine.id, time, scheduledTime)
  await scheduleAudioForNotification(
    notificationId,
    medicine,
    scheduledTime,
    0,
    soundChoice,
    volumeChoice
  )
  return notificationId
}

export const scheduleTestNotification = async (
  soundChoice: ReminderSound = selectedSound(),
  volumeChoice: ReminderVolume = selectedVolume()
): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) return false
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) return false

  const exactAllowed = await hasExactReminderPermission()
  if (!exactAllowed) {
    await openExactReminderSettings()
    return false
  }

  await ensureReminderChannel(soundChoice, volumeChoice)
  const soundOption = getReminderSoundOption(soundChoice)
  const volumeOption = getReminderVolumeOption(volumeChoice)
  const notificationId = Math.floor(Date.now() % 2_000_000_000)
  const triggerAt = new Date(Date.now() + 4000)
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: 'Проверка напоминания',
        body: `${soundOption.title}. Громкость: ${volumeOption.title.toLowerCase()}.`,
        largeBody: 'Проверка сигнала и русского голоса при закрытом приложении.',
        sound: getReminderResource(soundChoice, volumeChoice),
        channelId: getReminderChannelId(soundChoice, volumeChoice),
        autoCancel: true,
        schedule: { at: triggerAt, allowWhileIdle: true },
        extra: { test: true, soundChoice, volumeChoice },
      },
    ],
  })

  const leadMs = 700
  await scheduleNativeVoiceAlarm({
    requestCode: voiceRequestCode(notificationId),
    medicineId: `__test__${notificationId}`,
    triggerAt: new Date(triggerAt.getTime() - leadMs),
    repeatDays: 0,
    medicineName: 'Зенон',
    dosage: '1 таблетка',
    voiceRate: useSettingsStore.getState().voiceRate,
    voiceMode: 'android',
    voiceVolume: 'maximum',
    alarmVolume: volumeChoice,
    delayBeforeVoiceMs: getReminderSoundOption(soundChoice).previewDelayMs + leadMs + 300,
  }).catch((error) => {
    console.error('Test reminder audio scheduling failed:', error)
  })
  return true
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

export const cancelAllNotificationsForMedicine = async (medicineId: string): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return

  try {
    const pending = await LocalNotifications.getPending()
    const pendingIds = pending.notifications
      .filter((notification) => notification.extra?.medicineId === medicineId)
      .map((notification) => notification.id)
    const cachedIds = getCachedNotifications(medicineId)
    const ids = Array.from(new Set([...pendingIds, ...cachedIds]))

    if (ids.length > 0) {
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) })
      ids.forEach(removeFromCache)
    }
    await cancelNativeVoiceAlarmsForMedicine(medicineId)
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
        notifications: pending.notifications.map((notification) => ({ id: notification.id })),
      })
    }
    await cancelAllNativeVoiceAlarms()
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
  while (candidate.getTime() <= Date.now()) candidate.setDate(candidate.getDate() + 1)

  const candidateDay = new Date(candidate)
  candidateDay.setHours(0, 0, 0, 0)
  const daysSinceCreation = Math.floor(
    (candidateDay.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)
  )
  if (Math.abs(daysSinceCreation) % 2 !== 0) candidate.setDate(candidate.getDate() + 1)

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

  const soundChoice = medicine.reminderSound ?? selectedSound() ?? defaultReminderSound
  const volumeChoice = medicine.reminderVolume ?? selectedVolume() ?? defaultReminderVolume
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) return []
  await ensureReminderChannel(soundChoice, volumeChoice)
  await cancelAllNotificationsForMedicine(medicine.id)

  const times = medicine.customTimes && medicine.customTimes.length > 0
    ? medicine.customTimes
    : getTimesForScheduleType(medicine.scheduleType)
  const ids: number[] = []

  for (const time of times) {
    if (medicine.frequency === 'every_other') {
      const occurrences = getEveryOtherOccurrences(medicine, time)
      for (const occurrence of occurrences) {
        const id = await scheduleOneTimeNotification(
          medicine,
          time,
          occurrence,
          soundChoice,
          volumeChoice
        )
        if (id !== null) ids.push(id)
      }
    } else {
      const id = await scheduleDailyNotification(
        medicine,
        time,
        soundChoice,
        volumeChoice
      )
      if (id !== null) ids.push(id)
    }
  }

  return ids
}
