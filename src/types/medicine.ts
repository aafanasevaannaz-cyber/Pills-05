export interface Medicine {
  id: string
  name: string
  dosage: string
  frequency: 'daily' | 'every_other' | 'as_needed'
  scheduleType: 'morning' | 'evening' | 'twice' | 'three_times' | 'custom'
  customTimes?: string[]
  endDate?: Date
  createdAt: Date
  notes?: string
}
