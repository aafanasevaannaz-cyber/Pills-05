import { useRemindersStore } from './store'
import { useMedicinesStore } from '@/features/medicines/store'

let schedulerId: NodeJS.Timeout | null = null

export const startScheduler = () => {
  if (schedulerId) return

  const checkAndUpdate = () => {
    // Генерируем напоминания из текущего списка лекарств
    const medicines = useMedicinesStore.getState().medicines
    useRemindersStore.getState().generateFromMedicines(medicines)

    // Проверяем, есть ли новые напоминания для показа
    useRemindersStore.getState().checkReminders()
  }

  // Проверяем каждые 30 секунд
  checkAndUpdate() // Первая проверка сразу
  schedulerId = setInterval(checkAndUpdate, 30 * 1000)
}

export const stopScheduler = () => {
  if (schedulerId) {
    clearInterval(schedulerId)
    schedulerId = null
  }
}

