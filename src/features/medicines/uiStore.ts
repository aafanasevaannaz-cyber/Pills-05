import { create } from 'zustand'

export type AddMedicineStep = 1 | 2 | 3 | 4

interface AddMedicineUIStore {
  step: AddMedicineStep
  name: string
  frequency: string
  scheduleType: string
  customTime: string
  dosage: string
  showDuplicate: boolean
  message: string

  setStep: (step: AddMedicineStep) => void
  setName: (name: string) => void
  setFrequency: (freq: string) => void
  setScheduleType: (type: string) => void
  setCustomTime: (time: string) => void
  setDosage: (dosage: string) => void
  setShowDuplicate: (show: boolean) => void
  setMessage: (msg: string) => void
  reset: () => void
}

export const useAddMedicineUI = create<AddMedicineUIStore>((set) => ({
  step: 1,
  name: '',
  frequency: '',
  scheduleType: '',
  customTime: '',
  dosage: '',
  showDuplicate: false,
  message: '',

  setStep: (step) => set({ step }),
  setName: (name) => set({ name }),
  setFrequency: (freq) => set({ frequency: freq }),
  setScheduleType: (type) => set({ scheduleType: type }),
  setCustomTime: (time) => set({ customTime: time }),
  setDosage: (dosage) => set({ dosage }),
  setShowDuplicate: (show) => set({ showDuplicate: show }),
  setMessage: (msg) => set({ message: msg }),

  reset: () =>
    set({
      step: 1,
      name: '',
      frequency: '',
      scheduleType: '',
      customTime: '',
      dosage: '',
      showDuplicate: false,
      message: '',
    }),
}))
