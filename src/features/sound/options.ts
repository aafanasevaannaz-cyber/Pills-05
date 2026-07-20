export type ReminderSound = 'gentle' | 'clear' | 'alarm'
export type ReminderVolume = 'normal' | 'loud' | 'maximum'
export type VoiceRate = 'slow' | 'normal'

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
    description: 'Не слишком резко в тихой комнате',
    gain: 0.72,
  },
  {
    id: 'loud',
    title: 'Громкая',
    description: 'Для повседневного использования',
    gain: 0.9,
  },
  {
    id: 'maximum',
    title: 'Максимальная',
    description: 'Самый насыщенный файл и поток будильника',
    gain: 1,
  },
]

export const defaultReminderSound: ReminderSound = 'alarm'
export const defaultReminderVolume: ReminderVolume = 'maximum'

export function isReminderSound(value: unknown): value is ReminderSound {
  return value === 'gentle' || value === 'clear' || value === 'alarm'
}

export function isReminderVolume(value: unknown): value is ReminderVolume {
  return value === 'normal' || value === 'loud' || value === 'maximum'
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
  return `medicine-reminders-v7-${sound}-${volume}`
}

export function getVoiceRateValue(rate: VoiceRate): number {
  return rate === 'slow' ? 0.72 : 0.9
}

export function isVoiceRate(value: unknown): value is VoiceRate {
  return value === 'slow' || value === 'normal'
}
