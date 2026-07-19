import { handleVoiceError } from '@/lib/errorHandler'

export const speakText = async (text: string, lang = 'ru-RU'): Promise<void> => {
  if (typeof window === 'undefined') return

  try {
    const synth = window.speechSynthesis
    if (!synth) throw new Error('Speech synthesis is unavailable')
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.88
    utterance.pitch = 1
    utterance.volume = 1

    const russianVoice = synth
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('ru'))
    if (russianVoice) utterance.voice = russianVoice

    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve()
      utterance.onerror = (event) => {
        handleVoiceError(event.error || 'Unknown error')
        reject(new Error(event.error || 'Speech synthesis error'))
      }
      synth.speak(utterance)
    })
  } catch (error) {
    handleVoiceError(error)
  }
}

export const stopSpeaking = (): void => {
  try {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  } catch (error) {
    handleVoiceError(error)
  }
}

export const isSpeakingSupported = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.speechSynthesis)

export const getMedicineReminder = (medicineName: string, dosage?: string): string =>
  dosage
    ? `Пора принять лекарство ${medicineName}. Дозировка: ${dosage}.`
    : `Пора принять лекарство ${medicineName}.`
