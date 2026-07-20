import { Capacitor, registerPlugin } from '@capacitor/core'
import { playSound, stopSound } from './player'
import { getMedicineReminder, speakText, stopSpeaking } from './synthesizer'
import {
  getReminderChannelId,
  getReminderResource,
  getReminderSoundOption,
  getReminderVolumeOption,
  getReminderWebUrl,
  getVoiceRateValue,
  type ReminderSound,
  type ReminderVolume,
  type VoiceRate,
} from './options'

interface ReminderAudioPlugin {
  playSound(options: { resource: string; volume?: number }): Promise<{ playing: boolean }>
  speak(options: { text: string; rate?: number }): Promise<{ speaking: boolean }>
  stop(): Promise<void>
  ensureAlarmChannel(options: {
    channelId: string
    channelName: string
    description: string
    resource: string
  }): Promise<void>
  scheduleVoiceAlarm(options: {
    requestCode: number
    medicineId: string
    triggerAt: number
    repeatDays: number
    text: string
    rate: number
  }): Promise<void>
  cancelVoiceAlarmsForMedicine(options: { medicineId: string }): Promise<void>
  cancelAllVoiceAlarms(): Promise<void>
  openNotificationChannelSettings(options: { channelId: string }): Promise<void>
}

const NativeReminderAudio = registerPlugin<ReminderAudioPlugin>('ReminderAudio')

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export async function previewReminderSound(
  sound: ReminderSound,
  volume: ReminderVolume = 'maximum'
): Promise<void> {
  const resource = getReminderResource(sound, volume)
  const gain = getReminderVolumeOption(volume).gain

  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.playSound({ resource, volume: gain })
    return
  }

  await playSound(getReminderWebUrl(sound, volume), gain)
}

export async function previewReminderVoice(
  medicineName: string,
  dosage: string,
  rate: VoiceRate
): Promise<void> {
  const text = getMedicineReminder(medicineName, dosage || undefined)
  const numericRate = getVoiceRateValue(rate)

  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.speak({ text, rate: numericRate })
    return
  }

  await speakText(text, 'ru-RU', numericRate)
}

export async function previewFullReminder(options: {
  sound: ReminderSound
  volume: ReminderVolume
  voiceEnabled: boolean
  voiceRate: VoiceRate
  medicineName: string
  dosage: string
}): Promise<void> {
  await stopReminderPreview()
  await previewReminderSound(options.sound, options.volume)

  if (!options.voiceEnabled || typeof window === 'undefined') return
  await wait(getReminderSoundOption(options.sound).previewDelayMs)
  await previewReminderVoice(options.medicineName, options.dosage, options.voiceRate)
}

export async function ensureNativeReminderChannel(
  sound: ReminderSound,
  volume: ReminderVolume
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const soundOption = getReminderSoundOption(sound)
  const volumeOption = getReminderVolumeOption(volume)
  await NativeReminderAudio.ensureAlarmChannel({
    channelId: getReminderChannelId(sound, volume),
    channelName: `Лекарства — ${soundOption.title}, ${volumeOption.title.toLowerCase()}`,
    description: 'Громкие напоминания о приёме лекарств через аудиопоток будильника.',
    resource: getReminderResource(sound, volume),
  })
  return true
}

export async function scheduleNativeVoiceAlarm(options: {
  requestCode: number
  medicineId: string
  triggerAt: Date
  repeatDays: number
  medicineName: string
  dosage: string
  voiceRate: VoiceRate
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  await NativeReminderAudio.scheduleVoiceAlarm({
    requestCode: options.requestCode,
    medicineId: options.medicineId,
    triggerAt: options.triggerAt.getTime(),
    repeatDays: options.repeatDays,
    text: getMedicineReminder(options.medicineName, options.dosage),
    rate: getVoiceRateValue(options.voiceRate),
  })
  return true
}

export async function cancelNativeVoiceAlarmsForMedicine(
  medicineId: string
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await NativeReminderAudio.cancelVoiceAlarmsForMedicine({ medicineId })
}

export async function cancelAllNativeVoiceAlarms(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await NativeReminderAudio.cancelAllVoiceAlarms()
}

export async function stopReminderPreview(): Promise<void> {
  stopSound()
  stopSpeaking()
  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.stop().catch(() => undefined)
  }
}

export async function openAndroidReminderSoundSettings(
  sound: ReminderSound,
  volume: ReminderVolume
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  await NativeReminderAudio.openNotificationChannelSettings({
    channelId: getReminderChannelId(sound, volume),
  })
  return true
}
