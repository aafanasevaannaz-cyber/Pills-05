'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAddMedicineUI } from '@/features/medicines/uiStore'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import {
  cancelCustomVoiceRecording,
  deleteCustomVoice,
  previewCustomVoice,
  previewFullReminder,
  startCustomVoiceRecording,
  stopCustomVoiceRecording,
  stopReminderPreview,
} from '@/features/sound/nativeAudio'
import {
  reminderSoundOptions,
  reminderVolumeOptions,
  type ReminderSound,
  type ReminderVolume,
  type VoiceMode,
  type VoiceRate,
} from '@/features/sound/options'
import type { Medicine } from '@/types'

const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const stepNames = ['Название', 'Частота', 'Время', 'Звук', 'Дозировка']

const voiceModes: Array<{
  id: VoiceMode
  title: string
  description: string
}> = [
  {
    id: 'android',
    title: 'Русский голос Android',
    description: 'Произнесёт название лекарства и дозировку',
  },
  {
    id: 'recorded',
    title: 'Мой записанный голос',
    description: 'Запишите свою фразу для этого лекарства',
  },
  {
    id: 'off',
    title: 'Без голоса',
    description: 'Останутся сигнал и вибрация',
  },
]

export const AddMedicineScreen: React.FC = () => {
  const router = useRouter()
  const [previewing, setPreviewing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingRef = useRef(false)
  const recordingKey = useRef(`draft-${Date.now()}`)
  const {
    step,
    name,
    frequency,
    scheduleType,
    customTime,
    dosage,
    soundChoice,
    volumeChoice,
    voiceEnabled,
    voiceMode,
    voiceVolume,
    voiceRate,
    customVoicePath,
    showDuplicate,
    message,
    setStep,
    setName,
    setFrequency,
    setScheduleType,
    setCustomTime,
    setDosage,
    setSoundChoice,
    setVolumeChoice,
    setVoiceEnabled,
    setVoiceMode,
    setVoiceVolume,
    setVoiceRate,
    setCustomVoicePath,
    setShowDuplicate,
    setMessage,
    reset,
  } = useAddMedicineUI()

  const medicines = useMedicinesStore((state) => state.medicines)
  const addMedicine = useMedicinesStore((state) => state.addMedicine)
  const findByName = useMedicinesStore((state) => state.findByName)
  const syncReminderForMedicine = useRemindersStore((state) => state.syncReminderForMedicine)

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  useEffect(() => {
    if (!recording) {
      setRecordingSeconds(0)
      return
    }

    const timer = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => () => {
    void stopReminderPreview()
    if (recordingRef.current) void cancelCustomVoiceRecording()
    reset()
  }, [reset])

  const duplicate = name.length > 0 ? findByName(name) : null

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setName(value)
    const found = value.trim().length > 1
      ? medicines.some((medicine) => medicine.name.toLowerCase() === value.trim().toLowerCase())
      : false
    setShowDuplicate(found)
    setMessage('')
  }

  const chooseFrequency = (value: string) => {
    setFrequency(value)
    setMessage('')
  }

  const chooseTime = (value: string) => {
    setScheduleType(value)
    setMessage('')
  }

  const preview = async () => {
    if (previewing || recording) return
    if (voiceMode === 'recorded' && !customVoicePath) {
      setMessage('Сначала запишите свой голос или выберите русский голос Android')
      return
    }

    setPreviewing(true)
    setMessage('')
    try {
      await previewFullReminder({
        sound: soundChoice,
        volume: volumeChoice,
        voiceEnabled,
        voiceMode,
        voiceVolume,
        voiceRate,
        customVoicePath,
        medicineName: name.trim() || 'Лекарство',
        dosage: dosage.trim(),
      })
      setMessage(
        voiceMode === 'off'
          ? 'Так прозвучит выбранный сигнал без голоса.'
          : voiceMode === 'recorded'
            ? 'Так прозвучат сигнал и ваша запись.'
            : 'Так прозвучат сигнал и русский голос.'
      )
    } catch (error) {
      console.error('Reminder preview failed:', error)
      setMessage('Не удалось воспроизвести пример. Проверьте громкость будильника Android.')
    } finally {
      setPreviewing(false)
    }
  }

  const startRecording = async () => {
    if (recording || previewing) return
    setMessage('')
    try {
      await stopReminderPreview()
      await startCustomVoiceRecording(recordingKey.current)
      setVoiceMode('recorded')
      setRecording(true)
      setMessage('Запись идёт. Произнесите фразу и нажмите «Остановить и сохранить».')
    } catch (error) {
      console.error('Custom voice recording start failed:', error)
      setMessage('Не удалось начать запись. Разрешите приложению доступ к микрофону.')
    }
  }

  const stopRecording = async () => {
    if (!recording) return
    try {
      const result = await stopCustomVoiceRecording()
      const previousPath = customVoicePath
      setRecording(false)
      setCustomVoicePath(result.path)
      setVoiceMode('recorded')
      if (previousPath && previousPath !== result.path) {
        await deleteCustomVoice(previousPath).catch(() => undefined)
      }
      const seconds = Math.max(1, Math.round(result.durationMs / 1000))
      setMessage(`Запись сохранена: ${seconds} сек. Теперь её можно прослушать.`)
    } catch (error) {
      console.error('Custom voice recording stop failed:', error)
      setRecording(false)
      await cancelCustomVoiceRecording()
      setMessage('Запись не сохранилась. Запишите фразу не короче одной секунды.')
    }
  }

  const listenRecording = async () => {
    if (!customVoicePath || recording || previewing) return
    setPreviewing(true)
    setMessage('')
    try {
      await stopReminderPreview()
      await previewCustomVoice(customVoicePath, voiceVolume)
      setMessage('Ваша запись воспроизведена с выбранной громкостью голоса.')
    } catch (error) {
      console.error('Custom voice preview failed:', error)
      setMessage('Не удалось воспроизвести запись. Попробуйте записать её заново.')
    } finally {
      setPreviewing(false)
    }
  }

  const removeRecording = async () => {
    if (!customVoicePath) return
    try {
      await stopReminderPreview()
      await deleteCustomVoice(customVoicePath)
    } catch (error) {
      console.error('Custom voice deletion failed:', error)
    } finally {
      setCustomVoicePath('')
      setVoiceMode('android')
      setMessage('Запись удалена. Выбран русский голос Android.')
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage('Введите название лекарства')
      setStep(1)
      return
    }
    if (!frequency) {
      setMessage('Выберите частоту приёма')
      setStep(2)
      return
    }
    if (frequency !== 'as_needed' && !scheduleType) {
      setMessage('Выберите время приёма')
      setStep(3)
      return
    }
    if (scheduleType === 'custom' && !isValidTime(customTime)) {
      setMessage('Проверьте время, например 08:30')
      setStep(3)
      return
    }
    if (recording) {
      setMessage('Сначала остановите и сохраните запись голоса')
      setStep(4)
      return
    }
    if (voiceMode === 'recorded' && !customVoicePath) {
      setMessage('Запишите свой голос или выберите русский голос Android')
      setStep(4)
      return
    }
    if (!dosage.trim()) {
      setMessage('Укажите дозировку')
      setStep(5)
      return
    }

    const newMedicine: Medicine = {
      id: Date.now().toString(),
      name: name.trim(),
      dosage: dosage.trim(),
      frequency: frequency as Medicine['frequency'],
      scheduleType: frequency === 'as_needed'
        ? 'custom'
        : scheduleType as Medicine['scheduleType'],
      customTimes: scheduleType === 'custom' && frequency !== 'as_needed' ? [customTime] : undefined,
      reminderSound: soundChoice,
      reminderVolume: volumeChoice,
      voiceEnabled: voiceMode !== 'off',
      voiceMode,
      voiceVolume,
      voiceRate,
      customVoicePath: voiceMode === 'recorded' ? customVoicePath : undefined,
      createdAt: new Date(),
    }

    addMedicine(newMedicine)

    try {
      await syncReminderForMedicine(newMedicine)
      setMessage('Лекарство, громкость и голос сохранены')
      window.setTimeout(() => {
        reset()
        router.replace('/')
      }, 650)
    } catch (error) {
      console.error('Reminder scheduling failed:', error)
      setMessage('Лекарство сохранено. Разрешите уведомления и точные напоминания в Android')
    }
  }

  const nextFromFrequency = () => {
    if (!frequency) {
      setMessage('Сначала выберите частоту')
      return
    }
    setMessage('')
    setStep(frequency === 'as_needed' ? 5 : 3)
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <div>
          <p className="app-subtitle">Шаг {step} из 5 · {stepNames[step - 1]}</p>
          <h1 className="app-title">Добавить лекарство</h1>
        </div>
        <Link href="/" className="ui-button ui-button--secondary">Отмена</Link>
      </header>

      <div className="progress-track" aria-label={`Шаг ${step} из 5`}>
        <div className="progress-fill" style={{ width: `${step * 20}%` }} />
      </div>

      <Card className="ui-card--soft">
        {step === 1 && (
          <div className="page-stack">
            <div>
              <h2 className="section-title">Как называется лекарство?</h2>
              <p className="muted">Название можно писать полностью по-русски.</p>
            </div>
            <Input
              label="Название"
              placeholder="Например, Зенон"
              value={name}
              onChange={handleNameChange}
              autoFocus
              autoComplete="off"
            />
            {showDuplicate && duplicate && (
              <div className="status-strip" role="alert">
                Такое лекарство уже добавлено: {duplicate.name}
              </div>
            )}
            <Button
              variant="primary"
              className="ui-button--full"
              disabled={!name.trim()}
              onClick={() => {
                setMessage('')
                setStep(2)
              }}
            >
              Продолжить
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="page-stack">
            <div>
              <h2 className="section-title">Как часто принимать?</h2>
              <p className="muted">Время выберем на следующем шаге.</p>
            </div>
            <div className="choice-grid">
              {[
                { id: 'daily', title: 'Каждый день', description: 'Напоминание ежедневно' },
                { id: 'every_other', title: 'Через день', description: 'Напоминание раз в два дня' },
                { id: 'as_needed', title: 'По необходимости', description: 'Без автоматического напоминания' },
              ].map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`choice${frequency === option.id ? ' is-selected' : ''}`}
                  onClick={() => chooseFrequency(option.id)}
                >
                  <span className="choice__text">
                    <span className="choice__title">{option.title}</span>
                    <span className="choice__description">{option.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setStep(1)}>Назад</Button>
              <Button variant="primary" onClick={nextFromFrequency}>Продолжить</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="page-stack">
            <div>
              <h2 className="section-title">В какое время напомнить?</h2>
              <p className="muted">Можно выбрать готовый режим или указать точное время.</p>
            </div>
            <div className="choice-grid">
              {[
                { id: 'morning', title: '08:00', description: 'Утром' },
                { id: 'afternoon', title: '14:00', description: 'Днём' },
                { id: 'evening', title: '20:00', description: 'Вечером' },
                { id: 'night', title: '22:00', description: 'На ночь' },
                { id: 'twice', title: '08:00 и 20:00', description: 'Два раза в день' },
                { id: 'three_times', title: '08:00, 14:00 и 20:00', description: 'Три раза в день' },
                { id: 'custom', title: 'Своё время', description: 'Указать вручную' },
              ].map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`choice${scheduleType === option.id ? ' is-selected' : ''}`}
                  onClick={() => chooseTime(option.id)}
                >
                  <span className="choice__text">
                    <span className="choice__title">{option.title}</span>
                    <span className="choice__description">{option.description}</span>
                  </span>
                </button>
              ))}
            </div>
            {scheduleType === 'custom' && (
              <Input
                label="Точное время"
                type="time"
                value={customTime}
                onChange={(event) => setCustomTime(event.target.value)}
                help="Выберите любые часы и минуты"
              />
            )}
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setStep(2)}>Назад</Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!scheduleType || (scheduleType === 'custom' && !isValidTime(customTime))) {
                    setMessage('Выберите время приёма')
                    return
                  }
                  setMessage('')
                  setStep(4)
                }}
              >
                Продолжить
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="page-stack">
            <div>
              <h2 className="section-title">Как должно звучать напоминание?</h2>
              <p className="muted">
                Сигнал, его громкость и голос сохранятся именно для лекарства «{name.trim() || 'Лекарство'}».
              </p>
            </div>

            <div>
              <h3 className="ui-label">Сигнал</h3>
              <div className="sound-option-grid" role="radiogroup" aria-label="Сигнал лекарства">
                {reminderSoundOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    role="radio"
                    aria-checked={soundChoice === option.id}
                    className={`sound-option${soundChoice === option.id ? ' is-selected' : ''}`}
                    onClick={() => setSoundChoice(option.id as ReminderSound)}
                  >
                    <span className="sound-option__icon" aria-hidden="true">
                      {option.id === 'gentle' ? '♪' : option.id === 'alarm' ? '⏰' : '🔔'}
                    </span>
                    <span className="sound-option__text">
                      <strong>{option.title}</strong>
                      <span>{option.description}</span>
                    </span>
                    <span className="sound-option__check" aria-hidden="true">
                      {soundChoice === option.id ? '✓' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="ui-label">Громкость сигнала</h3>
              <div className="choice-grid" role="radiogroup" aria-label="Громкость сигнала лекарства">
                {reminderVolumeOptions.map((option) => (
                  <label className={`choice${volumeChoice === option.id ? ' is-selected' : ''}`} key={option.id}>
                    <input
                      type="radio"
                      name="medicine-volume"
                      checked={volumeChoice === option.id}
                      onChange={() => setVolumeChoice(option.id as ReminderVolume)}
                    />
                    <span className="choice__text">
                      <span className="choice__title">{option.title}</span>
                      <span className="choice__description">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="ui-label">Голос после сигнала</h3>
              <div className="choice-grid" role="radiogroup" aria-label="Голос лекарства">
                {voiceModes.map((option) => (
                  <label className={`choice${voiceMode === option.id ? ' is-selected' : ''}`} key={option.id}>
                    <input
                      type="radio"
                      name="medicine-voice-mode"
                      checked={voiceMode === option.id}
                      onChange={() => {
                        setVoiceMode(option.id)
                        setVoiceEnabled(option.id !== 'off')
                        setMessage('')
                      }}
                    />
                    <span className="choice__text">
                      <span className="choice__title">{option.title}</span>
                      <span className="choice__description">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {voiceMode !== 'off' && (
              <div>
                <h3 className="ui-label">Громкость голоса</h3>
                <div className="choice-grid" role="radiogroup" aria-label="Громкость голоса лекарства">
                  {reminderVolumeOptions.map((option) => (
                    <label className={`choice${voiceVolume === option.id ? ' is-selected' : ''}`} key={option.id}>
                      <input
                        type="radio"
                        name="medicine-voice-volume"
                        checked={voiceVolume === option.id}
                        onChange={() => setVoiceVolume(option.id as ReminderVolume)}
                      />
                      <span className="choice__text">
                        <span className="choice__title">{option.title}</span>
                        <span className="choice__description">Только для голоса</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {voiceMode === 'android' && (
              <div>
                <h3 className="ui-label">Скорость русского голоса</h3>
                <div className="choice-grid" role="radiogroup" aria-label="Скорость голоса лекарства">
                  {[
                    { id: 'slow', title: 'Медленно', description: 'Отчётливо произносит название' },
                    { id: 'normal', title: 'Обычно', description: 'Произносит быстрее' },
                  ].map((option) => (
                    <label className={`choice${voiceRate === option.id ? ' is-selected' : ''}`} key={option.id}>
                      <input
                        type="radio"
                        name="medicine-voice-rate"
                        checked={voiceRate === option.id}
                        onChange={() => setVoiceRate(option.id as VoiceRate)}
                      />
                      <span className="choice__text">
                        <span className="choice__title">{option.title}</span>
                        <span className="choice__description">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {voiceMode === 'recorded' && (
              <Card>
                <div className="page-stack">
                  <div>
                    <h3 className="section-title">Своя запись</h3>
                    <p className="muted">
                      Например: «Пора принять {name.trim() || 'лекарство'}. Одна таблетка».
                      Запись хранится только внутри приложения.
                    </p>
                  </div>

                  {recording ? (
                    <>
                      <div className="status-strip status-strip--danger" role="status">
                        ● Запись идёт: {recordingSeconds} сек.
                      </div>
                      <Button
                        variant="primary"
                        className="ui-button--full"
                        onClick={() => void stopRecording()}
                      >
                        ■ Остановить и сохранить
                      </Button>
                    </>
                  ) : customVoicePath ? (
                    <div className="page-stack">
                      <div className="status-strip status-strip--success" role="status">
                        ✓ Свой голос записан
                      </div>
                      <Button
                        variant="secondary"
                        className="ui-button--full"
                        disabled={previewing}
                        onClick={() => void listenRecording()}
                      >
                        ▶ Послушать запись
                      </Button>
                      <Button
                        variant="secondary"
                        className="ui-button--full"
                        disabled={previewing}
                        onClick={() => void startRecording()}
                      >
                        🎙 Перезаписать
                      </Button>
                      <Button
                        variant="quiet"
                        className="ui-button--full"
                        disabled={previewing}
                        onClick={() => void removeRecording()}
                      >
                        Удалить запись
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      className="ui-button--full"
                      disabled={previewing}
                      onClick={() => void startRecording()}
                    >
                      🎙 Начать запись
                    </Button>
                  )}
                </div>
              </Card>
            )}

            <Button
              variant="primary"
              className="ui-button--full"
              disabled={previewing || recording || (voiceMode === 'recorded' && !customVoicePath)}
              onClick={() => void preview()}
            >
              {previewing ? 'Воспроизводим…' : '▶ Быстро проверить всё напоминание'}
            </Button>

            <div className="form-actions">
              <Button variant="secondary" disabled={recording} onClick={() => setStep(3)}>Назад</Button>
              <Button
                variant="primary"
                disabled={recording}
                onClick={() => {
                  if (voiceMode === 'recorded' && !customVoicePath) {
                    setMessage('Сначала запишите свой голос или выберите русский голос Android')
                    return
                  }
                  setMessage('')
                  setStep(5)
                }}
              >
                Продолжить
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="page-stack">
            <div>
              <h2 className="section-title">Какая дозировка?</h2>
              <p className="muted">Дозировка будет крупно показана и произнесена русским голосом, если он выбран.</p>
            </div>
            <div className="choice-grid">
              {['1 таблетка', '½ таблетки', '2 таблетки', '5 мл'].map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`choice${dosage === option ? ' is-selected' : ''}`}
                  onClick={() => setDosage(option)}
                >
                  <span className="choice__title">{option}</span>
                </button>
              ))}
            </div>
            <Input
              label="Или укажите свою дозировку"
              placeholder="Например, 10 мг"
              value={dosage}
              onChange={(event) => {
                setDosage(event.target.value)
                setMessage('')
              }}
            />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setStep(frequency === 'as_needed' ? 2 : 4)}>Назад</Button>
              <Button variant="primary" onClick={() => void handleSave()}>Сохранить</Button>
            </div>
          </div>
        )}
      </Card>

      {message && <div className="status-strip" role="status" style={{ marginTop: 16 }}>{message}</div>}
    </div>
  )
}
