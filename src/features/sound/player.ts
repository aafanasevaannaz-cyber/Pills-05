import { handleSoundError } from '@/lib/errorHandler'

let audioElement: HTMLAudioElement | null = null

export const playSound = async (url: string, volume: number = 1.0): Promise<void> => {
  if (typeof window === 'undefined') return

  try {
    if (!audioElement) {
      audioElement = new Audio()
    }

    audioElement.src = url
    audioElement.volume = Math.min(1.0, Math.max(0, volume))

    await audioElement.play()
  } catch (e) {
    handleSoundError(e)
  }
}

export const stopSound = (): void => {
  try {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
  } catch (e) {
    handleSoundError(e)
  }
}

export const setVolume = (volume: number): void => {
  try {
    if (audioElement) {
      audioElement.volume = Math.min(1.0, Math.max(0, volume))
    }
  } catch (e) {
    handleSoundError(e)
  }
}

export const getDefaultSoundUrl = (): string => {
  // Используем встроенный звук уведомления (будет создан отдельно)
  return '/sounds/notification.wav'
}
