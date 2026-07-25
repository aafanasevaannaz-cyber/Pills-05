'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AndroidVoicePicker } from '@/components/ui/AndroidVoicePicker'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { VolumeSlider } from '@/components/ui/VolumeSlider'
import { useMedicinesStore } from '@/features/medicines/store'
import {
  ensureReminderChannel,
  isNativeNotificationsAvailable,
  scheduleTestNotification,
} from '@/features/reminders/nativeNotifications.logic'
import { useRemindersStore } from '@/features/reminders/store'
import { useSettingsStore } from '@/features/settings/store'
import {
  cancelCustomVoiceRecording,
  listAndroidVoices,
  openAndroidReminderSoundSettings,
  previewCustomVoice,
  previewFullReminder,
  previewReminderSound,
  previewReminderVoice,
  startCustomVoiceRecording,
  stopCustomVoiceRecording,
  type AndroidVoiceOption,
} from '@/features/sound/nativeAudio'
import { stopAllReminderAudio } from '@/features/sound/stopAllAudio'
import {
  reminderSoundOptions,
  type ReminderSound,
  type ReminderVolume,
  type VoiceMode,
  type VoiceRate,
} from '@/features/sound/options'

const sampleMedicine = 'по расписанию'
const sampleDosage = '1 таблетка'

