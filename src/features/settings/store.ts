import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'high-contrast'
export type TextSize = 'small' | 'medium' | 'large' | 'extra-large'
export type Font = 'system' | 'inter' | 'roboto' | 'open-sans' | 'atkinson'

interface SettingsStore {
  theme: Theme
  textSize: TextSize
  font: Font
  reduceAnimations: boolean
  soundEnabled: boolean
  voiceEnabled: boolean
  pushNotificationsEnabled: boolean

  setTheme: (theme: Theme) => void
  setTextSize: (size: TextSize) => void
  setFont: (font: Font) => void
  setReduceAnimations: (reduce: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setVoiceEnabled: (enabled: boolean) => void
  setPushNotificationsEnabled: (enabled: boolean) => void

  saveToDB: () => void
  loadFromDB: () => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  theme: 'light',
  textSize: 'medium',
  font: 'system',
  reduceAnimations: false,
  soundEnabled: true,
  voiceEnabled: true,
  pushNotificationsEnabled: true,

  setTheme: (theme) => set({ theme }),
  setTextSize: (size) => set({ textSize: size }),
  setFont: (font) => set({ font }),
  setReduceAnimations: (reduce) => set({ reduceAnimations: reduce }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setPushNotificationsEnabled: (enabled) => set({ pushNotificationsEnabled: enabled }),

  saveToDB: () => {
    const state = get()
    if (typeof window !== 'undefined') {
      localStorage.setItem('settings', JSON.stringify({
        theme: state.theme,
        textSize: state.textSize,
        font: state.font,
        reduceAnimations: state.reduceAnimations,
        soundEnabled: state.soundEnabled,
        voiceEnabled: state.voiceEnabled,
        pushNotificationsEnabled: state.pushNotificationsEnabled,
      }))
    }
  },

  loadFromDB: () => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('settings')
      if (data) {
        try {
          const settings = JSON.parse(data)
          set({
            theme: settings.theme || 'light',
            textSize: settings.textSize || 'medium',
            font: settings.font || 'system',
            reduceAnimations: settings.reduceAnimations || false,
            soundEnabled: settings.soundEnabled !== false,
            voiceEnabled: settings.voiceEnabled !== false,
            pushNotificationsEnabled: settings.pushNotificationsEnabled !== false,
          })
        } catch (e) {
          console.log('Settings load error')
        }
      }
    }
  },
}))
