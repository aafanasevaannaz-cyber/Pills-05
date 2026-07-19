import type { Medicine } from '@/types'

const dosageLabels: Record<string, string> = {
  '1_tab': '1 таблетка',
  half_tab: '½ таблетки',
  '2_tab': '2 таблетки',
  mg: 'мг',
}

const scheduleLabels: Record<Medicine['scheduleType'], string> = {
  morning: 'Утром, 08:00',
  afternoon: 'Днём, 14:00',
  evening: 'Вечером, 20:00',
  night: 'На ночь, 22:00',
  twice: 'Утром и вечером',
  three_times: '3 раза в день',
  custom: 'По выбранному времени',
}

const frequencyLabels: Record<Medicine['frequency'], string> = {
  daily: 'Каждый день',
  every_other: 'Через день',
  as_needed: 'По необходимости',
}

export function formatDosage(value: string): string {
  const normalized = value.trim()
  return dosageLabels[normalized] ?? normalized.replaceAll('_', ' ')
}

export function formatFrequency(value: Medicine['frequency']): string {
  return frequencyLabels[value]
}

export function formatSchedule(medicine: Medicine): string {
  if (medicine.customTimes && medicine.customTimes.length > 0) {
    return medicine.customTimes.join(', ')
  }
  return scheduleLabels[medicine.scheduleType]
}

export function getMedicineTimes(medicine: Medicine): string[] {
  if (medicine.customTimes && medicine.customTimes.length > 0) {
    return medicine.customTimes
  }

  const times: Record<Medicine['scheduleType'], string[]> = {
    morning: ['08:00'],
    afternoon: ['14:00'],
    evening: ['20:00'],
    night: ['22:00'],
    twice: ['08:00', '20:00'],
    three_times: ['08:00', '14:00', '20:00'],
    custom: [],
  }

  return times[medicine.scheduleType]
}
