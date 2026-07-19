import { create } from 'zustand'
import { Medicine, Reminder } from '@/types'
import {
  generateRemindersForDay,
  getDelayTime,
  shouldShowReminder,
} from './generator'
import {
  cancelRemindersForMedicine,
  scheduleReminderForMedicine,
} from './reminder.logic'

interface RemindersStore {
  reminders: Reminder[]
  activeReminder: Reminder | null
  lastCheckTime: number
  platform: 'web' | 'android'
  generateFromMedicines: (medicines: Medicine[]) => void
  checkReminders: () => Reminder | null
  markTaken: (reminderId: string) => void
  markSkipped: (reminderId: string) => void
  delayReminder: (reminderId: string) => void
  setActiveReminder: (reminder: Reminder | null) => void
  setPlatform: (platform: 'web' | 'android') => void
  syncReminderForMedicine: (medicine: Medicine) => Promise<void>
  removeMedicineReminders: (medicineId: string) => Promise<void>
}

export const useRemindersStore = create<RemindersStore>((set, get) => ({
  reminders: [],
  activeReminder: null,
  lastCheckTime: 0,
  platform: 'web',

  generateFromMedicines: (medicines) => {
    const generated = generateRemindersForDay(medicines)

    set((state) => {
      const existing = new Map(state.reminders.map((reminder) => [reminder.id, reminder]))
      const reminders = generated.map((reminder) => {
        const previous = existing.get(reminder.id)
        if (!previous) return reminder

        return {
          ...reminder,
          status: previous.status,
          attempts: previous.attempts,
          nextRetryTime: previous.nextRetryTime,
          createdAt: previous.createdAt,
        }
      })

      const activeReminder = state.activeReminder
        ? reminders.find((reminder) => reminder.id === state.activeReminder?.id) || null
        : null

      return { reminders, activeReminder }
    })
  },

  checkReminders: () => {
    const state = get()
    const now = Date.now()

    if (now - state.lastCheckTime < 10 * 1000) {
      return state.activeReminder
    }

    set({ lastCheckTime: now })

    const reminder = state.reminders.find(
      (item) => item.status === 'pending' && shouldShowReminder(item)
    )

    set({ activeReminder: reminder || null })
    return reminder || null
  },

  markTaken: (reminderId) => {
    set((state) => ({
      reminders: state.reminders.map((reminder) =>
        reminder.id === reminderId
          ? {
              ...reminder,
              status: 'taken' as const,
              attempts: 0,
              nextRetryTime: undefined,
            }
          : reminder
      ),
      activeReminder: null,
    }))
  },

  markSkipped: (reminderId) => {
    set((state) => ({
      reminders: state.reminders.map((reminder) =>
        reminder.id === reminderId
          ? {
              ...reminder,
              status: 'skipped' as const,
              nextRetryTime: undefined,
            }
          : reminder
      ),
      activeReminder: null,
    }))
  },

  delayReminder: (reminderId) => {
    set((state) => ({
      reminders: state.reminders.map((reminder) =>
        reminder.id === reminderId
          ? {
              ...reminder,
              status: 'pending' as const,
              attempts: reminder.attempts + 1,
              nextRetryTime: getDelayTime(10),
            }
          : reminder
      ),
      activeReminder: null,
    }))
  },

  setActiveReminder: (activeReminder) => set({ activeReminder }),

  setPlatform: (platform) => set({ platform }),

  syncReminderForMedicine: async (medicine) => {
    await scheduleReminderForMedicine(medicine)
  },

  removeMedicineReminders: async (medicineId) => {
    await cancelRemindersForMedicine(medicineId)
    set((state) => ({
      reminders: state.reminders.filter(
        (reminder) => reminder.medicineId !== medicineId
      ),
      activeReminder:
        state.activeReminder?.medicineId === medicineId
          ? null
          : state.activeReminder,
    }))
  },
}))