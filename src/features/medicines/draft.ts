import type { PersistedSettings } from '@/features/settings/store'
import { defaultMedicineForm } from '@/features/medicines/forms'
import type {
  ReminderSound,
  ReminderVolume,
  VoiceMode,
  VoiceRate,
} from '@/features/sound/options'
import type { Medicine, MedicineForm } from '@/types'

export type CourseChoice = 'ongoing' | '7' | '14' | '30' | '90' | 'custom'

export type MedicineDraft = {
  name: string
  medicineForm: MedicineForm
  frequency: Medicine['frequency'] | ''
  times: string[]
  dosage: string
  sound: ReminderSound
  volume: ReminderVolume
  voiceMode: VoiceMode
  voiceVolume: ReminderVolume
  customVoiceVolume: ReminderVolume
  voiceRate: VoiceRate
  voicePitch: number
  androidVoiceName: string
  customVoicePath: string
  courseChoice: CourseChoice
  customEndDate: string
  trackStock: boolean
  stockQuantity: string
  unitsPerIntake: string
  refillReminderDays: string
  photoConfirmationMode: NonNullable<Medicine['photoConfirmationMode']>
}

type DraftSettings = Pick<
  PersistedSettings,
  | 'soundChoice'
  | 'volumeChoice'
  | 'defaultVoiceMode'
  | 'voiceVolume'
  | 'customVoiceVolume'
  | 'voiceRate'
  | 'voicePitch'
  | 'androidVoiceName'
  | 'customVoicePath'
>

const scheduleTimes = (medicine: Medicine): string[] => {
  if (medicine.customTimes?.length) return [...medicine.customTimes]
  switch (medicine.scheduleType) {
    case 'morning': return ['08:00']
    case 'afternoon': return ['14:00']
    case 'evening': return ['20:00']
    case 'night': return ['22:00']
    case 'twice': return ['08:00', '20:00']
    case 'three_times': return ['08:00', '14:00', '20:00']
    default: return ['08:00']
  }
}

const dateInputValue = (date?: Date): string => {
  if (!date) return ''
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return value.toISOString().slice(0, 10)
}

export const createDraft = (settings: DraftSettings): MedicineDraft => ({
  name: '',
  medicineForm: defaultMedicineForm,
  frequency: '',
  times: ['08:00'],
  dosage: '',
  sound: settings.soundChoice,
  volume: settings.volumeChoice,
  voiceMode: settings.defaultVoiceMode,
  voiceVolume: settings.voiceVolume,
  customVoiceVolume: settings.customVoiceVolume,
  voiceRate: settings.voiceRate,
  voicePitch: settings.voicePitch,
  androidVoiceName: settings.androidVoiceName,
  customVoicePath: settings.defaultVoiceMode === 'recorded' ? settings.customVoicePath : '',
  courseChoice: 'ongoing',
  customEndDate: '',
  trackStock: false,
  stockQuantity: '',
  unitsPerIntake: '1',
  refillReminderDays: '3',
  photoConfirmationMode: 'optional',
})

export const draftFromMedicine = (medicine: Medicine): MedicineDraft => {
  const medicineForm = medicine.medicineForm ?? defaultMedicineForm
  return {
    name: medicine.name,
    medicineForm,
    frequency: medicine.frequency,
    times: scheduleTimes(medicine),
    dosage: medicine.dosage || '',
    sound: medicine.reminderSound ?? 'classic',
    volume: medicine.reminderVolume ?? 'maximum',
    voiceMode: medicine.voiceMode ?? (medicine.voiceEnabled === false ? 'off' : 'android'),
    voiceVolume: medicine.voiceVolume ?? 'maximum',
    customVoiceVolume: medicine.customVoiceVolume ?? medicine.voiceVolume ?? 'maximum',
    voiceRate: medicine.voiceRate ?? 'slow',
    voicePitch: medicine.voicePitch ?? 1,
    androidVoiceName: medicine.androidVoiceName ?? '',
    customVoicePath: medicine.customVoicePath ?? '',
    courseChoice: medicine.endDate ? 'custom' : 'ongoing',
    customEndDate: dateInputValue(medicine.endDate),
    trackStock: medicine.stockQuantity !== undefined,
    stockQuantity: medicine.stockQuantity === undefined ? '' : String(medicine.stockQuantity),
    unitsPerIntake: String(medicine.unitsPerIntake ?? 1),
    refillReminderDays: String(medicine.refillReminderDays ?? 3),
    photoConfirmationMode: medicine.photoConfirmationMode ?? 'off',
  }
}

export const courseEndDate = (
  choice: CourseChoice,
  customDate: string
): Date | undefined => {
  if (choice === 'ongoing') return undefined
  if (choice === 'custom') {
    if (!customDate) return undefined
    const date = new Date(`${customDate}T23:59:59`)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  const days = Number(choice)
  if (!Number.isFinite(days) || days <= 0) return undefined
  const date = new Date()
  date.setDate(date.getDate() + days - 1)
  date.setHours(23, 59, 59, 999)
  return date
}