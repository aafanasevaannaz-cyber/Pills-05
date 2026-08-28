'use client'

import React, { useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/features/settings/store'
import { blisterPhotoSrc, captureBlisterPhoto } from '@/features/photo/blisterPhoto'
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
import type { PhotoConfirmationMode } from '@/types'

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
  photoConfirmationMode: PhotoConfirmationMode
  onTaken: (photoUri?: string) => void
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
  photoConfirmationMode,
  onTaken,
  onSkipped,
  onDelayed,
}) => {
  const soundEnabled = useSettingsStore((state) => state.soundEnabled)
  const [photoUri, setPhotoUri] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    let voiceTimer: number | undefined
    const nativeAndroid = Capacitor.isNativePlatform()

    if (soundEnabled && !nativeAndroid) {
      void previewReminderSound(reminderSound, reminderVolume).catch((error) => {
        console.error('Reminder sound failed:', error)
      })
    }

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

  const takePhoto = async () => {
    if (photoBusy) return
    setPhotoBusy(true)
    setPhotoError('')
    try {
      await stopAllReminderAudio()
      const uri = await captureBlisterPhoto()
      if (uri) setPhotoUri(uri)
      else setPhotoError('Фото не сделано. Можно открыть камеру ещё раз.')
    } catch (error) {
      console.error('Blister photo capture failed:', error)
      setPhotoError('Не удалось сделать фото. Проверьте доступ к камере и попробуйте ещё раз.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const confirmTaken = async () => {
    if (photoConfirmationMode === 'required' && !photoUri) {
      setPhotoError('Для этого лекарства сначала сделайте новое фото блистера.')
      return
    }
    await finish(() => onTaken(photoUri || undefined))
  }

  return (
    <section className="reminder-overlay" role="dialog" aria-modal="true" aria-labelledby="reminder-title">
      <div className="reminder-overlay__panel ui-card reminder-hero">
        <div className="reminder-bell" aria-hidden="true">🔔</div>
        <p className="reminder-kicker">ПОРА ПРИНЯТЬ ЛЕКАРСТВО</p>
        <h1 className="reminder-name" id="reminder-title">{medicineName}</h1>
        <div className="reminder-meta">
          {scheduledTime && <span><strong>Время:</strong> {scheduledTime}</span>}
          {dosage && <span><strong>Дозировка:</strong> {dosage}</span>}
        </div>

        {photoConfirmationMode !== 'off' && (
          <div className="page-stack" style={{ width: '100%' }}>
            <div className="status-strip" role="status">
              {photoConfirmationMode === 'required'
                ? 'Для отметки «Принято» нужно новое фото блистера.'
                : 'Можно сфотографировать блистер — потом фото будет видно в истории приёма.'}
            </div>
            {photoUri && (
              <img
                src={blisterPhotoSrc(photoUri)}
                alt="Фото блистера для этого приёма"
                style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 16 }}
              />
            )}
            <Button variant="secondary" className="ui-button--full" disabled={photoBusy} onClick={() => void takePhoto()}>
              {photoBusy ? 'Открываем камеру…' : photoUri ? '📷 Переснять блистер' : '📷 Сделать фото блистера'}
            </Button>
            <p className="muted" style={{ margin: 0 }}>Фото берётся только из камеры в момент приёма, не из галереи.</p>
            {photoError && <div className="status-strip status-strip--warning" role="alert">{photoError}</div>}
          </div>
        )}

        <div className="reminder-actions">
          <Button
            variant="primary"
            className="ui-button--full"
            disabled={photoBusy || (photoConfirmationMode === 'required' && !photoUri)}
            onClick={() => void confirmTaken()}
          >
            ✓ {photoConfirmationMode === 'required' && !photoUri ? 'Сначала сделайте фото' : 'Принято'}
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