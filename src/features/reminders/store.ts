import { create } from 'zustand'
import { Reminder } from '@/types'
import { Medicine } from '@/types'
import {
  generateRemindersForDay,
  shouldShowReminder,
  getNextRetryTime,
} from './generator'
import { scheduleReminderForMedicine, cancelRemindersForMedicine } from './reminder.logic'

interface RemindersStore {
  reminders: Reminder[]
  activeReminder: Reminder | null
  lastCheckTime: number
  platform: 'web' | 'android'

  // Генерировать напоминания из лекарств
  generateFromMedicines: (medicines: Medicine[]) => void

  // Проверить, есть ли напоминания для показа
  checkReminders: () => Reminder | null

  // Отметить как принято
  markTaken: (reminderId: string) => void

  // Отметить как пропущено
  markSkipped: (reminderId: string) => void

  // Отложить на 10 минут
  delayReminder: (reminderId: string) => void

  // Обновить активное напоминание
  setActiveReminder: (reminder: Reminder | null) => void

  // Установить платформу
  setPlatform: (platform: 'web' | 'android') => void

  // Синхронизировать напоминания для лекарства (web + native)
  syncReminderForMedicine: (medicine: Medicine) => Promise<void>

  // Отменить все напоминания для лекарства
  removeMedicineReminders: (medicineId: string) => Promise<void>
}

export const useRemindersStore = create<RemindersStore>((set, get) => ({
  reminders: [],
  activeReminder: null,
  lastCheckTime: 0,
  platform: 'web',

  generateFromMedicines: (medicines) => {
    const generated = generateRemindersForDay(medicines)
    set({ reminders: generated })
  },

  checkReminders: () => {
    const state = get()
    const now = Date.now()

    // Проверяем не чаще, чем раз в 30 секунд
    if (now - state.lastCheckTime < 30 * 1000) {
      return state.activeReminder
    }

    set({ lastCheckTime: now })

    // Ищем первое напоминание, которое нужно показать
    for (const reminder of state.reminders) {
      if (reminder.status !== 'pending') continue
      if (shouldShowReminder(reminder)) {
        set({ activeReminder: reminder })
        return reminder
      }
    }

    // Проверяем, нужны ли повторения для существующего напоминания
    if (state.activeReminder) {
      const active = state.reminders.find(
        (r) => r.id === state.activeReminder?.id
      )
      if (active && shouldShowReminder(active)) {
        return active
      }
    }

    set({ activeReminder: null })
    return null
  },

  markTaken: (reminderId) => {
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === reminderId ? { ...r, status: 'taken' as const, attempts: 0 } : r
      ),
      activeReminder: null,
    }))
  },

  markSkipped: (reminderId) => {
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === reminderId
          ? {
              ...r,
              status: 'skipped' as const,
              attempts: r.attempts + 1,
              nextRetryTime:
                r.attempts < 2 ? getNextRetryTime(r) : undefined,
            }
          : r
      ),
      activeReminder: null,
    }))
  },

  delayReminder: (reminderId) => {
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === reminderId
          ? {
              ...r,
              attempts: r.attempts + 1,
              nextRetryTime:
                r.attempts < 2 ? getNextRetryTime(r) : undefined,
            }
          : r
      ),
      activeReminder: null,
    }))
  },

  setActiveReminder: (reminder) => {
    set({ activeReminder: reminder })
  },

  setPlatform: (platform) => {
    set({ platform })
  },

  syncReminderForMedicine: async (medicine) => {
    // Синхронизировать напоминания (web + native)
    await scheduleReminderForMedicine(medicine)
  },

  removeMedicineReminders: async (medicineId) => {
    // Отменить все напоминания (web + native)
    await cancelRemindersForMedicine(medicineId)
    // Также удалить из локального списка
    set((state) => ({
      reminders: state.reminders.filter((r) => r.medicineId !== medicineId),
      activeReminder:
        state.activeReminder?.medicineId === medicineId
          ? null
          : state.activeReminder,
    }))
  },
}))

