'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useHistoryStore } from '@/features/history/store'
import { useMedicinesStore } from '@/features/medicines/store'
import Link from 'next/link'

export const HistoryScreen: React.FC = () => {
  const history = useHistoryStore((s) => s.history)
  const medicines = useMedicinesStore((s) => s.medicines)

  const getMedicineName = (medicineId: string) => {
    return medicines.find((m) => m.id === medicineId)?.name || 'Неизвестно'
  }

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">История приёма</h1>

      {history.length === 0 ? (
        <Card>
          <p className="text-gray-500 text-center">История пуста</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {history
            .slice()
            .reverse()
            .map((entry) => (
              <Card key={entry.id} className="border-l-4 border-l-blue-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{getMedicineName(entry.medicineId)}</p>
                    <p className="text-sm text-gray-600">
                      Принято: {new Date(entry.takenAt).toLocaleString('ru-RU')}
                    </p>
                    <p className="text-sm text-gray-500">
                      Статус: {
                        entry.status === 'taken' ? '✓ Принято' :
                        entry.status === 'skipped' ? '✗ Пропущено' :
                        '⏱ Позже'
                      }
                    </p>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Link href="/">
          <Button variant="secondary" className="w-full">
            ← Вернуться
          </Button>
        </Link>
      </div>
    </div>
  )
}
