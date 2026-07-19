import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'high-contrast'
export type TextSize = 'small' | 'medium' | 'large' | 'extra-large'
export type Font = 'system' | 'serif' | 'mono'

export type PersistedSettings = {
  theme: Theme
  textSize: TextSize
  font: Font
  reduceAnimations: boolean
  soundEnabled: boolean
  voiceEnabled: boolean
  pushNotificationsEnabled: boolean
}

interface SettingsStore extends PersistedSettings {
  setTheme: (theme: Theme) => void
  setTextSize: (size: TextSize) => void
  setFont: (font: Font) => void
  setReduceAnimations: (reduce: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setVoiceEnabled: (enabled: boolean) => void
  setPushNotificationsEnabled: (enabled: boolean) => void
  replaceSettings: (settings: Partial<PersistedSettings>) => void
  saveToDB: () => void
  loadFromDB: () => void
}

const STORAGE_KEY = 'settings'

const defaults: PersistedSettings = {
  theme: 'light',
  textSize: 'medium',
  font: 'system',
  reduceAnimations: false,
  soundEnabled: true,
  voiceEnabled: true,
  pushNotificationsEnabled: true,
}

const validThemes: Theme[] = ['light', 'dark', 'high-contrast']
const validTextSizes: TextSize[] = ['small', 'medium', 'large', 'extra-large']
const validFonts: Font[] = ['system', 'serif', 'mono']

function normalizeSettings(value: unknown): PersistedSettings {
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as Record<string, unknown>
  const legacyFont = typeof candidate.font === 'string' ? candidate.font : 'system'

  return {
    theme: validThemes.includes(candidate.theme as Theme) ? (candidate.theme as Theme) : defaults.theme,
    textSize: validTextSizes.includes(candidate.textSize as TextSize)
      ? (candidate.textSize as TextSize)
      : defaults.textSize,
    font: validFonts.includes(legacyFont as Font) ? (legacyFont as Font) : 'system',
    reduceAnimations: candidate.reduceAnimations === true,
    soundEnabled: candidate.soundEnabled !== false,
    voiceEnabled: candidate.voiceEnabled !== false,
    pushNotificationsEnabled: candidate.pushNotificationsEnabled !== false,
  }
}

function persist(settings: PersistedSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const update = (partial: Partial<PersistedSettings>) => {
    set(partial)
    const state = get()
    persist({
      theme: state.theme,
      textSize: state.textSize,
      font: state.font,
      reduceAnimations: state.reduceAnimations,
      soundEnabled: state.soundEnabled,
      voiceEnabled: state.voiceEnabled,
      pushNotificationsEnabled: state.pushNotificationsEnabled,
    })
  }

  return {
    ...defaults,
    setTheme: (theme) => update({ theme }),
    setTextSize: (textSize) => update({ textSize }),
    setFont: (font) => update({ font }),
    setReduceAnimations: (reduceAnimations) => update({ reduceAnimations }),
    setSoundEnabled: (soundEnabled) => update({ soundEnabled }),
    setVoiceEnabled: (voiceEnabled) => update({ voiceEnabled }),
    setPushNotificationsEnabled: (pushNotificationsEnabled) =>
      update({ pushNotificationsEnabled }),
    replaceSettings: (settings) => update(normalizeSettings({ ...get(), ...settings })),
    saveToDB: () => {
      const state = get()
      persist({
        theme: state.theme,
        textSize: state.textSize,
        font: state.font,
        reduceAnimations: state.reduceAnimations,
        soundEnabled: state.soundEnabled,
        voiceEnabled: state.voiceEnabled,
        pushNotificationsEnabled: state.pushNotificationsEnabled,
      })
    },
    loadFromDB: () => {
      if (typeof window === 'undefined') return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const settings = raw ? normalizeSettings(JSON.parse(raw)) : defaults
        set(settings)
        persist(settings)
      } catch (error) {
        console.error('Settings load error:', error)
        set(defaults)
        persist(defaults)
      }
    },
  }
})
