import { create } from 'zustand'
import type {
  ReminderSound,
  ReminderVolume,
  VoiceMode,
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
  voiceMode: VoiceMode
  voiceVolume: ReminderVolume
  voiceRate: VoiceRate
  customVoicePath: string
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
  setVoiceMode: (mode: VoiceMode) => void
  setVoiceVolume: (volume: ReminderVolume) => void
  setVoiceRate: (rate: VoiceRate) => void
  setCustomVoicePath: (path: string) => void
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
  voiceMode: 'android',
  voiceVolume: 'maximum',
  voiceRate: 'slow',
  customVoicePath: '',
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
  setVoiceEnabled: (voiceEnabled) => set((state) => ({
    voiceEnabled,
    voiceMode: voiceEnabled
      ? state.voiceMode === 'off' ? 'android' : state.voiceMode
      : 'off',
  })),
  setVoiceMode: (voiceMode) => set({
    voiceMode,
    voiceEnabled: voiceMode !== 'off',
  }),
  setVoiceVolume: (voiceVolume) => set({ voiceVolume }),
  setVoiceRate: (voiceRate) => set({ voiceRate }),
  setCustomVoicePath: (customVoicePath) => set({ customVoicePath }),
  setShowDuplicate: (showDuplicate) => set({ showDuplicate }),
  setMessage: (message) => set({ message }),

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
      voiceMode: 'android',
      voiceVolume: 'maximum',
      voiceRate: 'slow',
      customVoicePath: '',
      showDuplicate: false,
      message: '',
    }),
}))
