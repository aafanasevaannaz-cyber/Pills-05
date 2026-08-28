export interface HistoryEntry {
  id: string
  medicineId: string
  takenAt: Date
  scheduledFor: Date
  status: 'taken' | 'skipped' | 'late'
  notes?: string
  photoUri?: string
}