import { create } from 'zustand'
import {
  defaultReminderSound,
  defaultReminderVolume,
  defaultVoiceVolume,
  isReminderSound,
  isReminderVolume,
  isVoiceMode,
  isVoiceRate,
  type ReminderSound,
  type ReminderVolume,
  type VoiceMode,
  type VoiceRate,
} from '@/features/sound/options'

export type Theme = 'light' | 'dark' | 'high-contrast'
export type TextSize = 'small' | 'medium' | 'large' | 'extra-large'
export type Font = 'system' | 'serif' | 'mono'

export type PersistedSettings = {
  theme: Theme
  textSize: TextSize
  font: Font
  reduceAnimations: boolean
  soundEnabled: boolean
  soundChoice: ReminderSound
  volumeChoice: ReminderVolume
  voiceEnabled: boolean
  defaultVoiceMode: VoiceMode
  voiceVolume: ReminderVolume
  customVoiceVolume: ReminderVolume
  customVoicePath: string
  voiceRate: VoiceRate
  pushNotificationsEnabled: boolean
}

interface SettingsStore extends PersistedSettings {
  setTheme: (theme: Theme) => void
  setTextSize: (size: TextSize) => void
  setFont: (font: Font) => void
  setReduceAnimations: (reduce: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setSoundChoice: (sound: ReminderSound) => void
  setVolumeChoice: (volume: ReminderVolume) => void
  setVoiceEnabled: (enabled: boolean) => void
  setDefaultVoiceMode: (mode: VoiceMode) => void
  setVoiceVolume: (volume: ReminderVolume) => void
  setCustomVoiceVolume: (volume: ReminderVolume) => void
  setCustomVoicePath: (path: string) => void
  setVoiceRate: (rate: VoiceRate) => void
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
  soundChoice: defaultReminderSound,
  volumeChoice: defaultReminderVolume,
  voiceEnabled: true,
  defaultVoiceMode: 'android',
  voiceVolume: defaultVoiceVolume,
  customVoiceVolume: defaultVoiceVolume,
  customVoicePath: '',
  voiceRate: 'slow',
  pushNotificationsEnabled: true,
}

const validThemes: Theme[] = ['light', 'dark', 'high-contrast']
const validTextSizes: TextSize[] = ['small', 'medium', 'large', 'extra-large']
const validFonts: Font[] = ['system', 'serif', 'mono']

function normalizeSettings(value: unknown): PersistedSettings {
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as Record<string, unknown>
  const legacyFont = typeof candidate.font === 'string' ? candidate.font : 'system'
  const customVoicePath = typeof candidate.customVoicePath === 'string' ? candidate.customVoicePath : ''
  const requestedMode = isVoiceMode(candidate.defaultVoiceMode)
    ? candidate.defaultVoiceMode
    : candidate.voiceEnabled === false
      ? 'off'
      : customVoicePath
        ? 'recorded'
        : 'android'
  const defaultVoiceMode = requestedMode === 'recorded' && !customVoicePath ? 'android' : requestedMode

  return {
    theme: validThemes.includes(candidate.theme as Theme) ? (candidate.theme as Theme) : defaults.theme,
    textSize: validTextSizes.includes(candidate.textSize as TextSize)
      ? (candidate.textSize as TextSize)
      : defaults.textSize,
    font: validFonts.includes(legacyFont as Font) ? (legacyFont as Font) : 'system',
    reduceAnimations: candidate.reduceAnimations === true,
    soundEnabled: candidate.soundEnabled !== false,
    soundChoice: isReminderSound(candidate.soundChoice)
      ? candidate.soundChoice
      : defaultReminderSound,
    volumeChoice: isReminderVolume(candidate.volumeChoice)
      ? candidate.volumeChoice
      : defaultReminderVolume,
    voiceEnabled: defaultVoiceMode !== 'off',
    defaultVoiceMode,
    voiceVolume: isReminderVolume(candidate.voiceVolume)
      ? candidate.voiceVolume
      : defaultVoiceVolume,
    customVoiceVolume: isReminderVolume(candidate.customVoiceVolume)
      ? candidate.customVoiceVolume
      : defaultVoiceVolume,
    customVoicePath,
    voiceRate: isVoiceRate(candidate.voiceRate) ? candidate.voiceRate : defaults.voiceRate,
    pushNotificationsEnabled: candidate.pushNotificationsEnabled !== false,
  }
}

function snapshot(state: PersistedSettings): PersistedSettings {
  return {
    theme: state.theme,
    textSize: state.textSize,
    font: state.font,
    reduceAnimations: state.reduceAnimations,
    soundEnabled: state.soundEnabled,
    soundChoice: state.soundChoice,
    volumeChoice: state.volumeChoice,
    voiceEnabled: state.defaultVoiceMode !== 'off',
    defaultVoiceMode: state.defaultVoiceMode,
    voiceVolume: state.voiceVolume,
    customVoiceVolume: state.customVoiceVolume,
    customVoicePath: state.customVoicePath,
    voiceRate: state.voiceRate,
    pushNotificationsEnabled: state.pushNotificationsEnabled,
  }
}

function persist(settings: PersistedSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const update = (partial: Partial<PersistedSettings>) => {
    set(partial)
    persist(snapshot(get()))
  }

  return {
    ...defaults,
    setTheme: (theme) => update({ theme }),
    setTextSize: (textSize) => update({ textSize }),
    setFont: (font) => update({ font }),
    setReduceAnimations: (reduceAnimations) => update({ reduceAnimations }),
    setSoundEnabled: (soundEnabled) => update({ soundEnabled }),
    setSoundChoice: (soundChoice) => update({ soundChoice }),
    setVolumeChoice: (volumeChoice) => update({ volumeChoice }),
    setVoiceEnabled: (voiceEnabled) => update({
      voiceEnabled,
      defaultVoiceMode: voiceEnabled
        ? get().defaultVoiceMode === 'off' ? 'android' : get().defaultVoiceMode
        : 'off',
    }),
    setDefaultVoiceMode: (defaultVoiceMode) => update({
      defaultVoiceMode,
      voiceEnabled: defaultVoiceMode !== 'off',
    }),
    setVoiceVolume: (voiceVolume) => update({ voiceVolume }),
    setCustomVoiceVolume: (customVoiceVolume) => update({ customVoiceVolume }),
    setCustomVoicePath: (customVoicePath) => update({
      customVoicePath,
      defaultVoiceMode: customVoicePath ? get().defaultVoiceMode : get().defaultVoiceMode === 'recorded' ? 'android' : get().defaultVoiceMode,
      voiceEnabled: customVoicePath ? get().voiceEnabled : get().defaultVoiceMode === 'recorded' ? true : get().voiceEnabled,
    }),
    setVoiceRate: (voiceRate) => update({ voiceRate }),
    setPushNotificationsEnabled: (pushNotificationsEnabled) =>
      update({ pushNotificationsEnabled }),
    replaceSettings: (settings) => update(normalizeSettings({ ...get(), ...settings })),
    saveToDB: () => persist(snapshot(get())),
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
