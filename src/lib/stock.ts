import type { Medicine } from '@/types'

export function getIntakesPerScheduledDay(medicine: Medicine): number {
  if (medicine.customTimes && medicine.customTimes.length > 0) return medicine.customTimes.length
  const counts: Record<Medicine['scheduleType'], number> = {
    morning: 1,
    afternoon: 1,
    evening: 1,
    night: 1,
    twice: 2,
    three_times: 3,
    custom: 1,
  }
  return counts[medicine.scheduleType] ?? 1
}

export function getAverageUnitsPerDay(medicine: Medicine): number {
  if (medicine.frequency === 'as_needed') return 0
  const units = Number(medicine.unitsPerIntake)
  if (!Number.isFinite(units) || units <= 0) return 0
  const intakes = getIntakesPerScheduledDay(medicine)
  return medicine.frequency === 'every_other' ? (units * intakes) / 2 : units * intakes
}

export function getEstimatedStockDays(medicine: Medicine): number | null {
  const stock = Number(medicine.stockQuantity)
  const dailyUse = getAverageUnitsPerDay(medicine)
  if (!Number.isFinite(stock) || stock < 0 || dailyUse <= 0) return null
  return stock / dailyUse
}

export function getRefillReminderDate(medicine: Medicine, from = new Date()): Date | null {
  const daysLeft = getEstimatedStockDays(medicine)
  if (daysLeft === null) return null
  const remindBefore = Math.max(0, Number(medicine.refillReminderDays ?? 3))
  const daysUntilReminder = Math.max(0, Math.floor(daysLeft - remindBefore))
  const date = new Date(from)
  date.setDate(date.getDate() + daysUntilReminder)
  date.setHours(10, 0, 0, 0)
  if (date.getTime() <= from.getTime() + 60_000) date.setTime(from.getTime() + 90_000)
  return date
}

export function isRefillSoon(medicine: Medicine): boolean {
  const daysLeft = getEstimatedStockDays(medicine)
  if (daysLeft === null) return false
  return daysLeft <= Math.max(0, Number(medicine.refillReminderDays ?? 3))
}

export function formatStockDays(medicine: Medicine): string | null {
  const daysLeft = getEstimatedStockDays(medicine)
  if (daysLeft === null) return null
  if (daysLeft < 1) return 'запас заканчивается сегодня'
  const rounded = Math.max(1, Math.floor(daysLeft))
  return `примерно на ${rounded} дн.`
}
