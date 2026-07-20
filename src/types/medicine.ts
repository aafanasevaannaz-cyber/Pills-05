import type {
  ReminderSound,
  ReminderVolume,
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
  voiceRate?: VoiceRate
  endDate?: Date
  createdAt: Date
  notes?: string
}
