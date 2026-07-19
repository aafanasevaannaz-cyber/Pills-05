'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { useHistoryStore } from '@/features/history/store'
import { useMedicinesStore } from '@/features/medicines/store'

const statusLabels = {
  taken: 'Принято',
  skipped: 'Не принято',
  late: 'Отложено на 10 минут',
} as const

const statusClasses = {
  taken: 'ui-card--success',
  skipped: 'ui-card--danger',
  late: 'ui-card--warning',
} as const

export const HistoryScreen: React.FC = () => {
  const history = useHistoryStore((state) => state.history)
  const medicines = useMedicinesStore((state) => state.medicines)

  const medicineName = (medicineId: string) =>
    medicines.find((medicine) => medicine.id === medicineId)?.name || 'Удалённое лекарство'

  const entries = history
    .slice()
    .sort((first, second) => new Date(second.takenAt).getTime() - new Date(first.takenAt).getTime())

  return (
    <div className="app-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">История</h1>
          <p className="app-subtitle">Когда лекарства были приняты, отложены или пропущены</p>
        </div>
      </header>

      {entries.length === 0 ? (
        <Card className="ui-card--soft center">
          <h2 className="section-title">История пока пуста</h2>
          <p className="muted">Отметки появятся после первого напоминания.</p>
        </Card>
      ) : (
        <div className="medicine-list">
          {entries.map((entry) => {
            const actedAt = new Date(entry.takenAt)
            const scheduledFor = new Date(entry.scheduledFor)
            return (
              <Card key={entry.id} className={statusClasses[entry.status]}>
                <div className="medicine-row">
                  <div className="medicine-time">
                    {actedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div>
                    <h2 className="medicine-name">{medicineName(entry.medicineId)}</h2>
                    <p className="medicine-details"><strong>{statusLabels[entry.status]}</strong></p>
                    <p className="medicine-details">
                      {actedAt.toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {' · по плану в '}
                      {scheduledFor.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
