import { handleSoundError } from '@/lib/errorHandler'

let audioElement: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null

const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume))

export const playSound = async (url: string, volume = 1): Promise<void> => {
  if (typeof window === 'undefined') return

  try {
    if (!audioElement) audioElement = new Audio()
    audioElement.src = url
    audioElement.volume = clampVolume(volume)
    audioElement.loop = false
    await audioElement.play()
  } catch (error) {
    handleSoundError(error)
  }
}

export const playReminderChime = async (volume = 1): Promise<void> => {
  if (typeof window === 'undefined') return

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) {
      await playSound('/sounds/notification.wav', volume)
      return
    }

    if (audioContext) await audioContext.close().catch(() => undefined)
    audioContext = new AudioContextClass()
    if (audioContext.state === 'suspended') await audioContext.resume()

    const master = audioContext.createGain()
    master.gain.value = clampVolume(volume) * 0.32
    master.connect(audioContext.destination)

    const now = audioContext.currentTime
    ;[0, 0.42, 0.84].forEach((offset) => {
      const oscillator = audioContext!.createOscillator()
      const gain = audioContext!.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, now + offset)
      oscillator.frequency.exponentialRampToValueAtTime(660, now + offset + 0.22)
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(1, now + offset + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(now + offset)
      oscillator.stop(now + offset + 0.3)
    })
  } catch (error) {
    handleSoundError(error)
    await playSound('/sounds/notification.wav', volume)
  }
}

export const stopSound = (): void => {
  try {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    if (audioContext) {
      void audioContext.close().catch(() => undefined)
      audioContext = null
    }
  } catch (error) {
    handleSoundError(error)
  }
}

export const setVolume = (volume: number): void => {
  try {
    if (audioElement) audioElement.volume = clampVolume(volume)
  } catch (error) {
    handleSoundError(error)
  }
}

export const getDefaultSoundUrl = (): string => '/sounds/notification.wav'
