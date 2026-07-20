export type ReminderSound = 'gentle' | 'clear' | 'alarm'
export type ReminderVolume = 'normal' | 'loud' | 'maximum'
export type VoiceRate = 'slow' | 'normal'
export type VoiceMode = 'android' | 'recorded' | 'off'

export type ReminderSoundOption = {
  id: ReminderSound
  title: string
  description: string
  previewDelayMs: number
}

export type ReminderVolumeOption = {
  id: ReminderVolume
  title: string
  description: string
  gain: number
}

export const reminderSoundOptions: ReminderSoundOption[] = [
  {
    id: 'gentle',
    title: 'Мягкий звонок',
    description: 'Спокойный трёхтональный сигнал',
    previewDelayMs: 2550,
  },
  {
    id: 'clear',
    title: 'Чёткий сигнал',
    description: 'Хорошо различимая последовательность',
    previewDelayMs: 2550,
  },
  {
    id: 'alarm',
    title: 'Громкий будильник',
    description: 'Самый заметный вариант для другой комнаты',
    previewDelayMs: 3550,
  },
]

export const reminderVolumeOptions: ReminderVolumeOption[] = [
  {
    id: 'normal',
    title: 'Обычная',
    description: 'Около половины громкости будильника',
    gain: 0.55,
  },
  {
    id: 'loud',
    title: 'Громкая',
    description: 'Около 80% громкости будильника',
    gain: 0.8,
  },
  {
    id: 'maximum',
    title: 'Максимальная',
    description: 'Полная громкость будильника Android',
    gain: 1,
  },
]

export const defaultReminderSound: ReminderSound = 'alarm'
export const defaultReminderVolume: ReminderVolume = 'maximum'
export const defaultVoiceVolume: ReminderVolume = 'maximum'

export function isReminderSound(value: unknown): value is ReminderSound {
  return value === 'gentle' || value === 'clear' || value === 'alarm'
}

export function isReminderVolume(value: unknown): value is ReminderVolume {
  return value === 'normal' || value === 'loud' || value === 'maximum'
}

export function isVoiceMode(value: unknown): value is VoiceMode {
  return value === 'android' || value === 'recorded' || value === 'off'
}

export function getReminderSoundOption(sound: ReminderSound): ReminderSoundOption {
  return reminderSoundOptions.find((option) => option.id === sound) ?? reminderSoundOptions[2]
}

export function getReminderVolumeOption(volume: ReminderVolume): ReminderVolumeOption {
  return reminderVolumeOptions.find((option) => option.id === volume) ?? reminderVolumeOptions[2]
}

export function getReminderResource(sound: ReminderSound, volume: ReminderVolume): string {
  return `medicine_${sound}_${volume}.wav`
}

export function getReminderWebUrl(sound: ReminderSound, volume: ReminderVolume): string {
  return `/sounds/${getReminderResource(sound, volume)}`
}

export function getReminderChannelId(sound: ReminderSound, volume: ReminderVolume): string {
  return `medicine-reminders-v8-${sound}-${volume}`
}

export function getVoiceRateValue(rate: VoiceRate): number {
  return rate === 'slow' ? 0.72 : 0.9
}

export function isVoiceRate(value: unknown): value is VoiceRate {
  return value === 'slow' || value === 'normal'
}
