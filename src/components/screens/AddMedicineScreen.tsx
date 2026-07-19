'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAddMedicineUI } from '@/features/medicines/uiStore'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import { useRouter } from 'next/navigation'
import type { Medicine } from '@/types'

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

  const { medicines, addMedicine, findByName, saveToDB } = useMedicinesStore()
  const syncReminderForMedicine = useRemindersStore((state) => state.syncReminderForMedicine)

  useEffect(() => () => reset(), [reset])

  const duplicate = name.length > 0 ? findByName(name) : null

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setName(value)
    const found = value.length > 0
      ? medicines.find((medicine) => medicine.name.toLowerCase().includes(value.toLowerCase()))
      : null
    setShowDuplicate(Boolean(found))
  }

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 4)
    setCustomTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage('⚠ Введите название лекарства')
      return
    }
    if (!frequency) {
      setMessage('⚠ Выберите частоту приёма')
      return
    }
    if (!scheduleType) {
      setMessage('⚠ Выберите время')
      return
    }
    if (scheduleType === 'custom' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime)) {
      setMessage('⚠ Введите корректное время')
      return
    }
    if (!dosage) {
      setMessage('⚠ Выберите дозировку')
      return
    }

    const newMedicine: Medicine = {
      id: Date.now().toString(),
      name: name.trim(),
      dosage,
      frequency: frequency as Medicine['frequency'],
      scheduleType: scheduleType as Medicine['scheduleType'],
      customTimes: scheduleType === 'custom' ? [customTime] : undefined,
      createdAt: new Date(),
    }

    try {
      addMedicine(newMedicine)
      saveToDB()
      await syncReminderForMedicine(newMedicine)
      setMessage('✓ Лекарство сохранено')
      window.setTimeout(() => {
        reset()
        router.push('/')
      }, 800)
    } catch (error) {
      console.error('Medicine save failed:', error)
      setMessage('⚠ Не удалось включить напоминание. Проверьте разрешения.')
    }
  }

  const frequencyOptions = [
    { id: 'daily', label: 'Каждый день' },
    { id: 'every_other', label: 'Через день' },
    { id: 'morning', label: 'Утром' },
    { id: 'twice', label: 'Утром и вечером' },
    { id: 'three_times', label: '3 раза в день' },
    { id: 'until_date', label: 'До даты' },
    { id: 'as_needed', label: 'По необходимости' },
  ]

  const scheduleOptions = [
    { id: 'morning', label: 'Утро 08:00' },
    { id: 'afternoon', label: 'День 14:00' },
    { id: 'evening', label: 'Вечер 20:00' },
    { id: 'night', label: 'Ночь 22:00' },
  ]

  const dosageOptions = [
    { id: '1_tab', label: '1 таблетка' },
    { id: 'half_tab', label: '1/2 таблетки' },
    { id: '2_tab', label: '2 таблетки' },
    { id: 'mg', label: 'мг' },
  ]

  return (
    <div className="p-4 pb-20">
      <div className="mb-4 text-sm text-gray-600">Шаг {step} из 4</div>
      <h1 className="text-2xl font-bold mb-6">Добавить лекарство</h1>

      {step === 1 && (
        <>
          <Input
            label="Название лекарства"
            placeholder="Введите название"
            value={name}
            onChange={handleNameChange}
            autoFocus
          />

          {showDuplicate && duplicate && (
            <Card className="mb-4 border-orange-200 bg-orange-50">
              <p className="text-orange-900 mb-3">
                Такое лекарство уже есть: <strong>{duplicate.name}</strong>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(2)}>Изменить</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowDuplicate(false)
                    setStep(2)
                  }}
                >
                  Добавить ещё
                </Button>
              </div>
            </Card>
          )}

          {!showDuplicate && name.length > 0 && (
            <Button variant="primary" className="w-full" onClick={() => setStep(2)}>
              Далее →
            </Button>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-gray-600 mb-4">Выберите частоту приёма:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {frequencyOptions.map((option) => (
              <Button
                key={option.id}
                variant={frequency === option.id ? 'primary' : 'secondary'}
                className="w-full"
                onClick={() => {
                  setFrequency(option.id)
                  setMessage('')
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              ← Назад
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setStep(3)}>
              Далее →
            </Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <p className="text-gray-600 mb-4">Выберите время приёма:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {scheduleOptions.map((option) => (
              <Button
                key={option.id}
                variant={scheduleType === option.id ? 'primary' : 'secondary'}
                className="w-full"
                onClick={() => {
                  setScheduleType(option.id)
                  setMessage('')
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="mb-4">
            <Button
              variant={scheduleType === 'custom' ? 'primary' : 'secondary'}
              className="w-full mb-2"
              onClick={() => setScheduleType('custom')}
            >
              Своё время
            </Button>
            {scheduleType === 'custom' && (
              <Input
                label="Время (0800 = 08:00)"
                placeholder="0800"
                value={customTime}
                onChange={handleTimeChange}
                maxLength={5}
              />
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
              ← Назад
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setStep(4)}>
              Далее →
            </Button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <p className="text-gray-600 mb-4">Выберите дозировку:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {dosageOptions.map((option) => (
              <Button
                key={option.id}
                variant={dosage === option.id ? 'primary' : 'secondary'}
                className="w-full"
                onClick={() => {
                  setDosage(option.id)
                  setMessage('')
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {message && (
            <Card className="mb-4 bg-yellow-50 border-yellow-200">
              <p className="text-yellow-900 text-sm">{message}</p>
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
              ← Назад
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => void handleSave()}>
              Сохранить
            </Button>
          </div>
        </>
      )}

      {message && step !== 4 && (
        <Card className="mt-4 bg-green-50 border-green-200">
          <p className="text-green-900 text-center font-semibold">{message}</p>
        </Card>
      )}
    </div>
  )
}
