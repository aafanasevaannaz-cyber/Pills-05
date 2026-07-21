import type {
  ReminderSound,
  ReminderVolume,
  VoiceMode,
  VoiceRate,
} from '@/features/sound/options'

export interface Medicine {
  id: string
  name: string
  dosage: string
  frequency: 'daily' | 'every_other' | 'as_needed'
  scheduleType:
    | 'morning'
    | 'afternoon'
    | 'evening'
    | 'night'
    | 'twice'
    | 'three_times'
    | 'custom'
  customTimes?: string[]
  reminderSound?: ReminderSound
  reminderVolume?: ReminderVolume
  voiceEnabled?: boolean
  voiceMode?: VoiceMode
  voiceVolume?: ReminderVolume
  customVoiceVolume?: ReminderVolume
  voiceRate?: VoiceRate
  customVoicePath?: string
  endDate?: Date
  stockQuantity?: number
  unitsPerIntake?: number
  refillReminderDays?: number
  stockUpdatedAt?: Date
  createdAt: Date
  notes?: string
}
