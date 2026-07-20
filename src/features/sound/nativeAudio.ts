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
  type VoiceMode,
  type VoiceRate,
} from './options'

interface ReminderAudioPlugin {
  playSound(options: {
    resource: string
    volume?: number
    streamVolume?: number
  }): Promise<{ playing: boolean }>
  speak(options: {
    text: string
    rate?: number
    volume?: number
    streamVolume?: number
  }): Promise<{ speaking: boolean }>
  startVoiceRecording(options: { key: string }): Promise<{ recording: boolean }>
  stopVoiceRecording(): Promise<{ path: string; durationMs: number }>
  cancelVoiceRecording(): Promise<void>
  playRecordedVoice(options: {
    path: string
    volume?: number
    streamVolume?: number
  }): Promise<{ playing: boolean }>
  deleteVoiceRecording(options: { path: string }): Promise<void>
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
    voiceMode: VoiceMode
    voiceVolume: number
    alarmVolume: number
    delayBeforeVoiceMs: number
    recordedVoicePath: string
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
    await NativeReminderAudio.playSound({
      resource,
      volume: 1,
      streamVolume: gain,
    })
    return
  }

  await playSound(getReminderWebUrl(sound, volume), gain)
}

export async function previewReminderVoice(
  medicineName: string,
  dosage: string,
  rate: VoiceRate,
  volume: ReminderVolume = 'maximum'
): Promise<void> {
  const text = getMedicineReminder(medicineName, dosage || undefined)
  const numericRate = getVoiceRateValue(rate)
  const gain = getReminderVolumeOption(volume).gain

  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.speak({
      text,
      rate: numericRate,
      volume: gain,
      streamVolume: gain,
    })
    return
  }

  await speakText(text, 'ru-RU', numericRate)
}

export async function startCustomVoiceRecording(key: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Запись своего голоса доступна только в Android-приложении')
  }
  await NativeReminderAudio.startVoiceRecording({ key })
}

export async function stopCustomVoiceRecording(): Promise<{
  path: string
  durationMs: number
}> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Запись своего голоса доступна только в Android-приложении')
  }
  return NativeReminderAudio.stopVoiceRecording()
}

export async function cancelCustomVoiceRecording(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await NativeReminderAudio.cancelVoiceRecording().catch(() => undefined)
}

export async function previewCustomVoice(
  path: string,
  volume: ReminderVolume = 'maximum'
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Своя запись доступна только в Android-приложении')
  }
  const gain = getReminderVolumeOption(volume).gain
  await NativeReminderAudio.playRecordedVoice({
    path,
    volume: 1,
    streamVolume: gain,
  })
}

export async function deleteCustomVoice(path: string): Promise<void> {
  if (!path || !Capacitor.isNativePlatform()) return
  await NativeReminderAudio.deleteVoiceRecording({ path })
}

export async function previewFullReminder(options: {
  sound: ReminderSound
  volume: ReminderVolume
  voiceEnabled?: boolean
  voiceMode?: VoiceMode
  voiceVolume?: ReminderVolume
  customVoiceVolume?: ReminderVolume
  voiceRate: VoiceRate
  customVoicePath?: string
  medicineName: string
  dosage: string
}): Promise<void> {
  await stopReminderPreview()
  await previewReminderSound(options.sound, options.volume)

  const voiceMode = options.voiceMode ?? (options.voiceEnabled === false ? 'off' : 'android')
  if (voiceMode === 'off' || typeof window === 'undefined') return

  await wait(getReminderSoundOption(options.sound).previewDelayMs)
  if (voiceMode === 'recorded') {
    if (!options.customVoicePath) throw new Error('Сначала запишите свой голос')
    await previewCustomVoice(
      options.customVoicePath,
      options.customVoiceVolume ?? options.voiceVolume ?? 'maximum'
    )
    return
  }

  await previewReminderVoice(
    options.medicineName,
    options.dosage,
    options.voiceRate,
    options.voiceVolume ?? 'maximum'
  )
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
  voiceMode: VoiceMode
  voiceVolume: ReminderVolume
  alarmVolume: ReminderVolume
  delayBeforeVoiceMs: number
  customVoicePath?: string
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  await NativeReminderAudio.scheduleVoiceAlarm({
    requestCode: options.requestCode,
    medicineId: options.medicineId,
    triggerAt: options.triggerAt.getTime(),
    repeatDays: options.repeatDays,
    text: getMedicineReminder(options.medicineName, options.dosage),
    rate: getVoiceRateValue(options.voiceRate),
    voiceMode: options.voiceMode,
    voiceVolume: getReminderVolumeOption(options.voiceVolume).gain,
    alarmVolume: getReminderVolumeOption(options.alarmVolume).gain,
    delayBeforeVoiceMs: Math.max(0, Math.round(options.delayBeforeVoiceMs)),
    recordedVoicePath: options.customVoicePath ?? '',
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
