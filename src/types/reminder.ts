export interface Reminder {
  id: string
  medicineId: string
  scheduledTime: Date
  status: 'pending' | 'shown' | 'taken' | 'skipped'
  attempts: number
  nextRetryTime?: Date | null
  createdAt: Date
}
