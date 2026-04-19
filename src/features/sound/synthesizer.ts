// Web Speech API для синтеза речи

export const speakText = async (text: string, lang: string = 'ru-RU'): Promise<void> => {
  if (typeof window === 'undefined') return

  const synth = window.speechSynthesis

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
    utterance.onerror = () => reject()
    synth.speak(utterance)
  })
}

export const stopSpeaking = (): void => {
  if (typeof window === 'undefined') return
  window.speechSynthesis.cancel()
}

export const isSpeakingSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!window.speechSynthesis
}

export const getMedicineReminder = (medicineName: string): string => {
  return 'Время принимать таблетки'
}
