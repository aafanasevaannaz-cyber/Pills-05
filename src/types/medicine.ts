export type MedicineFrequency =
  | 'daily'
  | 'every_other'
  | 'as_needed'
  | 'morning'
  | 'twice'
  | 'three_times'
  | 'until_date'

export type MedicineSchedule =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'twice'
  | 'three_times'
  | 'custom'

export interface Medicine {
  id: string
  name: string
  dosage: string
  frequency: MedicineFrequency
  scheduleType: MedicineSchedule
  customTimes?: string[]
  endDate?: Date
  createdAt: Date
  notes?: string
}
