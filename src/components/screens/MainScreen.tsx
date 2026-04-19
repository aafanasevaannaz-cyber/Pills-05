'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useMedicinesStore } from '@/features/medicines/store'
import { useHistoryStore } from '@/features/history/store'
import { useRemindersStore } from '@/features/reminders/store'
import { startScheduler, stopScheduler } from '@/features/reminders/scheduler'
import Link from 'next/link'

export const MainScreen: React.FC = () => {
  const medicines = useMedicinesStore((s) => s.medicines)
  const history = useHistoryStore((s) => s.history)
  const activeReminder = useRemindersStore((s) => s.activeReminder)
  const markTaken = useRemindersStore((s) => s.markTaken)
  const markSkipped = useRemindersStore((s) => s.markSkipped)
  const delayReminder = useRemindersStore((s) => s.delayReminder)

  const addEntry = useHistoryStore((s) => s.addEntry)
  const saveToDB = useHistoryStore((s) => s.saveToDB)

  const [actionMessage, setActionMessage] = useState('')

  // Запуск scheduler при загрузке
  useEffect(() => {
    startScheduler()
    return () => stopScheduler()
  }, [])

  // Проверка напоминаний каждые 10 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      useRemindersStore.getState().checkReminders()
    }, 10 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getMedicineById = (medicineId: string) => {
    return medicines.find((m) => m.id === medicineId)
  }

  const handleTaken = (medicineId?: string) => {
    if (activeReminder) {
      markTaken(activeReminder.id)

      const medicine = getMedicineById(activeReminder.medicineId)
      const entry = {
        id: Date.now().toString(),
        medicineId: activeReminder.medicineId,
        takenAt: new Date(),
        scheduledFor: new Date(activeReminder.scheduledTime),
        status: 'taken' as const,
      }
      addEntry(entry)
      saveToDB()

      setActionMessage(`✓ ${medicine?.name || 'Лекарство'} принято`)
      setTimeout(() => setActionMessage(''), 2000)
    }
  }

  const handleSkipped = () => {
    if (activeReminder) {
      markSkipped(activeReminder.id)
      const medicine = getMedicineById(activeReminder.medicineId)
      setActionMessage(`${medicine?.name || 'Лекарство'} пропущено`)
      setTimeout(() => setActionMessage(''), 2000)
    }
  }

  const handleDelay = () => {
    if (activeReminder) {
      delayReminder(activeReminder.id)
      setActionMessage('Напомним через 10 минут')
      setTimeout(() => setActionMessage(''), 2000)
    }
  }

  const lastEntry = history.length > 0 ? history[history.length - 1] : null

  return (
    <div className="p-4 pb-20">
      <h1 className="text-3xl font-bold mb-2">Напоминание о лекарствах</h1>

      {/* АКТИВНОЕ НАПОМИНАНИЕ */}
      {activeReminder && (
        <Card className="mb-6 bg-red-50 border-2 border-red-400 animate-pulse">
          <div className="mb-4 p-3 bg-red-100 rounded text-red-900 text-center font-bold text-lg">
            🔔 ПОРА ПРИНЯТЬ ЛЕКАРСТВО
          </div>

          {getMedicineById(activeReminder.medicineId) && (
            <>
              <h3 className="text-2xl font-bold mb-3">
                {getMedicineById(activeReminder.medicineId)?.name}
              </h3>
              <p className="text-gray-700 mb-4">
                Время: {new Date(activeReminder.scheduledTime).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-gray-700 mb-6">
                Дозировка: {getMedicineById(activeReminder.medicineId)?.dosage}
              </p>

              <div className="flex flex-col gap-3">
                <Button
                  variant="primary"
                  className="w-full text-lg py-4 font-bold"
                  onClick={() => handleTaken()}
                >
                  ✓ Я ПРИНЯЛ
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleDelay}
                >
                  ⏱ Отложить на 10 мин
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={handleSkipped}
                >
                  ✗ Пропустил
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {!activeReminder && (
        <div className="mb-6 p-3 bg-green-50 rounded text-green-900 text-sm">
          ✓ Нет активных напоминаний
        </div>
      )}

      {/* СПИСОК ЛЕКАРСТВ */}
      {medicines.length === 0 ? (
        <Card>
          <p className="text-gray-600 mb-4">Нет добавленных лекарств</p>
          <Link href="/add">
            <Button variant="primary" className="w-full">
              Добавить лекарство
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3 mb-4">
          {medicines.map((medicine) => (
            <Card
              key={medicine.id}
              className={`border-2 ${
                activeReminder?.medicineId === medicine.id
                  ? 'border-red-400 bg-red-50'
                  : 'border-blue-200'
              }`}
            >
              <h3 className="text-lg font-bold mb-2">{medicine.name}</h3>
              <p className="text-gray-600 mb-1">{medicine.dosage}</p>
              <p className="text-sm text-gray-500">
                {medicine.customTimes && medicine.customTimes.length > 0
                  ? medicine.customTimes.join(', ')
                  : medicine.scheduleType}
              </p>
            </Card>
          ))}
        </div>
      )}

      {actionMessage && (
        <div className="mt-4 p-3 bg-green-100 text-green-900 rounded text-center font-semibold">
          {actionMessage}
        </div>
      )}

      {lastEntry && (
        <Card className="mt-6">
          <p className="text-sm text-gray-600">
            Последний прием:{' '}
            <span className="font-bold">
              {new Date(lastEntry.takenAt).toLocaleTimeString('ru-RU')}
            </span>
          </p>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-2">
        <Link href="/add" className="flex-1">
          <Button variant="primary" className="w-full">
            + Добавить
          </Button>
        </Link>
        <Link href="/history" className="flex-1">
          <Button variant="secondary" className="w-full">
            История
          </Button>
        </Link>
        <Link href="/settings" className="flex-1">
          <Button variant="secondary" className="w-full">
            Настройки
          </Button>
        </Link>
      </div>
    </div>
  )
}
