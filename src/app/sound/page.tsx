'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useSettingsStore } from '@/features/settings/store'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import {
  openAndroidReminderSoundSettings,
  previewFullReminder,
  previewReminderSound,
  previewReminderVoice,
  stopReminderPreview,
} from '@/features/sound/nativeAudio'
import {
  reminderSoundOptions,
  reminderVolumeOptions,
  type ReminderSound,
  type ReminderVolume,
  type VoiceRate,
} from '@/features/sound/options'
import {
  ensureReminderChannel,
  isNativeNotificationsAvailable,
  scheduleTestNotification,
} from '@/features/reminders/nativeNotifications.logic'

const sampleMedicine = 'Зенон'
const sampleDosage = '1 таблетка'

export default function SoundSettingsPage() {
  const settings = useSettingsStore()
  const medicines = useMedicinesStore((state) => state.medicines)
  const syncReminderForMedicine = useRemindersStore((state) => state.syncReminderForMedicine)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    useMedicinesStore.getState().loadFromDB()
    return () => {
      void stopReminderPreview()
    }
  }, [])

  const run = async (action: () => Promise<void>, success: string) => {
    if (busy) return
    setBusy(true)
    setStatus('')
    try {
      await action()
      setStatus(success)
    } catch (error) {
      console.error('Sound settings action failed:', error)
      setStatus(error instanceof Error ? error.message : 'Не удалось выполнить проверку звука.')
    } finally {
      setBusy(false)
    }
  }

  const rescheduleExisting = async () => {
    for (const medicine of medicines) {
      await syncReminderForMedicine(medicine).catch((error) => {
        console.error(`Reminder reschedule failed for ${medicine.id}:`, error)
      })
    }
  }

  const changeSound = async (soundChoice: ReminderSound) => {
    settings.setSoundChoice(soundChoice)
    settings.setSoundEnabled(true)
    setBusy(true)
    setStatus('Сохраняем сигнал…')
    try {
      await ensureReminderChannel(soundChoice, settings.volumeChoice)
      await previewReminderSound(soundChoice, settings.volumeChoice)
      setStatus('Сигнал выбран как стандартный для новых лекарств.')
    } catch (error) {
      console.error('Sound choice update failed:', error)
      setStatus('Сигнал сохранён, но воспроизвести пример не удалось.')
    } finally {
      setBusy(false)
    }
  }

  const changeVolume = async (volumeChoice: ReminderVolume) => {
    settings.setVolumeChoice(volumeChoice)
    settings.setSoundEnabled(true)
    setBusy(true)
    setStatus('Сохраняем громкость…')
    try {
      await ensureReminderChannel(settings.soundChoice, volumeChoice)
      await previewReminderSound(settings.soundChoice, volumeChoice)
      setStatus('Громкость выбрана как стандартная для новых лекарств.')
    } catch (error) {
      console.error('Volume choice update failed:', error)
      setStatus('Громкость сохранена, но воспроизвести пример не удалось.')
    } finally {
      setBusy(false)
    }
  }

  const testNotification = async () => {
    await run(async () => {
      const scheduled = await scheduleTestNotification(
        settings.soundChoice,
        settings.volumeChoice
      )
      if (!scheduled) {
        throw new Error('Android открыл разрешение на точные напоминания. Включите его, вернитесь и нажмите проверку ещё раз.')
      }
    }, 'Через 3 секунды придёт системное уведомление через громкость будильника.')
  }

  const openAndroidSettings = async () => {
    await run(async () => {
      await ensureReminderChannel(settings.soundChoice, settings.volumeChoice)
      const opened = await openAndroidReminderSoundSettings(
        settings.soundChoice,
        settings.volumeChoice
      )
      if (!opened) throw new Error('Системные настройки доступны только в Android-приложении.')
    }, 'Открыты системные настройки канала уведомлений.')
  }

  return (
    <div className="app-page sound-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Звук напоминания</h1>
          <p className="app-subtitle">Стандартные настройки для новых лекарств</p>
        </div>
        <Link href="/settings" className="ui-button ui-button--secondary">Назад</Link>
      </header>

      <div className="page-stack">
        <Card className="sound-preview-card ui-card--warning">
          <p className="reminder-kicker">ПРИМЕР НАПОМИНАНИЯ</p>
          <h2 className="sound-preview-name">{sampleMedicine}</h2>
          <p className="sound-preview-dose">Дозировка: {sampleDosage}</p>
          <Button
            variant="primary"
            className="ui-button--full sound-main-preview"
            disabled={busy}
            onClick={() => void run(
              () => previewFullReminder({
                sound: settings.soundChoice,
                volume: settings.volumeChoice,
                voiceEnabled: settings.voiceEnabled,
                voiceRate: settings.voiceRate,
                medicineName: sampleMedicine,
                dosage: sampleDosage,
              }),
              settings.voiceEnabled
                ? 'Сигнал и голос воспроизведены через громкость будильника.'
                : 'Сигнал воспроизведён. Голосовая озвучка выключена.'
            )}
          >
            ▶ Послушать всё напоминание
          </Button>
        </Card>

        <Card>
          <h2 className="section-title">Выберите сигнал</h2>
          <div className="sound-option-grid" role="radiogroup" aria-label="Сигнал напоминания">
            {reminderSoundOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                role="radio"
                aria-checked={settings.soundChoice === option.id}
                className={`sound-option${settings.soundChoice === option.id ? ' is-selected' : ''}`}
                disabled={busy}
                onClick={() => void changeSound(option.id)}
              >
                <span className="sound-option__icon" aria-hidden="true">
                  {option.id === 'gentle' ? '♪' : option.id === 'alarm' ? '⏰' : '🔔'}
                </span>
                <span className="sound-option__text">
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </span>
                <span className="sound-option__check" aria-hidden="true">
                  {settings.soundChoice === option.id ? '✓' : '▶'}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="section-title">Громкость сигнала</h2>
          <p className="muted">Сигнал и голос используют аудиопоток будильника Android.</p>
          <div className="choice-grid" role="radiogroup" aria-label="Громкость напоминания">
            {reminderVolumeOptions.map((option) => (
              <label className={`choice${settings.volumeChoice === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="default-volume"
                  checked={settings.volumeChoice === option.id}
                  onChange={() => void changeVolume(option.id)}
                />
                <span className="choice__text">
                  <span className="choice__title">{option.title}</span>
                  <span className="choice__description">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="section-title">Озвучка голосом</h2>
          <label className={`choice${settings.voiceEnabled ? ' is-selected' : ''}`}>
            <input
              type="checkbox"
              checked={settings.voiceEnabled}
              onChange={(event) => settings.setVoiceEnabled(event.target.checked)}
            />
            <span className="choice__text">
              <span className="choice__title">Назвать лекарство и дозировку</span>
              <span className="choice__description">Голос воспроизводится через громкость будильника</span>
            </span>
          </label>

          <div className="choice-grid" role="radiogroup" aria-label="Скорость голоса">
            {[
              { id: 'slow', title: 'Медленно и отчётливо', description: 'Удобнее для пожилого человека' },
              { id: 'normal', title: 'Обычная скорость', description: 'Быстрее произносит напоминание' },
            ].map((option) => (
              <label className={`choice${settings.voiceRate === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="voice-rate"
                  checked={settings.voiceRate === option.id}
                  onChange={() => settings.setVoiceRate(option.id as VoiceRate)}
                />
                <span className="choice__text">
                  <span className="choice__title">{option.title}</span>
                  <span className="choice__description">{option.description}</span>
                </span>
              </label>
            ))}
          </div>

          <Button
            variant="secondary"
            className="ui-button--full"
            disabled={busy || !settings.voiceEnabled}
            onClick={() => void run(
              () => previewReminderVoice(sampleMedicine, sampleDosage, settings.voiceRate),
              'Голосовая озвучка воспроизведена через громкость будильника.'
            )}
          >
            🗣 Послушать только голос
          </Button>
        </Card>

        <Card>
          <h2 className="section-title">Системное уведомление Android</h2>
          <p className="muted">
            Эта проверка показывает сигнал при свёрнутом или закрытом приложении.
          </p>
          <div className="page-stack">
            <label className={`choice${settings.pushNotificationsEnabled ? ' is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={settings.pushNotificationsEnabled}
                onChange={(event) => settings.setPushNotificationsEnabled(event.target.checked)}
              />
              <span className="choice__text">
                <span className="choice__title">Уведомления включены</span>
                <span className="choice__description">Показывать напоминания при закрытом приложении</span>
              </span>
            </label>
            <Button variant="primary" className="ui-button--full" disabled={busy} onClick={() => void testNotification()}>
              🔔 Проверить через 3 секунды
            </Button>
            {isNativeNotificationsAvailable() && (
              <Button variant="secondary" className="ui-button--full" disabled={busy} onClick={() => void openAndroidSettings()}>
                Открыть системные настройки этого сигнала
              </Button>
            )}
            <Button variant="quiet" className="ui-button--full" disabled={busy} onClick={() => void run(rescheduleExisting, 'Существующие лекарства перепланированы с их сохранёнными настройками.')}>
              Обновить будущие напоминания
            </Button>
          </div>
        </Card>

        {status && (
          <div className={`status-strip${status.startsWith('Не удалось') || status.startsWith('Android открыл') ? ' status-strip--warning' : ''}`} role="status">
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
