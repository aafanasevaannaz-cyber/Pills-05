'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useMedicinesStore } from '@/features/medicines/store'
import { useHistoryStore } from '@/features/history/store'
import Link from 'next/link'

export const MainScreen: React.FC = () => {
  const medicines = useMedicinesStore((s) => s.medicines)
  const history = useHistoryStore((s) => s.history)
  const [actionMessage, setActionMessage] = useState('')

  const addEntry = useHistoryStore((s) => s.addEntry)
  const saveToDB = useHistoryStore((s) => s.saveToDB)

  const handleTaken = () => {
    if (medicines.length > 0) {
      const entry = {
        id: Date.now().toString(),
        medicineId: medicines[0].id,
        takenAt: new Date(),
        scheduledFor: new Date(),
        status: 'taken' as const,
      }
      addEntry(entry)
      saveToDB()
    }
    setActionMessage('✓ Отмечено')
    setTimeout(() => setActionMessage(''), 2000)
  }

  const handleSkipped = () => {
    if (medicines.length > 0) {
      const entry = {
        id: Date.now().toString(),
        medicineId: medicines[0].id,
        takenAt: new Date(),
        scheduledFor: new Date(),
        status: 'skipped' as const,
      }
      addEntry(entry)
      saveToDB()
    }
    setActionMessage('Ничего страшного')
    setTimeout(() => setActionMessage(''), 2000)
  }

  const handleDelay = () => {
    setActionMessage('Напомним позже')
    setTimeout(() => setActionMessage(''), 2000)
  }

  const lastEntry = history.length > 0 ? history[history.length - 1] : null

  return (
    <div className="p-4 pb-20">
      <h1 className="text-3xl font-bold mb-2">Напоминание о лекарствах</h1>

      <div className="mb-6 p-3 bg-blue-50 rounded text-blue-900 text-sm">
        Сейчас нужно принять
      </div>

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
        <>
          {medicines.map((medicine) => (
            <Card key={medicine.id} className="mb-4 border-2 border-blue-200">
              <h3 className="text-lg font-bold mb-2">{medicine.name}</h3>
              <p className="text-gray-600 mb-2">{medicine.dosage}</p>
              <p className="text-sm text-gray-500 mb-4">
                {medicine.scheduleType === 'custom'
                  ? medicine.customTimes?.join(', ') || '—'
                  : medicine.scheduleType}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleTaken}
                >
                  ✓ Я ПРИНЯЛ
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleSkipped}
                >
                  Пропустил
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleDelay}
                >
                  Отложить
                </Button>
              </div>
            </Card>
          ))}
        </>
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
