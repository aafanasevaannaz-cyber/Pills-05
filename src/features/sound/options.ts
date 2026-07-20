export type ReminderSound = 'gentle' | 'clear' | 'alarm'
export type VoiceRate = 'slow' | 'normal'

export type ReminderSoundOption = {
  id: ReminderSound
  title: string
  description: string
  resource: string
  webUrl: string
  previewDelayMs: number
}

export const reminderSoundOptions: ReminderSoundOption[] = [
  {
    id: 'gentle',
    title: 'Мягкий звонок',
    description: 'Спокойный трёхтональный сигнал',
    resource: 'medicine_gentle.wav',
    webUrl: '/sounds/medicine_gentle.wav',
    previewDelayMs: 2350,
  },
  {
    id: 'clear',
    title: 'Чёткий сигнал',
    description: 'Хорошо слышно, но без резкой сирены',
    resource: 'medicine_clear.wav',
    webUrl: '/sounds/medicine_clear.wav',
    previewDelayMs: 2250,
  },
  {
    id: 'alarm',
    title: 'Громкий будильник',
    description: 'Самый заметный вариант для шумной комнаты',
    resource: 'medicine_alarm.wav',
    webUrl: '/sounds/medicine_alarm.wav',
    previewDelayMs: 3150,
  },
]

export const defaultReminderSound: ReminderSound = 'clear'

export function isReminderSound(value: unknown): value is ReminderSound {
  return value === 'gentle' || value === 'clear' || value === 'alarm'
}

export function getReminderSoundOption(sound: ReminderSound): ReminderSoundOption {
  return reminderSoundOptions.find((option) => option.id === sound) ?? reminderSoundOptions[1]
}

export function getReminderChannelId(sound: ReminderSound): string {
  return `medicine-reminders-v4-${sound}`
}

export function getVoiceRateValue(rate: VoiceRate): number {
  return rate === 'slow' ? 0.72 : 0.9
}

export function isVoiceRate(value: unknown): value is VoiceRate {
  return value === 'slow' || value === 'normal'
}
