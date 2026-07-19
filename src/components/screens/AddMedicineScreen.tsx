'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAddMedicineUI } from '@/features/medicines/uiStore'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import type { Medicine } from '@/types'

const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const stepNames = ['Название', 'Частота', 'Время', 'Дозировка']

export const AddMedicineScreen: React.FC = () => {
  const router = useRouter()
  const {
    step,
    name,
    frequency,
    scheduleType,
    customTime,
    dosage,
    showDuplicate,
    message,
    setStep,
    setName,
    setFrequency,
    setScheduleType,
    setCustomTime,
    setDosage,
    setShowDuplicate,
    setMessage,
    reset,
  } = useAddMedicineUI()

  const medicines = useMedicinesStore((state) => state.medicines)
  const addMedicine = useMedicinesStore((state) => state.addMedicine)
  const findByName = useMedicinesStore((state) => state.findByName)
  const syncReminderForMedicine = useRemindersStore((state) => state.syncReminderForMedicine)

  useEffect(() => () => reset(), [reset])

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
    if (!dosage.trim()) {
      setMessage('Укажите дозировку')
      setStep(4)
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
      createdAt: new Date(),
    }

    addMedicine(newMedicine)

    try {
      await syncReminderForMedicine(newMedicine)
      setMessage('Лекарство сохранено')
      window.setTimeout(() => {
        reset()
        router.replace('/')
      }, 650)
    } catch (error) {
      console.error('Reminder scheduling failed:', error)
      setMessage('Лекарство сохранено. Разрешите уведомления в настройках телефона')
    }
  }

  const nextFromFrequency = () => {
    if (!frequency) {
      setMessage('Сначала выберите частоту')
      return
    }
    setMessage('')
    setStep(frequency === 'as_needed' ? 4 : 3)
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <div>
          <p className="app-subtitle">Шаг {step} из 4 · {stepNames[step - 1]}</p>
          <h1 className="app-title">Добавить лекарство</h1>
        </div>
        <Link href="/" className="ui-button ui-button--secondary">Отмена</Link>
      </header>

      <div className="progress-track" aria-label={`Шаг ${step} из 4`}>
        <div className="progress-fill" style={{ width: `${step * 25}%` }} />
      </div>

      <Card className="ui-card--soft" >
        {step === 1 && (
          <div className="page-stack">
            <div>
              <h2 className="section-title">Как называется лекарство?</h2>
              <p className="muted">Напишите название так, как оно указано на упаковке.</p>
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
                help="Используйте часы и минуты"
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
              <h2 className="section-title">Какая дозировка?</h2>
              <p className="muted">Дозировка будет крупно показана в напоминании.</p>
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
              <Button variant="secondary" onClick={() => setStep(frequency === 'as_needed' ? 2 : 3)}>Назад</Button>
              <Button variant="primary" onClick={() => void handleSave()}>Сохранить</Button>
            </div>
          </div>
        )}
      </Card>

      {message && <div className="status-strip" role="status" style={{ marginTop: 16 }}>{message}</div>}
    </div>
  )
}
