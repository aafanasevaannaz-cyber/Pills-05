import { Medicine, Reminder } from '@/types'

const getDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const generateRemindersForDay = (medicines: Medicine[]): Reminder[] => {
  const reminders: Reminder[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateKey = getDateKey(today)

  medicines.forEach((medicine) => {
    if (medicine.frequency === 'as_needed') return

    if (medicine.endDate && new Date(medicine.endDate) < today) return

    if (medicine.frequency === 'every_other') {
      const created = new Date(medicine.createdAt)
      created.setHours(0, 0, 0, 0)
      const daysSinceCreation = Math.floor(
        (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceCreation % 2 !== 0) return
    }

    const times =
      medicine.customTimes && medicine.customTimes.length > 0
        ? medicine.customTimes
        : getTimesForScheduleType(medicine.scheduleType)

    times.forEach((time) => {
      const [hours, minutes] = time.split(':').map(Number)
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return

      const reminderTime = new Date(today)
      reminderTime.setHours(hours, minutes, 0, 0)

      reminders.push({
        id: `${medicine.id}-${dateKey}-${time}`,
        medicineId: medicine.id,
        scheduledTime: reminderTime,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      })
    })
  })

  return reminders
}

function getTimesForScheduleType(scheduleType: string): string[] {
  const times: Record<string, string[]> = {
    morning: ['08:00'],
    afternoon: ['14:00'],
    evening: ['20:00'],
    night: ['22:00'],
    twice: ['08:00', '20:00'],
    three_times: ['08:00', '14:00', '20:00'],
  }

  return times[scheduleType] || []
}

export const shouldShowReminder = (reminder: Reminder): boolean => {
  const now = new Date()

  if (reminder.nextRetryTime) {
    const retryTime = new Date(reminder.nextRetryTime)
    const retryDiff = now.getTime() - retryTime.getTime()
    return retryDiff >= 0 && retryDiff < 5 * 60 * 1000
  }

  const scheduledTime = new Date(reminder.scheduledTime)
  const timeDiff = now.getTime() - scheduledTime.getTime()
  return timeDiff >= 0 && timeDiff < 5 * 60 * 1000
}

export const getDelayTime = (minutes = 10): Date =>
  new Date(Date.now() + minutes * 60 * 1000)
