import { create } from 'zustand'
import { HistoryEntry } from '@/types'

interface HistoryStore {
  history: HistoryEntry[]
  addEntry: (entry: HistoryEntry) => void
  removeEntry: (id: string) => void
  getEntries: () => HistoryEntry[]
  getLastEntry: (medicineId: string) => HistoryEntry | null
  saveToDB: () => void
  loadFromDB: () => void
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],

  addEntry: (entry) =>
    set((state) => ({
      history: [...state.history, entry],
    })),

  removeEntry: (id) =>
    set((state) => ({
      history: state.history.filter((e) => e.id !== id),
    })),

  getEntries: () => {
    const state = get()
    return state.history
  },

  getLastEntry: (medicineId) => {
    const state = get()
    const entries = state.history.filter((e) => e.medicineId === medicineId)
    return entries.length > 0 ? entries[entries.length - 1] : null
  },

  saveToDB: () => {
    const state = get()
    if (typeof window !== 'undefined') {
      localStorage.setItem('history', JSON.stringify(state.history))
    }
  },

  loadFromDB: () => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('history')
      if (data) {
        set({ history: JSON.parse(data) })
      }
    }
  },
}))