export default function SoundSettingsPage() {
  const settings = useSettingsStore()
  const medicines = useMedicinesStore((state) => state.medicines)
  const syncReminder = useRemindersStore((state) => state.syncReminderForMedicine)
  const [voices, setVoices] = useState<AndroidVoiceOption[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingRef = useRef(false)
  const recordingKey = useRef(`shared-default-${Date.now()}`)

  useEffect(() => {
    useSettingsStore.getState().loadFromDB()
    useMedicinesStore.getState().loadFromDB()
    void listAndroidVoices().then(setVoices)
    return () => {
      void stopAllReminderAudio()
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
      setStatus(error instanceof Error ? error.message : 'Не удалось выполнить проверку.')
    } finally {
      setBusy(false)
    }
  }

  const changeSound = async (sound: ReminderSound) => {
    settings.setSoundChoice(sound)
    settings.setSoundEnabled(true)
    await stopAllReminderAudio()
    await previewReminderSound(sound, settings.volumeChoice).catch((error) => {
      console.error('Sound preview failed:', error)
      setStatus('Сигнал выбран, но воспроизвести его не удалось.')
    })
  }

  const changeVolume = (volume: ReminderVolume) => {
    settings.setVolumeChoice(volume)
    settings.setSoundEnabled(true)
    void ensureReminderChannel(settings.soundChoice, volume)
  }

  const selectVoiceMode = (mode: VoiceMode) => {
    if (mode === 'recorded' && !settings.customVoicePath) {
      setStatus('Сначала запишите общую фразу.')
      return
    }
    settings.setDefaultVoiceMode(mode)
  }

  const startRecording = async () => {
    try {
      await stopAllReminderAudio()
      await startCustomVoiceRecording(recordingKey.current)
      setRecording(true)
      setStatus('Запись идёт. Произнесите фразу и нажмите «Остановить и сохранить».')
    } catch (error) {
      console.error('Shared recording start failed:', error)
      setStatus('Не удалось начать запись. Разрешите доступ к микрофону.')
    }
  }

  const finishRecording = async () => {
    try {
      const result = await stopCustomVoiceRecording()
      setRecording(false)
      settings.setCustomVoicePath(result.path)
      settings.setDefaultVoiceMode('recorded')
      setStatus(`Общая запись сохранена: ${Math.max(1, Math.round(result.durationMs / 1000))} сек.`)
    } catch (error) {
      console.error('Shared recording stop failed:', error)
      setRecording(false)
      await cancelCustomVoiceRecording()
      setStatus('Запись не сохранилась. Запишите фразу не короче секунды.')
    }
  }

  const previewAll = () => run(
    () => previewFullReminder({
      sound: settings.soundChoice,
      volume: settings.volumeChoice,
      voiceMode: settings.defaultVoiceMode,
      voiceVolume: settings.defaultVoiceMode === 'recorded' ? settings.customVoiceVolume : settings.voiceVolume,
      voiceRate: settings.voiceRate,
      voicePitch: settings.voicePitch,
      androidVoiceName: settings.androidVoiceName,
      customVoicePath: settings.customVoicePath,
      medicineName: sampleMedicine,
      dosage: sampleDosage,
    }),
    'Пример запущен. Голос начинается сразу после фактического окончания сигнала.'
  )

  const testNotification = () => run(async () => {
    const scheduled = await scheduleTestNotification(settings.soundChoice, settings.volumeChoice, {
      voiceMode: settings.defaultVoiceMode,
      voiceVolume: settings.voiceVolume,
      customVoiceVolume: settings.customVoiceVolume,
      customVoicePath: settings.customVoicePath,
      voiceRate: settings.voiceRate,
      voicePitch: settings.voicePitch,
      androidVoiceName: settings.androidVoiceName,
    })
    if (!scheduled) throw new Error('Включите точные напоминания Android и повторите проверку.')
  }, 'Через 4 секунды придёт нейтральное тестовое напоминание.')

  const reschedule = () => run(async () => {
    for (const medicine of medicines) {
      if (!medicine.paused) await syncReminder(medicine)
    }
  }, 'Будущие напоминания обновлены.')

  return (
    <div className="app-page sound-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Звук и голос</h1>
          <p className="app-subtitle">Общие настройки для новых лекарств</p>
        </div>
        <Link href="/settings" className="ui-button ui-button--secondary">Назад</Link>
      </header>

      <div className="page-stack">
        <Card className="sound-preview-card ui-card--warning">
          <p className="reminder-kicker">ТЕСТОВОЕ НАПОМИНАНИЕ</p>
          <h2 className="sound-preview-name">Пора принять лекарство</h2>
          <Button variant="primary" className="ui-button--full" disabled={busy || recording} onClick={() => void previewAll()}>
            ▶ Послушать сигнал и голос
          </Button>
          <Button variant="secondary" className="ui-button--full" onClick={() => void stopAllReminderAudio()}>
            ■ Остановить всё
          </Button>
        </Card>

        <Card>
          <h2 className="section-title">Сигнал</h2>
          <p className="muted">Варианты отличаются ритмом и тембром, а не только высотой писка.</p>
          <div className="sound-option-grid" role="radiogroup" aria-label="Сигнал напоминания">
            {reminderSoundOptions.map((option) => (
              <button
                type="button"
                role="radio"
                aria-checked={settings.soundChoice === option.id}
                className={`sound-option${settings.soundChoice === option.id ? ' is-selected' : ''}`}
                disabled={busy || recording}
                key={option.id}
                onClick={() => void changeSound(option.id)}
              >
                <span className="sound-option__icon" aria-hidden="true">{option.id === 'marimba' ? '▦' : option.id === 'digital' ? '◫' : option.id === 'alarm' ? '⏰' : '♪'}</span>
                <span className="sound-option__text"><strong>{option.title}</strong><span>{option.description}</span></span>
                <span className="sound-option__check" aria-hidden="true">{settings.soundChoice === option.id ? '✓' : '▶'}</span>
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
            onPreview={(volume) => previewReminderSound(settings.soundChoice, volume)}
          />
        </Card>

        <Card>
          <h2 className="section-title">После сигнала</h2>
          <div className="choice-grid" role="radiogroup" aria-label="Голос по умолчанию">
            {[
              { id: 'android', title: 'Голос Android', description: 'Назовёт лекарство и дозировку' },
              { id: 'recorded', title: 'Моя запись', description: settings.customVoicePath ? 'Использовать сохранённую фразу' : 'Сначала записать фразу' },
              { id: 'off', title: 'Без голоса', description: 'Только сигнал и вибрация' },
            ].map((option) => (
              <label className={`choice${settings.defaultVoiceMode === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input type="radio" checked={settings.defaultVoiceMode === option.id} onChange={() => selectVoiceMode(option.id as VoiceMode)} />
                <span className="choice__text"><strong>{option.title}</strong><span className="choice__description">{option.description}</span></span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="page-stack">
          <h2 className="section-title">Голос Android</h2>
          <AndroidVoicePicker voices={voices} value={settings.androidVoiceName} onChange={settings.setAndroidVoiceName} />
          <VolumeSlider
            id="default-android-voice-volume"
            label="Громкость голоса"
            value={settings.voiceVolume}
            onChange={settings.setVoiceVolume}
            onPreview={(volume) => previewReminderVoice(sampleMedicine, sampleDosage, settings.voiceRate, volume, settings.androidVoiceName, settings.voicePitch)}
          />
          <div className="choice-grid" role="radiogroup" aria-label="Скорость голоса">
            {[
              { id: 'slow', title: 'Медленно и отчётливо' },
              { id: 'normal', title: 'Обычная скорость' },
            ].map((option) => (
              <label className={`choice${settings.voiceRate === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input type="radio" checked={settings.voiceRate === option.id} onChange={() => settings.setVoiceRate(option.id as VoiceRate)} />
                <span className="choice__text"><strong>{option.title}</strong></span>
              </label>
            ))}
          </div>
          <label className="ui-field">
            <span className="ui-label">Высота голоса</span>
            <input type="range" min="0.8" max="1.2" step="0.1" value={settings.voicePitch} onChange={(event) => settings.setVoicePitch(Number(event.target.value))} />
          </label>
        </Card>

        <Card className="page-stack">
          <h2 className="section-title">Общая запись своим голосом</h2>
          <VolumeSlider
            id="default-recorded-voice-volume"
            label="Громкость записи"
            value={settings.customVoiceVolume}
            onChange={settings.setCustomVoiceVolume}
            disabled={recording}
            onPreview={settings.customVoicePath ? (volume) => previewCustomVoice(settings.customVoicePath, volume) : undefined}
          />
          {recording ? (
            <>
              <div className="status-strip status-strip--danger">● Запись идёт: {recordingSeconds} сек.</div>
              <Button variant="primary" onClick={() => void finishRecording()}>■ Остановить и сохранить</Button>
            </>
          ) : settings.customVoicePath ? (
            <>
              <div className="status-strip status-strip--success">✓ Общая запись сохранена</div>
              <Button variant="secondary" onClick={() => void previewCustomVoice(settings.customVoicePath, settings.customVoiceVolume)}>▶ Послушать</Button>
              <Button variant="secondary" onClick={() => void startRecording()}>🎙 Записать новую</Button>
              <Button variant="quiet" onClick={() => { settings.setCustomVoicePath(''); settings.setDefaultVoiceMode('android') }}>Убрать запись</Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => void startRecording()}>🎙 Записать общую фразу</Button>
          )}
        </Card>

        <Card className="page-stack">
          <h2 className="section-title">Проверка при закрытом приложении</h2>
          <Button variant="primary" disabled={busy || recording} onClick={() => void testNotification()}>🔔 Проверить через 4 секунды</Button>
          {isNativeNotificationsAvailable() && (
            <Button variant="secondary" disabled={busy} onClick={() => void run(async () => {
              await ensureReminderChannel(settings.soundChoice, settings.volumeChoice)
              await openAndroidReminderSoundSettings(settings.soundChoice, settings.volumeChoice)
            }, 'Открыты настройки уведомлений Android.')}>Открыть настройки уведомлений</Button>
          )}
          <Button variant="quiet" disabled={busy} onClick={() => void reschedule()}>Обновить будущие напоминания</Button>
        </Card>

        {status && <div className="status-strip" role="status">{status}</div>}
      </div>
    </div>
  )
}
