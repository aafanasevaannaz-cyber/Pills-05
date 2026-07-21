'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { VolumeSlider } from '@/components/ui/VolumeSlider'
import { useSettingsStore } from '@/features/settings/store'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import {
  cancelCustomVoiceRecording,
  openAndroidReminderSoundSettings,
  previewCustomVoice,
  previewFullReminder,
  previewReminderSound,
  previewReminderVoice,
  startCustomVoiceRecording,
  stopCustomVoiceRecording,
  stopReminderPreview,
} from '@/features/sound/nativeAudio'
import {
  reminderSoundOptions,
  type ReminderSound,
  type ReminderVolume,
  type VoiceMode,
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
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingRef = useRef(false)
  const recordingKey = useRef(`shared-default-${Date.now()}`)

  useEffect(() => {
    useSettingsStore.getState().loadFromDB()
    useMedicinesStore.getState().loadFromDB()
    return () => {
      void stopReminderPreview()
      if (recordingRef.current) void cancelCustomVoiceRecording()
    }
  }, [])

  useEffect(() => {
    recordingRef.current = recording
    if (!recording) {
      setRecordingSeconds(0)
      return
    }
    const timer = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  const run = async (action: () => Promise<void>, success: string) => {
    if (busy || recording) return
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

  const changeVolume = (volumeChoice: ReminderVolume) => {
    settings.setVolumeChoice(volumeChoice)
    settings.setSoundEnabled(true)
    void ensureReminderChannel(settings.soundChoice, volumeChoice).catch((error) => {
      console.error('Default alarm channel update failed:', error)
    })
  }

  const startSharedRecording = async () => {
    if (recording || busy) return
    setStatus('')
    try {
      await stopReminderPreview()
      await startCustomVoiceRecording(recordingKey.current)
      setRecording(true)
      setStatus('Запись идёт. Произнесите общую фразу и нажмите «Остановить и сохранить».')
    } catch (error) {
      console.error('Shared voice recording start failed:', error)
      setStatus('Не удалось начать запись. Разрешите приложению доступ к микрофону.')
    }
  }

  const stopSharedRecording = async () => {
    if (!recording) return
    try {
      const result = await stopCustomVoiceRecording()
      setRecording(false)
      settings.setCustomVoicePath(result.path)
      settings.setDefaultVoiceMode('recorded')
      const seconds = Math.max(1, Math.round(result.durationMs / 1000))
      setStatus(`Общая запись сохранена: ${seconds} сек. Её можно выбирать для новых лекарств.`)
    } catch (error) {
      console.error('Shared voice recording stop failed:', error)
      setRecording(false)
      await cancelCustomVoiceRecording()
      setStatus('Запись не сохранилась. Произнесите фразу не короче одной секунды.')
    }
  }

  const removeSharedVoice = () => {
    settings.setCustomVoicePath('')
    settings.setDefaultVoiceMode('android')
    setStatus('Общая запись убрана из настроек. Уже сохранённые лекарства не изменены.')
  }

  const selectVoiceMode = (mode: VoiceMode) => {
    if (mode === 'recorded' && !settings.customVoicePath) {
      setStatus('Сначала запишите общую фразу.')
      return
    }
    settings.setDefaultVoiceMode(mode)
    setStatus(mode === 'off'
      ? 'Для новых лекарств голос будет выключен.'
      : mode === 'recorded'
        ? 'Для новых лекарств выбрана общая запись.'
        : 'Для новых лекарств выбран русский голос Android.')
  }

  const testNotification = async () => {
    await run(async () => {
      const scheduled = await scheduleTestNotification(
        settings.soundChoice,
        settings.volumeChoice,
        {
          voiceMode: settings.defaultVoiceMode,
          voiceVolume: settings.voiceVolume,
          customVoiceVolume: settings.customVoiceVolume,
          customVoicePath: settings.customVoicePath,
          voiceRate: settings.voiceRate,
        }
      )
      if (!scheduled) {
        throw new Error('Android открыл разрешение на точные напоминания. Включите его, вернитесь и нажмите проверку ещё раз.')
      }
    }, 'Через 3 секунды придёт системное уведомление с выбранным сигналом и голосом.')
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
          <h1 className="app-title">Звук и общий голос</h1>
          <p className="app-subtitle">Стандартные настройки, которые подставляются в новое лекарство</p>
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
            disabled={busy || recording || (settings.defaultVoiceMode === 'recorded' && !settings.customVoicePath)}
            onClick={() => void run(
              () => previewFullReminder({
                sound: settings.soundChoice,
                volume: settings.volumeChoice,
                voiceEnabled: settings.defaultVoiceMode !== 'off',
                voiceMode: settings.defaultVoiceMode,
                voiceVolume: settings.voiceVolume,
                customVoiceVolume: settings.customVoiceVolume,
                customVoicePath: settings.customVoicePath,
                voiceRate: settings.voiceRate,
                medicineName: sampleMedicine,
                dosage: sampleDosage,
              }),
              'Пример напоминания воспроизведён.'
            )}
          >
            ▶ Послушать всё напоминание
          </Button>
          <Button variant="quiet" className="ui-button--full" onClick={() => void stopReminderPreview()}>
            Остановить звук
          </Button>
        </Card>

        <Card>
          <h2 className="section-title">Выберите сигнал</h2>
          <p className="muted">Нажмите на вариант — он сразу прозвучит.</p>
          <div className="sound-option-grid" role="radiogroup" aria-label="Сигнал напоминания">
            {reminderSoundOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                role="radio"
                aria-checked={settings.soundChoice === option.id}
                className={`sound-option${settings.soundChoice === option.id ? ' is-selected' : ''}`}
                disabled={busy || recording}
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
          <VolumeSlider
            id="default-signal-volume"
            label="Громкость сигнала"
            value={settings.volumeChoice}
            onChange={changeVolume}
            onPreview={(next) => previewReminderSound(settings.soundChoice, next)}
            help="Эта громкость будет предложена для каждого нового лекарства."
          />
        </Card>

        <Card>
          <h2 className="section-title">Что говорить после сигнала</h2>
          <div className="choice-grid" role="radiogroup" aria-label="Общий голос для новых лекарств">
            {[
              { id: 'android', title: 'Русский голос Android', description: 'Назовёт лекарство и дозировку' },
              { id: 'recorded', title: 'Моя общая запись', description: settings.customVoicePath ? 'Использовать сохранённую фразу' : 'Сначала запишите фразу ниже' },
              { id: 'off', title: 'Без голоса', description: 'Только сигнал и вибрация' },
            ].map((option) => (
              <label className={`choice${settings.defaultVoiceMode === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="default-voice-mode"
                  checked={settings.defaultVoiceMode === option.id}
                  onChange={() => selectVoiceMode(option.id as VoiceMode)}
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
          <h2 className="section-title">Русский голос Android</h2>
          <VolumeSlider
            id="default-android-voice-volume"
            label="Громкость русского голоса"
            value={settings.voiceVolume}
            onChange={settings.setVoiceVolume}
            onPreview={(next) => previewReminderVoice(sampleMedicine, sampleDosage, settings.voiceRate, next)}
          />
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
        </Card>

        <Card>
          <h2 className="section-title">Общая запись своим голосом</h2>
          <p className="muted">Например: «Пора принять лекарство. Проверьте название на экране».</p>
          <VolumeSlider
            id="default-recorded-voice-volume"
            label="Громкость общей записи"
            value={settings.customVoiceVolume}
            onChange={settings.setCustomVoiceVolume}
            disabled={recording}
            onPreview={settings.customVoicePath
              ? (next) => previewCustomVoice(settings.customVoicePath, next)
              : undefined}
            previewHint={settings.customVoicePath
              ? 'Двигайте бегунок — общая запись прозвучит сразу.'
              : 'Сначала запишите общую фразу.'}
          />
          {recording ? (
            <div className="page-stack">
              <div className="status-strip status-strip--danger" role="status">● Запись идёт: {recordingSeconds} сек.</div>
              <Button variant="primary" className="ui-button--full" onClick={() => void stopSharedRecording()}>
                ■ Остановить и сохранить
              </Button>
            </div>
          ) : settings.customVoicePath ? (
            <div className="page-stack">
              <div className="status-strip status-strip--success" role="status">✓ Общая запись сохранена</div>
              <Button variant="secondary" className="ui-button--full" disabled={busy} onClick={() => void run(
                () => previewCustomVoice(settings.customVoicePath, settings.customVoiceVolume),
                'Общая запись воспроизведена.'
              )}>
                ▶ Послушать общую запись
              </Button>
              <Button variant="secondary" className="ui-button--full" disabled={busy} onClick={() => void startSharedRecording()}>
                🎙 Записать новую общую фразу
              </Button>
              <Button variant="quiet" className="ui-button--full" disabled={busy} onClick={removeSharedVoice}>
                Не предлагать эту запись новым лекарствам
              </Button>
            </div>
          ) : (
            <Button variant="primary" className="ui-button--full" disabled={busy} onClick={() => void startSharedRecording()}>
              🎙 Записать общую фразу
            </Button>
          )}
        </Card>

        <Card>
          <h2 className="section-title">Системное уведомление Android</h2>
          <p className="muted">Эта проверка показывает сигнал и выбранный голос при свёрнутом приложении.</p>
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
            <Button variant="primary" className="ui-button--full" disabled={busy || recording} onClick={() => void testNotification()}>
              🔔 Проверить через 3 секунды
            </Button>
            {isNativeNotificationsAvailable() && (
              <Button variant="secondary" className="ui-button--full" disabled={busy || recording} onClick={() => void openAndroidSettings()}>
                Открыть системные настройки этого сигнала
              </Button>
            )}
            <Button variant="quiet" className="ui-button--full" disabled={busy || recording} onClick={() => void run(rescheduleExisting, 'Существующие лекарства перепланированы с их сохранёнными настройками.')}>
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
