'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/features/settings/store'
import { playReminderChime, stopSound } from '@/features/sound/player'
import { getMedicineReminder, speakText, stopSpeaking } from '@/features/sound/synthesizer'

interface ReminderScreenProps {
  medicineName: string
  dosage: string
  scheduledTime?: string
  onTaken: () => void
  onSkipped: () => void
  onDelayed: () => void
}

export const ReminderScreen: React.FC<ReminderScreenProps> = ({
  medicineName,
  dosage,
  scheduledTime,
  onTaken,
  onSkipped,
  onDelayed,
}) => {
  const soundEnabled = useSettingsStore((state) => state.soundEnabled)
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled)

  useEffect(() => {
    if (soundEnabled) void playReminderChime(1)
    if (voiceEnabled) {
      void speakText(getMedicineReminder(medicineName, dosage), 'ru-RU').catch((error) => {
        console.error('Voice reminder failed:', error)
      })
    }

    return () => {
      stopSound()
      stopSpeaking()
    }
  }, [dosage, medicineName, soundEnabled, voiceEnabled])

  const finish = (action: () => void) => {
    stopSound()
    stopSpeaking()
    action()
  }

  return (
    <section className="reminder-overlay" role="dialog" aria-modal="true" aria-labelledby="reminder-title">
      <div className="reminder-overlay__panel ui-card reminder-hero">
        <div className="reminder-bell" aria-hidden="true">🔔</div>
        <p className="reminder-kicker">ПОРА ПРИНЯТЬ ЛЕКАРСТВО</p>
        <h1 className="reminder-name" id="reminder-title">{medicineName}</h1>
        <div className="reminder-meta">
          {scheduledTime && <span><strong>Время:</strong> {scheduledTime}</span>}
          <span><strong>Дозировка:</strong> {dosage}</span>
        </div>
        <div className="reminder-actions">
          <Button variant="primary" className="ui-button--full" onClick={() => finish(onTaken)}>
            ✓ Принято
          </Button>
          <Button variant="secondary" className="ui-button--full" onClick={() => finish(onDelayed)}>
            Напомнить через 10 минут
          </Button>
          <Button variant="danger" className="ui-button--full" onClick={() => finish(onSkipped)}>
            Не принято
          </Button>
        </div>
      </div>
    </section>
  )
}
