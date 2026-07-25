'use client'

import { useEffect, useRef, useState } from 'react'
import { AndroidVoicePicker } from '@/components/ui/AndroidVoicePicker'
import { Button } from '@/components/ui/Button'
import { VolumeSlider } from '@/components/ui/VolumeSlider'
import type { MedicineDraft } from '@/features/medicines/draft'
import {
  cancelCustomVoiceRecording,
  deleteCustomVoice,
  listAndroidVoices,
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
  type VoiceMode,
  type VoiceRate,
} from '@/features/sound/options'

interface MedicineSoundEditorProps {
  draft: MedicineDraft
  sharedVoicePath: string
  update: (patch: Partial<MedicineDraft>) => void
  setStatus: (status: string) => void
}

export const MedicineSoundEditor = ({
  draft,
  sharedVoicePath,
  update,
  setStatus,
}: MedicineSoundEditorProps) => {
  const [voices, setVoices] = useState<AndroidVoiceOption[]>([])
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingRef = useRef(false)
  const recordingKey = useRef(`medicine-${Date.now()}`)

  useEffect(() => {
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
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  const run = async (action: () => Promise<void>, success = '') => {
    if (busy || recording) return
    setBusy(true)
    setStatus('')
    try {
      await action()
      if (success) setStatus(success)
    } catch (error) {
      console.error('Medicine sound action failed:', error)
      setStatus(error instanceof Error ? error.message : 'Не удалось воспроизвести пример.')
    } finally {
      setBusy(false)
    }
  }

  const selectVoiceMode = (mode: VoiceMode) => {
    if (mode === 'recorded') {
      update({
        voiceMode: mode,
        customVoicePath: draft.customVoicePath || sharedVoicePath,
      })
      if (!draft.customVoicePath && !sharedVoicePath) {
        setStatus('Запишите отдельную фразу для этого лекарства.')
      }
      return
    }
    update({ voiceMode: mode })
  }

  const startRecording = async () => {
    if (busy || recording) return
    try {
      await stopAllReminderAudio()
      await startCustomVoiceRecording(recordingKey.current)
      setRecording(true)
      update({ voiceMode: 'recorded' })
      setStatus('Запись идёт. Произнесите фразу и нажмите «Остановить и сохранить».')
    } catch (error) {
      console.error('Medicine recording start failed:', error)
      setStatus('Не удалось начать запись. Разрешите приложению доступ к микрофону.')
    }
  }

  const finishRecording = async () => {
    try {
      const previousPath = draft.customVoicePath
      const result = await stopCustomVoiceRecording()
      setRecording(false)
      update({ voiceMode: 'recorded', customVoicePath: result.path })
      if (previousPath && previousPath !== sharedVoicePath && previousPath !== result.path) {
        await deleteCustomVoice(previousPath).catch(() => undefined)
      }
      setStatus(`Фраза сохранена: ${Math.max(1, Math.round(result.durationMs / 1000))} сек.`)
    } catch (error) {
      console.error('Medicine recording stop failed:', error)
      setRecording(false)
      await cancelCustomVoiceRecording()
      setStatus('Запись не сохранилась. Запишите фразу не короче секунды.')
    }
  }

  const removeRecording = async () => {
    const currentPath = draft.customVoicePath
    await stopAllReminderAudio()
    if (currentPath && currentPath !== sharedVoicePath) {
      await deleteCustomVoice(currentPath).catch(() => undefined)
    }
    update({ customVoicePath: '', voiceMode: 'android' })
    setStatus('Отдельная запись удалена. Выбран голос Android.')
  }

  const previewAll = () => run(
    () => previewFullReminder({
      sound: draft.sound,
      volume: draft.volume,
      voiceMode: draft.voiceMode,
      voiceVolume: draft.voiceMode === 'recorded' ? draft.customVoiceVolume : draft.voiceVolume,
      voiceRate: draft.voiceRate,
      voicePitch: draft.voicePitch,
      androidVoiceName: draft.androidVoiceName,
      customVoicePath: draft.customVoicePath,
      medicineName: draft.name || 'лекарство',
      dosage: draft.dosage || '1 таблетка',
    }),
    'Пример запущен. Голос начнётся сразу после окончания сигнала.'
  )

  return (
    <div className="medicine-sound-editor page-stack">
      <div>
        <h2 className="section-title">Сигнал</h2>
        <p className="muted">Нажмите на вариант, чтобы сразу его услышать.</p>
      </div>

      <div className="sound-option-grid" role="radiogroup" aria-label="Сигнал лекарства">
        {reminderSoundOptions.map((option) => (
          <button
            type="button"
            role="radio"
            aria-checked={draft.sound === option.id}
            className={`sound-option${draft.sound === option.id ? ' is-selected' : ''}`}
            disabled={busy || recording}
            key={option.id}
            onClick={() => {
              update({ sound: option.id })
              void run(() => previewReminderSound(option.id, draft.volume))
            }}
          >
            <span className="sound-option__icon" aria-hidden="true">
              {option.id === 'marimba' ? '▦' : option.id === 'digital' ? '◫' : option.id === 'alarm' ? '⏰' : '♪'}
            </span>
            <span className="sound-option__text">
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </span>
            <span className="sound-option__check" aria-hidden="true">{draft.sound === option.id ? '✓' : '▶'}</span>
          </button>
        ))}
      </div>

      <VolumeSlider
        id="medicine-rebuild-signal-volume"
        label="Громкость сигнала"
        value={draft.volume}
        onChange={(volume) => update({ volume })}
        onPreview={(volume) => previewReminderSound(draft.sound, volume)}
        disabled={recording}
      />

      <div>
        <h2 className="section-title">После сигнала</h2>
        <div className="choice-grid" role="radiogroup" aria-label="Голос лекарства">
          {[
            { id: 'android', title: 'Голос Android', description: 'Назовёт лекарство и дозировку' },
            { id: 'recorded', title: 'Моя запись', description: draft.customVoicePath || sharedVoicePath ? 'Использовать сохранённую фразу' : 'Записать отдельную фразу' },
            { id: 'off', title: 'Без голоса', description: 'Только сигнал и вибрация' },
          ].map((option) => (
            <label className={`choice${draft.voiceMode === option.id ? ' is-selected' : ''}`} key={option.id}>
              <input
                type="radio"
                name="medicine-voice-mode"
                checked={draft.voiceMode === option.id}
                onChange={() => selectVoiceMode(option.id as VoiceMode)}
              />
              <span className="choice__text">
                <strong>{option.title}</strong>
                <span className="choice__description">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {draft.voiceMode === 'android' && (
        <div className="page-stack">
          <AndroidVoicePicker voices={voices} value={draft.androidVoiceName} onChange={(androidVoiceName) => update({ androidVoiceName })} />
          <VolumeSlider
            id="medicine-rebuild-android-volume"
            label="Громкость голоса"
            value={draft.voiceVolume}
            onChange={(voiceVolume) => update({ voiceVolume })}
            onPreview={(volume) => previewReminderVoice(draft.name || 'лекарство', draft.dosage || '1 таблетка', draft.voiceRate, volume, draft.androidVoiceName, draft.voicePitch)}
          />
          <div className="choice-grid" role="radiogroup" aria-label="Скорость голоса">
            {[
              { id: 'slow', title: 'Медленно и отчётливо' },
              { id: 'normal', title: 'Обычная скорость' },
            ].map((option) => (
              <label className={`choice${draft.voiceRate === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="medicine-voice-rate"
                  checked={draft.voiceRate === option.id}
                  onChange={() => update({ voiceRate: option.id as VoiceRate })}
                />
                <span className="choice__text"><strong>{option.title}</strong></span>
              </label>
            ))}
          </div>
          <label className="ui-field">
            <span className="ui-label">Высота голоса</span>
            <input
              type="range"
              min="0.8"
              max="1.2"
              step="0.1"
              value={draft.voicePitch}
              onChange={(event) => update({ voicePitch: Number(event.target.value) })}
            />
          </label>
        </div>
      )}

      {draft.voiceMode === 'recorded' && (
        <div className="page-stack">
          <VolumeSlider
            id="medicine-rebuild-recorded-volume"
            label="Громкость записи"
            value={draft.customVoiceVolume}
            onChange={(customVoiceVolume) => update({ customVoiceVolume })}
            onPreview={draft.customVoicePath ? (volume) => previewCustomVoice(draft.customVoicePath, volume) : undefined}
            disabled={recording}
          />

          {recording ? (
            <>
              <div className="status-strip status-strip--danger">● Запись идёт: {recordingSeconds} сек.</div>
              <Button variant="primary" className="ui-button--full" onClick={() => void finishRecording()}>
                ■ Остановить и сохранить
              </Button>
            </>
          ) : draft.customVoicePath ? (
            <>
              <div className="status-strip status-strip--success">
                ✓ {draft.customVoicePath === sharedVoicePath ? 'Выбрана общая запись' : 'Отдельная запись сохранена'}
              </div>
              <Button variant="secondary" className="ui-button--full" onClick={() => void previewCustomVoice(draft.customVoicePath, draft.customVoiceVolume)}>
                ▶ Послушать запись
              </Button>
              <Button variant="secondary" className="ui-button--full" onClick={() => void startRecording()}>
                🎙 Записать отдельную фразу
              </Button>
              {sharedVoicePath && draft.customVoicePath !== sharedVoicePath && (
                <Button variant="quiet" className="ui-button--full" onClick={() => update({ customVoicePath: sharedVoicePath })}>
                  Использовать общую запись
                </Button>
              )}
              <Button variant="quiet" className="ui-button--full" onClick={() => void removeRecording()}>
                Убрать запись
              </Button>
            </>
          ) : (
            <>
              {sharedVoicePath && (
                <Button variant="secondary" className="ui-button--full" onClick={() => update({ customVoicePath: sharedVoicePath })}>
                  Использовать общую запись
                </Button>
              )}
              <Button variant="primary" className="ui-button--full" onClick={() => void startRecording()}>
                🎙 Записать фразу
              </Button>
            </>
          )}
        </div>
      )}

      <Button variant="primary" className="ui-button--full" disabled={busy || recording} onClick={() => void previewAll()}>
        ▶ Послушать всё напоминание
      </Button>
      <Button variant="secondary" className="ui-button--full" onClick={() => void stopAllReminderAudio()}>
        ■ Остановить всё
      </Button>
    </div>
  )
}
