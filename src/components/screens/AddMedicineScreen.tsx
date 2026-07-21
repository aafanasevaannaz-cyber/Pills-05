'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { VolumeSlider } from '@/components/ui/VolumeSlider'
import { MedicineNameInput } from '@/components/ui/MedicineNameInput'
import { useAddMedicineUI } from '@/features/medicines/uiStore'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import { useSettingsStore } from '@/features/settings/store'
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
  type ReminderSound,
  type VoiceRate,
} from '@/features/sound/options'
import type { Medicine } from '@/types'

const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const todayKey = () => new Date().toISOString().slice(0, 10)

const stepNames = ['Название', 'Частота', 'Время', 'Звук', 'Дозировка и курс']
type RecordedSource = 'shared' | 'own'
type CourseChoice = 'ongoing' | '7' | '14' | '30' | '90' | 'custom'

const courseEndDate = (choice: CourseChoice, customDate: string): Date | undefined => {
  if (choice === 'ongoing') return undefined
  if (choice === 'custom') {
    if (!customDate) return undefined
    const date = new Date(`${customDate}T23:59:59`)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  const days = Number(choice)
  const date = new Date()
  date.setDate(date.getDate() + Math.max(0, days - 1))
  date.setHours(23, 59, 59, 999)
  return date
}

export const AddMedicineScreen: React.FC = () => {
  const router = useRouter()
  const [previewing, setPreviewing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordedSource, setRecordedSource] = useState<RecordedSource>('own')
  const [courseChoice, setCourseChoice] = useState<CourseChoice>('ongoing')
  const [customEndDate, setCustomEndDate] = useState('')
  const [trackStock, setTrackStock] = useState(false)
  const [stockQuantity, setStockQuantity] = useState('')
  const [unitsPerIntake, setUnitsPerIntake] = useState('1')
  const [refillReminderDays, setRefillReminderDays] = useState('3')
  const recordingRef = useRef(false)
  const defaultsAppliedRef = useRef(false)
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
    customVoiceVolume,
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
    setCustomVoiceVolume,
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
  const sharedVoicePath = useSettingsStore((state) => state.customVoicePath)

  useEffect(() => {
    if (defaultsAppliedRef.current) return
    defaultsAppliedRef.current = true
    useSettingsStore.getState().loadFromDB()
    const defaults = useSettingsStore.getState()
    setSoundChoice(defaults.soundChoice)
    setVolumeChoice(defaults.volumeChoice)
    setVoiceMode(defaults.defaultVoiceMode)
    setVoiceEnabled(defaults.defaultVoiceMode !== 'off')
    setVoiceVolume(defaults.voiceVolume)
    setCustomVoiceVolume(defaults.customVoiceVolume)
    setVoiceRate(defaults.voiceRate)
    if (defaults.defaultVoiceMode === 'recorded' && defaults.customVoicePath) {
      setRecordedSource('shared')
      setCustomVoicePath(defaults.customVoicePath)
    }
  }, [
    setCustomVoicePath,
    setCustomVoiceVolume,
    setSoundChoice,
    setVoiceEnabled,
    setVoiceMode,
    setVoiceRate,
    setVoiceVolume,
    setVolumeChoice,
  ])

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
  const usingSharedVoice = Boolean(sharedVoicePath && customVoicePath === sharedVoicePath)

  const handleNameChange = (value: string) => {
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
      setMessage('Сначала выберите общую запись или запишите отдельную фразу')
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
        customVoiceVolume,
        voiceRate,
        customVoicePath,
        medicineName: name.trim() || 'Лекарство',
        dosage: dosage.trim(),
      })
      setMessage(
        voiceMode === 'off'
          ? 'Так прозвучит выбранный сигнал без голоса.'
          : voiceMode === 'recorded'
            ? 'Так прозвучат сигнал и выбранная запись.'
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
      setRecordedSource('own')
      setVoiceMode('recorded')
      setVoiceEnabled(true)
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
      setRecordedSource('own')
      setCustomVoicePath(result.path)
      setVoiceMode('recorded')
      if (previousPath && previousPath !== result.path && previousPath !== sharedVoicePath) {
        await deleteCustomVoice(previousPath).catch(() => undefined)
      }
      const seconds = Math.max(1, Math.round(result.durationMs / 1000))
      setMessage(`Отдельная запись сохранена: ${seconds} сек.`)
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
      await previewCustomVoice(customVoicePath, customVoiceVolume)
      setMessage('Запись воспроизведена с выбранной громкостью.')
    } catch (error) {
      console.error('Custom voice preview failed:', error)
      setMessage('Не удалось воспроизвести запись.')
    } finally {
      setPreviewing(false)
    }
  }

  const removeRecording = async () => {
    if (!customVoicePath) return
    try {
      await stopReminderPreview()
      if (!usingSharedVoice) await deleteCustomVoice(customVoicePath)
    } catch (error) {
      console.error('Custom voice deletion failed:', error)
    } finally {
      setCustomVoicePath('')
      setRecordedSource('own')
      setVoiceMode('android')
      setMessage(usingSharedVoice
        ? 'Общая запись снята только с этого лекарства.'
        : 'Отдельная запись удалена. Выбран русский голос Android.')
    }
  }

  const selectAndroidVoice = () => {
    setVoiceMode('android')
    setVoiceEnabled(true)
    setMessage('')
  }

  const selectSharedVoice = () => {
    if (!sharedVoicePath) {
      setMessage('Сначала сохраните общую запись в настройках звука')
      return
    }
    setRecordedSource('shared')
    setCustomVoicePath(sharedVoicePath)
    setVoiceMode('recorded')
    setVoiceEnabled(true)
    setMessage('Выбрана общая запись из настроек.')
  }

  const selectOwnVoice = () => {
    setRecordedSource('own')
    if (customVoicePath === sharedVoicePath) setCustomVoicePath('')
    setVoiceMode('recorded')
    setVoiceEnabled(true)
    setMessage('Запишите отдельную фразу для этого лекарства.')
  }

  const selectNoVoice = () => {
    setVoiceMode('off')
    setVoiceEnabled(false)
    setMessage('')
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
      setMessage('Выберите общую запись или запишите отдельную фразу')
      setStep(4)
      return
    }
    if (!dosage.trim()) {
      setMessage('Укажите дозировку')
      setStep(5)
      return
    }
    if (courseChoice === 'custom') {
      const end = courseEndDate(courseChoice, customEndDate)
      if (!end || end.getTime() < Date.now()) {
        setMessage('Выберите будущую дату окончания курса')
        setStep(5)
        return
      }
    }

    const stock = Number(stockQuantity)
    const units = Number(unitsPerIntake)
    const refillDays = Number(refillReminderDays)
    if (trackStock && (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(units) || units <= 0)) {
      setMessage('Для учёта запаса укажите, сколько осталось и сколько уходит за один приём')
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
      voiceVolume: voiceMode === 'recorded' ? customVoiceVolume : voiceVolume,
      customVoiceVolume,
      voiceRate,
      customVoicePath: voiceMode === 'recorded' ? customVoicePath : undefined,
      endDate: frequency === 'as_needed' ? undefined : courseEndDate(courseChoice, customEndDate),
      stockQuantity: trackStock ? stock : undefined,
      unitsPerIntake: trackStock ? units : undefined,
      refillReminderDays: trackStock && Number.isFinite(refillDays) ? Math.max(0, refillDays) : undefined,
      stockUpdatedAt: trackStock ? new Date() : undefined,
      createdAt: new Date(),
    }

    addMedicine(newMedicine)

    try {
      await syncReminderForMedicine(newMedicine)
      setMessage('Лекарство, курс, звук и дополнительные напоминания сохранены')
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
              <p className="muted">Начните писать — приложение поможет дописать распространённое название без интернета.</p>
            </div>
            <MedicineNameInput
              value={name}
              onChange={handleNameChange}
              existingNames={medicines.map((medicine) => medicine.name)}
              autoFocus
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
              <p className="muted">Подставлены общие настройки. Здесь их можно изменить только для «{name.trim() || 'Лекарство'}».</p>
            </div>

            <div>
              <h3 className="ui-label">Сигнал — нажмите, чтобы послушать</h3>
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
                      {soundChoice === option.id ? '✓' : '▶'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <VolumeSlider
              id="medicine-signal-volume"
              label="Громкость сигнала"
              value={volumeChoice}
              onChange={setVolumeChoice}
              help="Двигайте бегунок и выбирайте громкость на слух."
            />

            <div>
              <h3 className="ui-label">Голос после сигнала</h3>
              <div className="choice-grid" role="radiogroup" aria-label="Голос лекарства">
                <label className={`choice${voiceMode === 'android' ? ' is-selected' : ''}`}>
                  <input type="radio" name="medicine-voice-mode" checked={voiceMode === 'android'} onChange={selectAndroidVoice} />
                  <span className="choice__text">
                    <span className="choice__title">Русский голос Android</span>
                    <span className="choice__description">Произнесёт название лекарства и дозировку</span>
                  </span>
                </label>
                {sharedVoicePath && (
                  <label className={`choice${voiceMode === 'recorded' && recordedSource === 'shared' ? ' is-selected' : ''}`}>
                    <input type="radio" name="medicine-voice-mode" checked={voiceMode === 'recorded' && recordedSource === 'shared'} onChange={selectSharedVoice} />
                    <span className="choice__text">
                      <span className="choice__title">Общая запись из настроек</span>
                      <span className="choice__description">Использовать уже сохранённую фразу</span>
                    </span>
                  </label>
                )}
                <label className={`choice${voiceMode === 'recorded' && recordedSource === 'own' ? ' is-selected' : ''}`}>
                  <input type="radio" name="medicine-voice-mode" checked={voiceMode === 'recorded' && recordedSource === 'own'} onChange={selectOwnVoice} />
                  <span className="choice__text">
                    <span className="choice__title">Отдельная запись для этого лекарства</span>
                    <span className="choice__description">Записать новую персональную фразу</span>
                  </span>
                </label>
                <label className={`choice${voiceMode === 'off' ? ' is-selected' : ''}`}>
                  <input type="radio" name="medicine-voice-mode" checked={voiceMode === 'off'} onChange={selectNoVoice} />
                  <span className="choice__text">
                    <span className="choice__title">Без голоса</span>
                    <span className="choice__description">Останутся сигнал и вибрация</span>
                  </span>
                </label>
              </div>
            </div>

            {voiceMode === 'android' && (
              <div className="page-stack">
                <VolumeSlider
                  id="medicine-android-voice-volume"
                  label="Громкость русского голоса"
                  value={voiceVolume}
                  onChange={setVoiceVolume}
                  help="Этот бегунок меняет только голос Android."
                />
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
              </div>
            )}

            {voiceMode === 'recorded' && (
              <Card>
                <div className="page-stack">
                  <div>
                    <h3 className="section-title">{recordedSource === 'shared' ? 'Общая запись' : 'Отдельная запись'}</h3>
                    <p className="muted">
                      {recordedSource === 'shared'
                        ? 'Эта фраза сохранена в общих настройках. Здесь можно изменить только её громкость.'
                        : `Например: «Пора принять ${name.trim() || 'лекарство'}. Одна таблетка».`}
                    </p>
                  </div>
                  <VolumeSlider
                    id="medicine-recorded-voice-volume"
                    label="Громкость записи"
                    value={customVoiceVolume}
                    onChange={setCustomVoiceVolume}
                    disabled={recording}
                  />

                  {recording ? (
                    <>
                      <div className="status-strip status-strip--danger" role="status">● Запись идёт: {recordingSeconds} сек.</div>
                      <Button variant="primary" className="ui-button--full" onClick={() => void stopRecording()}>
                        ■ Остановить и сохранить
                      </Button>
                    </>
                  ) : customVoicePath ? (
                    <div className="page-stack">
                      <div className="status-strip status-strip--success" role="status">
                        ✓ {usingSharedVoice ? 'Выбрана общая запись' : 'Отдельный голос записан'}
                      </div>
                      <Button variant="secondary" className="ui-button--full" disabled={previewing} onClick={() => void listenRecording()}>
                        ▶ Послушать запись
                      </Button>
                      <Button variant="secondary" className="ui-button--full" disabled={previewing} onClick={() => void startRecording()}>
                        🎙 Записать отдельную фразу
                      </Button>
                      <Button variant="quiet" className="ui-button--full" disabled={previewing} onClick={() => void removeRecording()}>
                        {usingSharedVoice ? 'Не использовать общую запись' : 'Удалить запись'}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="primary" className="ui-button--full" disabled={previewing} onClick={() => void startRecording()}>
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
            <Button variant="quiet" className="ui-button--full" onClick={() => void stopReminderPreview()}>
              Остановить звук
            </Button>

            <div className="form-actions">
              <Button variant="secondary" disabled={recording} onClick={() => setStep(3)}>Назад</Button>
              <Button
                variant="primary"
                disabled={recording}
                onClick={() => {
                  if (voiceMode === 'recorded' && !customVoicePath) {
                    setMessage('Выберите общую запись или запишите отдельную фразу')
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
              <p className="muted">Дозировка будет показана и произнесена, если выбран русский голос.</p>
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

            {frequency !== 'as_needed' && (
              <Card className="optional-card">
                <h3 className="section-title">Как долго принимать?</h3>
                <p className="muted">По умолчанию — постоянно, пока вы не удалите или не измените лекарство.</p>
                <div className="choice-grid">
                  {[
                    { id: 'ongoing', title: 'Постоянно', description: 'Без даты окончания' },
                    { id: '7', title: '7 дней', description: 'Короткий курс' },
                    { id: '14', title: '14 дней', description: 'Две недели' },
                    { id: '30', title: '30 дней', description: 'Около месяца' },
                    { id: '90', title: '90 дней', description: 'Около трёх месяцев' },
                    { id: 'custom', title: 'До своей даты', description: 'Указать день окончания' },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={`choice${courseChoice === option.id ? ' is-selected' : ''}`}
                      onClick={() => setCourseChoice(option.id as CourseChoice)}
                    >
                      <span className="choice__text">
                        <span className="choice__title">{option.title}</span>
                        <span className="choice__description">{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {courseChoice === 'custom' && (
                  <Input
                    label="Последний день курса"
                    type="date"
                    min={todayKey()}
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                  />
                )}
              </Card>
            )}

            <Card className="optional-card">
              <label className={`choice${trackStock ? ' is-selected' : ''}`}>
                <input type="checkbox" checked={trackStock} onChange={(event) => setTrackStock(event.target.checked)} />
                <span className="choice__text">
                  <span className="choice__title">Следить, сколько лекарства осталось</span>
                  <span className="choice__description">Необязательно. Приложение предупредит заранее о пополнении.</span>
                </span>
              </label>
              {trackStock && (
                <div className="compact-grid" style={{ marginTop: 16 }}>
                  <Input
                    label="Сколько осталось"
                    type="number"
                    min="0.1"
                    step="0.5"
                    inputMode="decimal"
                    placeholder="Например, 20"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                    help="Таблеток, капсул или доз"
                  />
                  <Input
                    label="За один приём"
                    type="number"
                    min="0.1"
                    step="0.5"
                    inputMode="decimal"
                    value={unitsPerIntake}
                    onChange={(event) => setUnitsPerIntake(event.target.value)}
                    help="Например, 1 таблетка"
                  />
                  <Input
                    label="Напомнить за сколько дней"
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    inputMode="numeric"
                    value={refillReminderDays}
                    onChange={(event) => setRefillReminderDays(event.target.value)}
                    help="Обычно удобно за 3 дня"
                  />
                </div>
              )}
            </Card>

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
