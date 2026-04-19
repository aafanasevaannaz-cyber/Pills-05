import { create } from 'zustand'
import { Medicine } from '@/types'

interface MedicinesStore {
  medicines: Medicine[]
  addMedicine: (medicine: Medicine) => void
  removeMedicine: (id: string) => void
  updateMedicine: (id: string, updates: Partial<Medicine>) => void
  getMedicine: (id: string) => Medicine | null
}

export const useMedicinesStore = create<MedicinesStore>((set, get) => ({
  medicines: [],

  addMedicine: (medicine) =>
    set((state) => ({
      medicines: [...state.medicines, medicine],
    })),

  removeMedicine: (id) =>
    set((state) => ({
      medicines: state.medicines.filter((m) => m.id !== id),
    })),

  updateMedicine: (id, updates) =>
    set((state) => ({
      medicines: state.medicines.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  getMedicine: (id) => {
    const state = get()
    return state.medicines.find((m) => m.id === id) || null
  },
}))
