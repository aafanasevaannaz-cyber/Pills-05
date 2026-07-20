'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/features/settings/store'
import {
  previewReminderSound,
  previewReminderVoice,
  stopReminderPreview,
} from '@/features/sound/nativeAudio'
import { getReminderSoundOption } from '@/features/sound/options'

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
  const soundChoice = useSettingsStore((state) => state.soundChoice)
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled)
  const voiceRate = useSettingsStore((state) => state.voiceRate)

  useEffect(() => {
    let voiceTimer: number | undefined

    if (soundEnabled) {
      void previewReminderSound(soundChoice, 1).catch((error) => {
        console.error('Reminder sound failed:', error)
      })
    }

    if (voiceEnabled) {
      const delay = soundEnabled ? getReminderSoundOption(soundChoice).previewDelayMs : 100
      voiceTimer = window.setTimeout(() => {
        void previewReminderVoice(medicineName, dosage, voiceRate).catch((error) => {
          console.error('Voice reminder failed:', error)
        })
      }, delay)
    }

    return () => {
      if (voiceTimer) window.clearTimeout(voiceTimer)
      void stopReminderPreview()
    }
  }, [dosage, medicineName, soundChoice, soundEnabled, voiceEnabled, voiceRate])

  const finish = (action: () => void) => {
    void stopReminderPreview()
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
