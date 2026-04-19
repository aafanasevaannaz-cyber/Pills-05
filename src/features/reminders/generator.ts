import { Medicine } from '@/types'
import { Reminder } from '@/types'

export const generateRemindersForDay = (medicines: Medicine[]): Reminder[] => {
  const reminders: Reminder[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  medicines.forEach((medicine) => {
    // Пропускаем, если дата окончания уже прошла
    if (medicine.endDate && new Date(medicine.endDate) < today) {
      return
    }

    // Пропускаем, если каждый второй день и не сегодня
    if (medicine.frequency === 'every_other') {
      const daysSinceCreation = Math.floor(
        (today.getTime() - new Date(medicine.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceCreation % 2 !== 0) {
        return
      }
    }

    // Получаем времена приёма
    let times: string[] = []

    if (medicine.customTimes && medicine.customTimes.length > 0) {
      times = medicine.customTimes
    } else {
      times = getTimesForScheduleType(medicine.scheduleType)
    }

    // Создаём напоминания для каждого времени
    times.forEach((time) => {
      const [hours, minutes] = time.split(':').map(Number)
      const reminderTime = new Date(today)
      reminderTime.setHours(hours, minutes, 0, 0)

      reminders.push({
        id: `${medicine.id}-${time}`,
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
  const scheduledTime = new Date(reminder.scheduledTime)
  const timeDiff = now.getTime() - scheduledTime.getTime()

  // Показываем, если время пришло и еще не истекли 5 минут первого напоминания
  if (timeDiff >= 0 && timeDiff < 5 * 60 * 1000) {
    return true
  }

  // Показываем повторения: 5 мин + N*5 мин
  if (reminder.attempts > 0 && reminder.nextRetryTime) {
    const retryTime = new Date(reminder.nextRetryTime)
    const retryDiff = now.getTime() - retryTime.getTime()
    if (retryDiff >= 0 && retryDiff < 5 * 60 * 1000) {
      return true
    }
  }

  return false
}

export const getNextRetryTime = (reminder: Reminder): Date | null => {
  if (reminder.attempts >= 3) {
    return null // Больше нет повторений
  }

  const delayMs = reminder.attempts === 0 ? 5 * 60 * 1000 : 10 * 60 * 1000
  const nextTime = new Date()
  nextTime.setTime(nextTime.getTime() + delayMs)

  return nextTime
}

