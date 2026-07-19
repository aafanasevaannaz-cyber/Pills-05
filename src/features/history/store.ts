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

const persistHistory = (history: HistoryEntry[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('history', JSON.stringify(history))
}

const reviveEntry = (entry: HistoryEntry): HistoryEntry => ({
  ...entry,
  takenAt: new Date(entry.takenAt),
  scheduledFor: new Date(entry.scheduledFor),
})

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],

  addEntry: (entry) =>
    set((state) => {
      if (state.history.some((item) => item.id === entry.id)) return state
      const history = [...state.history, reviveEntry(entry)]
      persistHistory(history)
      return { history }
    }),

  removeEntry: (id) =>
    set((state) => {
      const history = state.history.filter((entry) => entry.id !== id)
      persistHistory(history)
      return { history }
    }),

  getEntries: () => get().history,

  getLastEntry: (medicineId) => {
    const entries = get().history.filter((entry) => entry.medicineId === medicineId)
    return entries.length > 0 ? entries[entries.length - 1] : null
  },

  saveToDB: () => persistHistory(get().history),

  loadFromDB: () => {
    if (typeof window === 'undefined') return

    try {
      const data = localStorage.getItem('history')
      if (!data) {
        set({ history: [] })
        return
      }

      const parsed = JSON.parse(data)
      if (!Array.isArray(parsed)) {
        set({ history: [] })
        return
      }

      const unique = new Map<string, HistoryEntry>()
      parsed.forEach((entry: HistoryEntry) => unique.set(entry.id, reviveEntry(entry)))
      set({ history: Array.from(unique.values()) })
    } catch (error) {
      console.error('History load error:', error)
      set({ history: [] })
    }
  },
}))