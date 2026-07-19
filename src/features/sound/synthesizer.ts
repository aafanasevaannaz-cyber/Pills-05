import { handleVoiceError } from '@/lib/errorHandler'

// Web Speech API для синтеза речи

export const speakText = async (text: string, lang: string = 'ru-RU'): Promise<void> => {
  if (typeof window === 'undefined') return

  try {
    const synth = window.speechSynthesis

    if (!synth) {
      throw new Error('Web Speech API not available')
    }

    // Остановить предыдущее воспроизведение
    if (synth.speaking) {
      synth.cancel()
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve()
      utterance.onerror = (event) => {
        handleVoiceError(event.error || 'Unknown error')
        reject(new Error(event.error || 'Speech synthesis failed'))
      }
      synth.speak(utterance)
    })
  } catch (error) {
    handleVoiceError(error)
  }
}

export const stopSpeaking = (): void => {
  try {
    if (typeof window === 'undefined') return
    window.speechSynthesis?.cancel()
  } catch (error) {
    handleVoiceError(error)
  }
}

export const isSpeakingSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!window.speechSynthesis
}

export const getMedicineReminder = (_medicineName: string): string => {
  return 'Время принимать таблетки'
}
