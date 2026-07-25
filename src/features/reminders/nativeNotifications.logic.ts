import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Medicine } from '@/types'
import { formatDosage, getMedicineTimes } from '@/lib/formatMedicine'
import { formatStockDays, getRefillReminderDate } from '@/lib/stock'
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
  type ReminderSound,
  type ReminderVolume,
  type VoiceMode,
  type VoiceRate,
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
const voiceRequestCode = (id: number) => Math.max(1, (Math.abs(id) + 611_000_000) % 2_000_000_000)

const getVoiceMode = (medicine: Medicine): VoiceMode => {
  if (medicine.voiceMode === 'android' || medicine.voiceMode === 'recorded' || medicine.voiceMode === 'off') {
    return medicine.voiceMode
  }
  if (medicine.voiceEnabled === false) return 'off'
  return medicine.customVoicePath ? 'recorded' : 'android'
}

const getVoiceVolume = (medicine: Medicine): ReminderVolume =>
  getVoiceMode(medicine) === 'recorded'
    ? medicine.customVoiceVolume ?? medicine.voiceVolume ?? defaultVoiceVolume
    : medicine.voiceVolume ?? defaultVoiceVolume

const scheduleAudio = async (
  notificationId: number,
  medicine: Medicine,
  triggerAt: Date,
  repeatDays: number,
  sound: ReminderSound,
  volume: ReminderVolume
) => {
  await scheduleNativeVoiceAlarm({
    requestCode: voiceRequestCode(notificationId),
    medicineId: medicine.id,
    triggerAt,
    repeatDays,
    sound,
    alarmVolume: volume,
    medicineName: medicine.name,
    dosage: formatDosage(medicine.dosage),
    voiceRate: medicine.voiceRate ?? 'slow',
    voiceMode: getVoiceMode(medicine),
    voiceVolume: getVoiceVolume(medicine),
    voicePitch: medicine.voicePitch ?? 1,
    androidVoiceName: medicine.androidVoiceName ?? '',
    customVoicePath: medicine.customVoicePath,
  }).catch((error) => console.error('Reminder sequence scheduling failed:', error))
}

export const ensureReminderChannel = async (
  sound: ReminderSound = selectedSound(),
  volume: ReminderVolume = selectedVolume()
): Promise<boolean> => {
  if (!isNativeNotificationsAvailable()) return false
  try {
    await ensureNativeReminderChannel(sound, volume)
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
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
  } catch {
    return true
  }
}

export const openExactReminderSettings = async (): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return
  await LocalNotifications.changeExactNotificationSetting().catch((error) => {
    console.error('Exact reminder settings failed:', error)
  })
}

const notificationBase = (medicine: Medicine, time: string) => ({
  title: 'Пора принять лекарство',
  body: `${medicine.name}. ${formatDosage(medicine.dosage)}.`,
  largeBody: `${medicine.name}. ${formatDosage(medicine.dosage)}. Время: ${time}.`,
  channelId: getReminderChannelId(),
  autoCancel: true,
  extra: { medicineId: medicine.id, time },
})

const nextAt = (time: string) => {
  const [hour, minute] = time.split(':').map(Number)
  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  return next
}

const scheduleDaily = async (
  medicine: Medicine,
  time: string,
  sound: ReminderSound,
  volume: ReminderVolume
): Promise<number | null> => {
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  const id = generateNotificationId(medicine.id, time)
  await LocalNotifications.schedule({
    notifications: [{ id, ...notificationBase(medicine, time), schedule: { on: { hour, minute }, allowWhileIdle: true } }],
  })
  const next = nextAt(time)
  addToCache(id, medicine.id, time, next)
  await scheduleAudio(id, medicine, next, 1, sound, volume)
  return id
}

const scheduleOnce = async (
  medicine: Medicine,
  time: string,
  at: Date,
  sound: ReminderSound,
  volume: ReminderVolume
): Promise<number> => {
  const id = generateNotificationId(medicine.id, `${time}-${at.toISOString().slice(0, 10)}`)
  await LocalNotifications.schedule({
    notifications: [{ id, ...notificationBase(medicine, time), schedule: { at, allowWhileIdle: true } }],
  })
  addToCache(id, medicine.id, time, at)
  await scheduleAudio(id, medicine, at, 0, sound, volume)
  return id
}

type TestVoiceOptions = {
  voiceMode?: VoiceMode
  voiceVolume?: ReminderVolume
  customVoiceVolume?: ReminderVolume
  customVoicePath?: string
  voiceRate?: VoiceRate
  voicePitch?: number
  androidVoiceName?: string
}

