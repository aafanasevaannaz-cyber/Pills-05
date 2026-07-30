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

export type AndroidVoiceOption = {
  name: string
  label: string
  locale: string
  networkRequired: boolean
}

type SequenceOptions = {
  sound: ReminderSound
  volume: ReminderVolume
  voiceMode: VoiceMode
  voiceVolume: ReminderVolume
  voiceRate: VoiceRate
  voicePitch?: number
  androidVoiceName?: string
  customVoicePath?: string
  medicineName: string
  dosage: string
}

interface ReminderAudioPlugin {
  playSound(options: { resource: string; volume?: number; streamVolume?: number }): Promise<{ playing: boolean }>
  playSequence(options: {
    resource: string
    streamVolume: number
    text: string
    rate: number
    pitch: number
    voiceMode: VoiceMode
    voiceVolume: number
    voiceName: string
    recordedVoicePath: string
  }): Promise<{ playing: boolean }>
  speak(options: {
    text: string
    rate?: number
    pitch?: number
    volume?: number
    streamVolume?: number
    voiceName?: string
  }): Promise<{ speaking: boolean }>
  listVoices(): Promise<{ voices: AndroidVoiceOption[] }>
  startVoiceRecording(options: { key: string }): Promise<{ recording: boolean }>
  stopVoiceRecording(): Promise<{ path: string; durationMs: number }>
  cancelVoiceRecording(): Promise<void>
  playRecordedVoice(options: { path: string; volume?: number; streamVolume?: number }): Promise<{ playing: boolean }>
  deleteVoiceRecording(options: { path: string }): Promise<void>
  stop(): Promise<void>
  ensureAlarmChannel(options: { channelId: string; channelName: string; description: string }): Promise<void>
  scheduleVoiceAlarm(options: {
    requestCode: number
    medicineId: string
    triggerAt: number
    repeatDays: number
    soundResource: string
    text: string
    rate: number
    pitch: number
    voiceMode: VoiceMode
    voiceVolume: number
    alarmVolume: number
    voiceName: string
    recordedVoicePath: string
  }): Promise<void>
  cancelVoiceAlarmsForMedicine(options: { medicineId: string }): Promise<void>
  cancelAllVoiceAlarms(): Promise<void>
  openNotificationChannelSettings(options: { channelId: string }): Promise<void>
}

const NativeReminderAudio = registerPlugin<ReminderAudioPlugin>('ReminderAudio')
let previewGeneration = 0
const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
const pitch = (value?: number) => Math.max(0.7, Math.min(1.3, value ?? 1))

export async function previewReminderSound(
  sound: ReminderSound,
  volume: ReminderVolume = 'maximum'
): Promise<void> {
  const gain = getReminderVolumeOption(volume).gain
  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.playSound({ resource: getReminderResource(sound, volume), volume: 1, streamVolume: gain })
    return
  }
  await playSound(getReminderWebUrl(sound, volume), gain)
}

export async function previewReminderVoice(
  medicineName: string,
  dosage: string,
  rate: VoiceRate,
  volume: ReminderVolume = 'maximum',
  androidVoiceName = '',
  voicePitch = 1
): Promise<void> {
  const text = getMedicineReminder(medicineName, dosage || undefined)
  const gain = getReminderVolumeOption(volume).gain
  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.speak({
      text,
      rate: getVoiceRateValue(rate),
      pitch: pitch(voicePitch),
      volume: gain,
      streamVolume: gain,
      voiceName: androidVoiceName,
    })
    return
  }
  await speakText(text, 'ru-RU', getVoiceRateValue(rate))
}

export async function listAndroidVoices(): Promise<AndroidVoiceOption[]> {
  if (!Capacitor.isNativePlatform()) return []
  try {
    return (await NativeReminderAudio.listVoices()).voices ?? []
  } catch (error) {
    console.error('Android voice list failed:', error)
    return []
  }
}

export async function startCustomVoiceRecording(key: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error('Запись доступна только в Android-приложении')
  await NativeReminderAudio.startVoiceRecording({ key })
}

export async function stopCustomVoiceRecording(): Promise<{ path: string; durationMs: number }> {
  if (!Capacitor.isNativePlatform()) throw new Error('Запись доступна только в Android-приложении')
  return NativeReminderAudio.stopVoiceRecording()
}

