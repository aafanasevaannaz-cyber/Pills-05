import { create } from 'zustand'
import { Reminder } from '@/types'

interface RemindersStore {
  reminders: Reminder[]
  addReminder: (reminder: Reminder) => void
  removeReminder: (id: string) => void
  updateReminder: (id: string, updates: Partial<Reminder>) => void
  getReminder: (id: string) => Reminder | null
}

export const useRemindersStore = create<RemindersStore>((set, get) => ({
  reminders: [],

  addReminder: (reminder) =>
    set((state) => ({
      reminders: [...state.reminders, reminder],
    })),

  removeReminder: (id) =>
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    })),

  updateReminder: (id, updates) =>
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),

  getReminder: (id) => {
    const state = get()
    return state.reminders.find((r) => r.id === id) || null
  },
}))
