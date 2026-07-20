import { create } from 'zustand'
import type { Medicine } from '@/types'
import { formatDosage } from '@/lib/formatMedicine'
import {
  defaultReminderSound,
  defaultReminderVolume,
  defaultVoiceVolume,
  isReminderSound,
  isReminderVolume,
  isVoiceMode,
  isVoiceRate,
} from '@/features/sound/options'

interface MedicinesStore {
  medicines: Medicine[]
  addMedicine: (medicine: Medicine) => void
  removeMedicine: (id: string) => void
  updateMedicine: (id: string, updates: Partial<Medicine>) => void
  getMedicine: (id: string) => Medicine | null
  findByName: (name: string) => Medicine | null
  saveToDB: () => void
  loadFromDB: () => void
}

const persistMedicines = (medicines: Medicine[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('medicines', JSON.stringify(medicines))
}

const reviveMedicine = (medicine: Medicine): Medicine => {
  const voiceMode = isVoiceMode(medicine.voiceMode)
    ? medicine.voiceMode
    : medicine.voiceEnabled === false
      ? 'off'
      : medicine.customVoicePath
        ? 'recorded'
        : 'android'

  const androidVoiceVolume = isReminderVolume(medicine.voiceVolume)
    ? medicine.voiceVolume
    : defaultVoiceVolume
  const customVoiceVolume = isReminderVolume(medicine.customVoiceVolume)
    ? medicine.customVoiceVolume
    : androidVoiceVolume

  return {
    ...medicine,
    dosage: formatDosage(String(medicine.dosage ?? '')),
    reminderSound: isReminderSound(medicine.reminderSound)
      ? medicine.reminderSound
      : defaultReminderSound,
    reminderVolume: isReminderVolume(medicine.reminderVolume)
      ? medicine.reminderVolume
      : defaultReminderVolume,
    voiceEnabled: voiceMode !== 'off',
    voiceMode,
    voiceVolume: voiceMode === 'recorded' ? customVoiceVolume : androidVoiceVolume,
    customVoiceVolume,
    voiceRate: isVoiceRate(medicine.voiceRate) ? medicine.voiceRate : 'slow',
    customVoicePath: typeof medicine.customVoicePath === 'string'
      ? medicine.customVoicePath
      : '',
    createdAt: new Date(medicine.createdAt),
    endDate: medicine.endDate ? new Date(medicine.endDate) : undefined,
  }
}

export const useMedicinesStore = create<MedicinesStore>((set, get) => ({
  medicines: [],

  addMedicine: (medicine) =>
    set((state) => {
      const medicines = [...state.medicines, reviveMedicine(medicine)]
      persistMedicines(medicines)
      return { medicines }
    }),

  removeMedicine: (id) =>
    set((state) => {
      const medicines = state.medicines.filter((medicine) => medicine.id !== id)
      persistMedicines(medicines)
      return { medicines }
    }),

  updateMedicine: (id, updates) =>
    set((state) => {
      const medicines = state.medicines.map((medicine) =>
        medicine.id === id ? reviveMedicine({ ...medicine, ...updates }) : medicine
      )
      persistMedicines(medicines)
      return { medicines }
    }),

  getMedicine: (id) => get().medicines.find((medicine) => medicine.id === id) || null,

  findByName: (name) => {
    const normalized = name.toLowerCase().trim()
    if (!normalized) return null
    return (
      get().medicines.find((medicine) =>
        medicine.name.toLowerCase().includes(normalized)
      ) || null
    )
  },

  saveToDB: () => persistMedicines(get().medicines),

  loadFromDB: () => {
    if (typeof window === 'undefined') return

    try {
      const data = localStorage.getItem('medicines')
      if (!data) {
        set({ medicines: [] })
        return
      }

      const parsed = JSON.parse(data)
      if (!Array.isArray(parsed)) {
        set({ medicines: [] })
        return
      }

      const medicines = parsed.map(reviveMedicine)
      set({ medicines })
      persistMedicines(medicines)
    } catch (error) {
      console.error('Medicine load error:', error)
      set({ medicines: [] })
    }
  },
}))
