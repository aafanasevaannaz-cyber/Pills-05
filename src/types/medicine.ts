import type {
  ReminderSound,
  ReminderVolume,
  VoiceMode,
  VoiceRate,
} from '@/features/sound/options'

export type MedicineForm =
  | 'tablet'
  | 'capsule'
  | 'sachet'
  | 'drops'
  | 'syrup'
  | 'spray'
  | 'inhaler'
  | 'injection'
  | 'cream'
  | 'gel'
  | 'patch'
  | 'powder'
  | 'solution'
  | 'other'

export type PhotoConfirmationMode = 'off' | 'optional' | 'required'

export interface Medicine {
  id: string
  name: string
  dosage: string
  medicineForm?: MedicineForm
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
  paused?: boolean
  reminderSound?: ReminderSound
  reminderVolume?: ReminderVolume
  voiceEnabled?: boolean
  voiceMode?: VoiceMode
  voiceVolume?: ReminderVolume
  customVoiceVolume?: ReminderVolume
  voiceRate?: VoiceRate
  androidVoiceName?: string
  voicePitch?: number
  customVoicePath?: string
  photoConfirmationMode?: PhotoConfirmationMode
  endDate?: Date
  stockQuantity?: number
  unitsPerIntake?: number
  refillReminderDays?: number
  stockUpdatedAt?: Date
  createdAt: Date
  notes?: string
}