export const scheduleTestNotification = async (
  sound: ReminderSound = selectedSound(),
  volume: ReminderVolume = selectedVolume(),
  voice: TestVoiceOptions = {}
): Promise<boolean> => {
  if (!isNativeNotificationsAvailable() || !(await requestNotificationPermission())) return false
  if (!(await hasExactReminderPermission())) {
    await openExactReminderSettings()
    return false
  }
  await ensureReminderChannel(sound, volume)
  const settings = useSettingsStore.getState()
  const id = Math.floor(Date.now() % 2_000_000_000)
  const at = new Date(Date.now() + 4000)
  const requestedMode = voice.voiceMode ?? settings.defaultVoiceMode
  const customPath = voice.customVoicePath ?? settings.customVoicePath
  const mode = requestedMode === 'recorded' && !customPath ? 'android' : requestedMode
  const voiceVolume = mode === 'recorded'
    ? voice.customVoiceVolume ?? settings.customVoiceVolume
    : voice.voiceVolume ?? settings.voiceVolume

  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: 'Тестовое напоминание',
      body: 'Пора принять лекарство.',
      channelId: getReminderChannelId(),
      autoCancel: true,
      schedule: { at, allowWhileIdle: true },
      extra: { test: true },
    }],
  })
  await scheduleNativeVoiceAlarm({
    requestCode: voiceRequestCode(id),
    medicineId: `__test__${id}`,
    triggerAt: at,
    repeatDays: 0,
    sound,
    alarmVolume: volume,
    medicineName: 'по расписанию',
    dosage: '1 таблетка',
    voiceRate: voice.voiceRate ?? settings.voiceRate,
    voiceMode: mode,
    voiceVolume,
    voicePitch: voice.voicePitch ?? settings.voicePitch,
    androidVoiceName: voice.androidVoiceName ?? settings.androidVoiceName,
    customVoicePath: customPath,
  })
  return true
}

export const cancelNotification = async (notificationId: number): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return
  await LocalNotifications.cancel({ notifications: [{ id: notificationId }] }).catch((error) => {
    console.error('Cancel notification failed:', error)
  })
  removeFromCache(notificationId)
}

export const cancelAllNotificationsForMedicine = async (medicineId: string): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return
  try {
    const pending = await LocalNotifications.getPending()
    const pendingIds = pending.notifications
      .filter((notification) => notification.extra?.medicineId === medicineId)
      .map((notification) => notification.id)
    const ids = Array.from(new Set([...pendingIds, ...getCachedNotifications(medicineId)]))
    if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) })
    ids.forEach(removeFromCache)
    await cancelNativeVoiceAlarmsForMedicine(medicineId)
  } catch (error) {
    console.error('Cancel medicine notifications failed:', error)
  }
}

export const cancelAllNotifications = async (): Promise<void> => {
  if (!isNativeNotificationsAvailable()) return
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(({ id }) => ({ id })) })
    }
    await cancelAllNativeVoiceAlarms()
  } catch (error) {
    console.error('Cancel all notifications failed:', error)
  }
}

const occurrences = (medicine: Medicine, time: string, intervalDays: 1 | 2): Date[] => {
  const first = nextAt(time)
  const created = new Date(medicine.createdAt)
  created.setHours(0, 0, 0, 0)
  if (intervalDays === 2) {
    const day = new Date(first)
    day.setHours(0, 0, 0, 0)
    const difference = Math.floor((day.getTime() - created.getTime()) / 86_400_000)
    if (Math.abs(difference) % 2 !== 0) first.setDate(first.getDate() + 1)
  }
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 366)
  const end = medicine.endDate && new Date(medicine.endDate) < horizon ? new Date(medicine.endDate) : horizon
  const result: Date[] = []
  while (first <= end && result.length < 366) {
    result.push(new Date(first))
    first.setDate(first.getDate() + intervalDays)
  }
  return result
}

const scheduleRefill = async (medicine: Medicine): Promise<number | null> => {
  const at = getRefillReminderDate(medicine)
  if (!at || at.getTime() <= Date.now()) return null
  const id = generateNotificationId(medicine.id, 'refill-stock')
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: 'Пора пополнить запас лекарства',
      body: `${medicine.name}: ${formatStockDays(medicine) ?? 'запас скоро закончится'}.`,
      channelId: getReminderChannelId(),
      autoCancel: true,
      schedule: { at, allowWhileIdle: true },
      extra: { medicineId: medicine.id, refill: true },
    }],
  })
  addToCache(id, medicine.id, 'refill', at)
  return id
}

export const scheduleNotificationsForMedicine = async (medicine: Medicine): Promise<number[]> => {
  if (!isNativeNotificationsAvailable() || !medicine.name || medicine.paused) return []
  const sound = medicine.reminderSound ?? selectedSound() ?? defaultReminderSound
  const volume = medicine.reminderVolume ?? selectedVolume() ?? defaultReminderVolume
  if (!(await requestNotificationPermission())) return []
  await ensureReminderChannel(sound, volume)
  await cancelAllNotificationsForMedicine(medicine.id)

  const ids: number[] = []
  const refillId = await scheduleRefill(medicine).catch((error) => {
    console.error('Refill notification scheduling failed:', error)
    return null
  })
  if (refillId !== null) ids.push(refillId)
  if (medicine.frequency === 'as_needed') return ids
  if (medicine.endDate && new Date(medicine.endDate).getTime() < Date.now()) return ids

  for (const time of getMedicineTimes(medicine)) {
    const finite = Boolean(medicine.endDate)
    if (medicine.frequency === 'every_other' || finite) {
      const interval = medicine.frequency === 'every_other' ? 2 : 1
      for (const at of occurrences(medicine, time, interval)) ids.push(await scheduleOnce(medicine, time, at, sound, volume))
    } else {
      const id = await scheduleDaily(medicine, time, sound, volume)
      if (id !== null) ids.push(id)
    }
  }
  return ids
}
