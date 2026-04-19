let audioElement: HTMLAudioElement | null = null

export const playSound = async (url: string, volume: number = 1.0): Promise<void> => {
  if (typeof window === 'undefined') return

  try {
    if (!audioElement) {
      audioElement = new Audio()
    }

    audioElement.src = url
    audioElement.volume = Math.min(1.0, Math.max(0, volume))

    return audioElement.play()
  } catch (e) {
    console.error('Failed to play sound:', e)
  }
}

export const stopSound = (): void => {
  if (audioElement) {
    audioElement.pause()
    audioElement.currentTime = 0
  }
}

export const setVolume = (volume: number): void => {
  if (audioElement) {
    audioElement.volume = Math.min(1.0, Math.max(0, volume))
  }
}

export const getDefaultSoundUrl = (): string => {
  // Используем встроенный звук уведомления (будет создан отдельно)
  return '/sounds/notification.wav'
}