export async function cancelCustomVoiceRecording(): Promise<void> {
  if (Capacitor.isNativePlatform()) await NativeReminderAudio.cancelVoiceRecording().catch(() => undefined)
}

export async function previewCustomVoice(path: string, volume: ReminderVolume = 'maximum'): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error('Своя запись доступна только в Android-приложении')
  const gain = getReminderVolumeOption(volume).gain
  await NativeReminderAudio.playRecordedVoice({ path, volume: 1, streamVolume: gain })
}

export async function deleteCustomVoice(path: string): Promise<void> {
  if (path && Capacitor.isNativePlatform()) await NativeReminderAudio.deleteVoiceRecording({ path })
}

export async function previewFullReminder(options: SequenceOptions): Promise<void> {
  await stopReminderPreview()
  const generation = previewGeneration
  const signalGain = getReminderVolumeOption(options.volume).gain
  const voiceGain = getReminderVolumeOption(options.voiceVolume).gain
  const text = getMedicineReminder(options.medicineName, options.dosage || undefined)

  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.playSequence({
      resource: getReminderResource(options.sound, options.volume),
      streamVolume: signalGain,
      text,
      rate: getVoiceRateValue(options.voiceRate),
      pitch: pitch(options.voicePitch),
      voiceMode: options.voiceMode,
      voiceVolume: voiceGain,
      voiceName: options.androidVoiceName ?? '',
      recordedVoicePath: options.customVoicePath ?? '',
    })
    return
  }

  await previewReminderSound(options.sound, options.volume)
  if (options.voiceMode === 'off') return
  await wait(getReminderSoundOption(options.sound).previewDelayMs)
  if (generation !== previewGeneration) return
  if (options.voiceMode === 'recorded') return
  await previewReminderVoice(
    options.medicineName,
    options.dosage,
    options.voiceRate,
    options.voiceVolume,
    options.androidVoiceName,
    options.voicePitch
  )
}

export async function ensureNativeReminderChannel(
  _sound: ReminderSound,
  _volume: ReminderVolume
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  await NativeReminderAudio.ensureAlarmChannel({
    channelId: getReminderChannelId(),
    channelName: 'Напоминания о лекарствах',
    description: 'Текст, кнопки и вибрация. Сигнал и голос управляются приложением.',
  })
  return true
}

export async function scheduleNativeVoiceAlarm(options: {
  requestCode: number
  medicineId: string
  triggerAt: Date
  repeatDays: number
  sound: ReminderSound
  alarmVolume: ReminderVolume
  medicineName: string
  dosage: string
  voiceRate: VoiceRate
  voiceMode: VoiceMode
  voiceVolume: ReminderVolume
  voicePitch?: number
  androidVoiceName?: string
  customVoicePath?: string
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  await NativeReminderAudio.scheduleVoiceAlarm({
    requestCode: options.requestCode,
    medicineId: options.medicineId,
    triggerAt: options.triggerAt.getTime(),
    repeatDays: options.repeatDays,
    soundResource: getReminderResource(options.sound, options.alarmVolume),
    text: getMedicineReminder(options.medicineName, options.dosage || undefined),
    rate: getVoiceRateValue(options.voiceRate),
    pitch: pitch(options.voicePitch),
    voiceMode: options.voiceMode,
    voiceVolume: getReminderVolumeOption(options.voiceVolume).gain,
    alarmVolume: getReminderVolumeOption(options.alarmVolume).gain,
    voiceName: options.androidVoiceName ?? '',
    recordedVoicePath: options.customVoicePath ?? '',
  })
  return true
}

export async function cancelNativeVoiceAlarmsForMedicine(medicineId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await NativeReminderAudio.cancelVoiceAlarmsForMedicine({ medicineId })
}

export async function cancelAllNativeVoiceAlarms(): Promise<void> {
  if (Capacitor.isNativePlatform()) await NativeReminderAudio.cancelAllVoiceAlarms()
}

export async function stopReminderPreview(): Promise<void> {
  previewGeneration += 1
  stopSound()
  stopSpeaking()
  if (Capacitor.isNativePlatform()) await NativeReminderAudio.stop().catch(() => undefined)
}

export async function openAndroidReminderSoundSettings(
  _sound: ReminderSound,
  _volume: ReminderVolume
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  await NativeReminderAudio.openNotificationChannelSettings({ channelId: getReminderChannelId() })
  return true
}
