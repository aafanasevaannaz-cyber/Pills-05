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
  addMedicine: (medicine: Medicine) => Medicine
  removeMedicine: (id: string) => void
  updateMedicine: (id: string, updates: Partial<Medicine>) => Medicine | null
  consumeStock: (id: string) => Medicine | null
  getMedicine: (id: string) => Medicine | null
  findByName: (name: string) => Medicine | null
  saveToDB: () => void
  loadFromDB: () => void
}

const persistMedicines = (medicines: Medicine[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('medicines', JSON.stringify(medicines))
}

const positiveNumber = (value: unknown): number | undefined => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

const nonNegativeNumber = (value: unknown): number | undefined => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

const safePitch = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0.7, Math.min(1.3, number)) : 1
}

const normalizeTimes = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const times = Array.from(new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => /^([01]\d|2[0-3]):[0-5]\d$/.test(item))))
    .sort()
  return times.length > 0 ? times : undefined
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
    dosage: formatDosage(String(medicine.dosage ?? '1 таблетка')),
    customTimes: normalizeTimes(medicine.customTimes),
    paused: medicine.paused === true,
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
    androidVoiceName: typeof medicine.androidVoiceName === 'string' ? medicine.androidVoiceName : '',
    voicePitch: safePitch(medicine.voicePitch),
    customVoicePath: typeof medicine.customVoicePath === 'string' ? medicine.customVoicePath : '',
    createdAt: new Date(medicine.createdAt),
    endDate: medicine.endDate ? new Date(medicine.endDate) : undefined,
    stockQuantity: nonNegativeNumber(medicine.stockQuantity),
    unitsPerIntake: positiveNumber(medicine.unitsPerIntake),
    refillReminderDays: nonNegativeNumber(medicine.refillReminderDays),
    stockUpdatedAt: medicine.stockUpdatedAt ? new Date(medicine.stockUpdatedAt) : undefined,
  }
}

export const useMedicinesStore = create<MedicinesStore>((set, get) => ({
  medicines: [],

  addMedicine: (medicine) => {
    const revived = reviveMedicine(medicine)
    set((state) => {
      const medicines = [...state.medicines, revived]
      persistMedicines(medicines)
      return { medicines }
    })
    return revived
  },

  removeMedicine: (id) => set((state) => {
    const medicines = state.medicines.filter((medicine) => medicine.id !== id)
    persistMedicines(medicines)
    return { medicines }
  }),

  updateMedicine: (id, updates) => {
    let result: Medicine | null = null
    set((state) => {
      const medicines = state.medicines.map((medicine) => {
        if (medicine.id !== id) return medicine
        result = reviveMedicine({ ...medicine, ...updates })
        return result
      })
      persistMedicines(medicines)
      return { medicines }
    })
    return result
  },

  consumeStock: (id) => {
    let result: Medicine | null = null
    set((state) => {
      const medicines = state.medicines.map((medicine) => {
        if (medicine.id !== id || medicine.stockQuantity === undefined) return medicine
        const units = positiveNumber(medicine.unitsPerIntake) ?? 1
        const updated = reviveMedicine({
          ...medicine,
          stockQuantity: Math.max(0, medicine.stockQuantity - units),
          stockUpdatedAt: new Date(),
        })
        result = updated
        return updated
      })
      persistMedicines(medicines)
      return { medicines }
    })
    return result
  },

  getMedicine: (id) => get().medicines.find((medicine) => medicine.id === id) || null,

  findByName: (name) => {
    const normalized = name.toLowerCase().trim()
    if (!normalized) return null
    return get().medicines.find((medicine) => medicine.name.toLowerCase().includes(normalized)) || null
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
