import { Capacitor, registerPlugin } from '@capacitor/core'
import { playSound, stopSound } from './player'
import { getMedicineReminder, speakText, stopSpeaking } from './synthesizer'
import {
  getReminderChannelId,
  getReminderSoundOption,
  getVoiceRateValue,
  type ReminderSound,
  type VoiceRate,
} from './options'

interface ReminderAudioPlugin {
  playSound(options: { resource: string; volume?: number }): Promise<{ playing: boolean }>
  speak(options: { text: string; rate?: number }): Promise<{ speaking: boolean }>
  stop(): Promise<void>
  openNotificationChannelSettings(options: { channelId: string }): Promise<void>
}

const NativeReminderAudio = registerPlugin<ReminderAudioPlugin>('ReminderAudio')

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export async function previewReminderSound(
  sound: ReminderSound,
  volume = 1
): Promise<void> {
  const option = getReminderSoundOption(sound)

  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.playSound({ resource: option.resource, volume })
    return
  }

  await playSound(option.webUrl, volume)
}

export async function previewReminderVoice(
  medicineName: string,
  dosage: string,
  rate: VoiceRate
): Promise<void> {
  const text = getMedicineReminder(medicineName, dosage)
  const numericRate = getVoiceRateValue(rate)

  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.speak({ text, rate: numericRate })
    return
  }

  await speakText(text, 'ru-RU', numericRate)
}

export async function previewFullReminder(options: {
  sound: ReminderSound
  voiceEnabled: boolean
  voiceRate: VoiceRate
  medicineName: string
  dosage: string
}): Promise<void> {
  await stopReminderPreview()
  await previewReminderSound(options.sound, 1)

  if (!options.voiceEnabled || typeof window === 'undefined') return
  await wait(getReminderSoundOption(options.sound).previewDelayMs)
  await previewReminderVoice(options.medicineName, options.dosage, options.voiceRate)
}

export async function stopReminderPreview(): Promise<void> {
  stopSound()
  stopSpeaking()
  if (Capacitor.isNativePlatform()) {
    await NativeReminderAudio.stop().catch(() => undefined)
  }
}

export async function openAndroidReminderSoundSettings(
  sound: ReminderSound
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  await NativeReminderAudio.openNotificationChannelSettings({
    channelId: getReminderChannelId(sound),
  })
  return true
}
