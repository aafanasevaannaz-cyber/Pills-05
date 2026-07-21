'use client'

import React, { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/features/settings/store'
import {
  previewReminderSound,
  previewReminderVoice,
  stopReminderPreview,
} from '@/features/sound/nativeAudio'
import {
  getReminderSoundOption,
  type ReminderSound,
  type ReminderVolume,
  type VoiceRate,
} from '@/features/sound/options'

interface ReminderStopPlugin {
  stopAll(): Promise<{ stopped: boolean }>
}

const NativeReminderStop = registerPlugin<ReminderStopPlugin>('ReminderStop')

const stopAllReminderAudio = async () => {
  await stopReminderPreview()
  if (Capacitor.isNativePlatform()) {
    await NativeReminderStop.stopAll().catch((error) => {
      console.error('Background reminder stop failed:', error)
    })
  }
}

interface ReminderScreenProps {
  medicineName: string
  dosage: string
  scheduledTime?: string
  reminderSound: ReminderSound
  reminderVolume: ReminderVolume
  medicineVoiceEnabled: boolean
  medicineVoiceRate: VoiceRate
  onTaken: () => void
  onSkipped: () => void
  onDelayed: () => void
}

export const ReminderScreen: React.FC<ReminderScreenProps> = ({
  medicineName,
  dosage,
  scheduledTime,
  reminderSound,
  reminderVolume,
  medicineVoiceEnabled,
  medicineVoiceRate,
  onTaken,
  onSkipped,
  onDelayed,
}) => {
  const soundEnabled = useSettingsStore((state) => state.soundEnabled)

  useEffect(() => {
    let voiceTimer: number | undefined
    const nativeAndroid = Capacitor.isNativePlatform()

    // На Android сигнал уже воспроизводит системное уведомление. Не запускаем его
    // второй раз из окна приложения, иначе получается утомительный двойной писк.
    if (soundEnabled && !nativeAndroid) {
      void previewReminderSound(reminderSound, reminderVolume).catch((error) => {
        console.error('Reminder sound failed:', error)
      })
    }

    // На Android точный нативный будильник произносит фразу один раз даже при
    // закрытом приложении. Голос WebView нужен только в браузере.
    if (medicineVoiceEnabled && !nativeAndroid) {
      const delay = soundEnabled ? getReminderSoundOption(reminderSound).previewDelayMs : 100
      voiceTimer = window.setTimeout(() => {
        void previewReminderVoice(medicineName, dosage, medicineVoiceRate).catch((error) => {
          console.error('Voice reminder failed:', error)
        })
      }, delay)
    }

    return () => {
      if (voiceTimer) window.clearTimeout(voiceTimer)
      void stopAllReminderAudio()
    }
  }, [
    dosage,
    medicineName,
    medicineVoiceEnabled,
    medicineVoiceRate,
    reminderSound,
    reminderVolume,
    soundEnabled,
  ])

  const finish = async (action: () => void) => {
    try {
      await stopAllReminderAudio()
    } finally {
      action()
    }
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
          <Button variant="primary" className="ui-button--full" onClick={() => void finish(onTaken)}>
            ✓ Принято
          </Button>
          <Button variant="secondary" className="ui-button--full" onClick={() => void stopAllReminderAudio()}>
            ■ Остановить звук
          </Button>
          <Button variant="secondary" className="ui-button--full" onClick={() => void finish(onDelayed)}>
            Напомнить через 10 минут
          </Button>
          <Button variant="danger" className="ui-button--full" onClick={() => void finish(onSkipped)}>
            Не принято
          </Button>
        </div>
      </div>
    </section>
  )
}
