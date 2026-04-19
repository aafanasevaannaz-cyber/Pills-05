'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/features/settings/store'
import { playSound, stopSound } from '@/features/sound/player'
import { speakText, stopSpeaking } from '@/features/sound/synthesizer'

interface ReminderScreenProps {
  medicineName: string
  dosage: string
  onTaken: () => void
  onSkipped: () => void
  onDelayed: () => void
}

export const ReminderScreen: React.FC<ReminderScreenProps> = ({
  medicineName,
  dosage,
  onTaken,
  onSkipped,
  onDelayed,
}) => {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled)
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled)

  useEffect(() => {
    // Воспроизвести звук
    if (soundEnabled) {
      playSound('/sounds/notification.wav', 1.0)
    }

    // Воспроизвести голос
    if (voiceEnabled) {
      speakText('Время принимать таблетки', 'ru-RU').catch((e) => {
        console.error('Voice failed:', e)
      })
    }

    return () => {
      stopSound()
      stopSpeaking()
    }
  }, [soundEnabled, voiceEnabled])

  const handleTaken = () => {
    stopSound()
    stopSpeaking()
    onTaken()
  }

  const handleSkipped = () => {
    stopSound()
    stopSpeaking()
    onSkipped()
  }

  const handleDelayed = () => {
    stopSound()
    stopSpeaking()
    onDelayed()
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-yellow-100 to-orange-100 flex items-center justify-center z-50 p-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6 animate-bounce">🔔</div>
        <h1 className="text-4xl font-bold mb-4">Время принять таблетки</h1>
        <p className="text-2xl font-semibold mb-2">{medicineName}</p>
        <p className="text-lg mb-8">{dosage}</p>

        <div className="flex flex-col gap-4">
          <Button
            variant="primary"
            className="w-full text-xl py-6"
            onClick={handleTaken}
            ariaLabel="Я принял лекарство"
          >
            ✓ Я ПРИНЯЛ
          </Button>
          <Button
            variant="secondary"
            className="w-full text-lg py-5"
            onClick={handleDelayed}
            ariaLabel="Отложить напоминание на 10 минут"
          >
            ⏱ Отложить на 10 мин
          </Button>
          <Button
            variant="danger"
            className="w-full text-lg py-5"
            onClick={handleSkipped}
            ariaLabel="Пропустить прием лекарства"
          >
            ✗ Пропустил
          </Button>
        </div>
      </div>
    </div>
  )
}
