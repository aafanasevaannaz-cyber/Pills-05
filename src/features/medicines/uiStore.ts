import { create } from 'zustand'
import type {
  ReminderSound,
  ReminderVolume,
  VoiceRate,
} from '@/features/sound/options'

export type AddMedicineStep = 1 | 2 | 3 | 4 | 5

interface AddMedicineUIStore {
  step: AddMedicineStep
  name: string
  frequency: string
  scheduleType: string
  customTime: string
  dosage: string
  soundChoice: ReminderSound
  volumeChoice: ReminderVolume
  voiceEnabled: boolean
  voiceRate: VoiceRate
  showDuplicate: boolean
  message: string

  setStep: (step: AddMedicineStep) => void
  setName: (name: string) => void
  setFrequency: (freq: string) => void
  setScheduleType: (type: string) => void
  setCustomTime: (time: string) => void
  setDosage: (dosage: string) => void
  setSoundChoice: (sound: ReminderSound) => void
  setVolumeChoice: (volume: ReminderVolume) => void
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceRate: (rate: VoiceRate) => void
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
  soundChoice: 'alarm',
  volumeChoice: 'maximum',
  voiceEnabled: true,
  voiceRate: 'slow',
  showDuplicate: false,
  message: '',

  setStep: (step) => set({ step }),
  setName: (name) => set({ name }),
  setFrequency: (freq) => set({ frequency: freq }),
  setScheduleType: (type) => set({ scheduleType: type }),
  setCustomTime: (time) => set({ customTime: time }),
  setDosage: (dosage) => set({ dosage }),
  setSoundChoice: (soundChoice) => set({ soundChoice }),
  setVolumeChoice: (volumeChoice) => set({ volumeChoice }),
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setVoiceRate: (voiceRate) => set({ voiceRate }),
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
      soundChoice: 'alarm',
      volumeChoice: 'maximum',
      voiceEnabled: true,
      voiceRate: 'slow',
      showDuplicate: false,
      message: '',
    }),
}))
