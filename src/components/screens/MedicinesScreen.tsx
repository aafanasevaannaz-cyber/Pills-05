'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import { formatDosage, formatFrequency, formatSchedule } from '@/lib/formatMedicine'

export function MedicinesScreen() {
  const medicines = useMedicinesStore((state) => state.medicines)
  const removeMedicine = useMedicinesStore((state) => state.removeMedicine)
  const removeMedicineReminders = useRemindersStore((state) => state.removeMedicineReminders)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    await removeMedicineReminders(id).catch((error) => {
      console.error('Reminder cancellation failed:', error)
    })
    removeMedicine(id)
    setPendingDelete(null)
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Лекарства</h1>
          <p className="app-subtitle">Все добавленные лекарства и их расписание</p>
        </div>
        <Link href="/add" className="ui-button ui-button--primary">+ Добавить</Link>
      </header>

      {medicines.length === 0 ? (
        <Card className="ui-card--soft center">
          <h2 className="section-title">Список пока пуст</h2>
          <p className="muted">После добавления лекарство появится здесь и в расписании на сегодня.</p>
          <Link href="/add" className="ui-button ui-button--primary ui-button--full">Добавить лекарство</Link>
        </Card>
      ) : (
        <div className="medicine-list">
          {medicines.map((medicine) => (
            <Card key={medicine.id}>
              <div className="page-stack">
                <div>
                  <h2 className="medicine-name">{medicine.name}</h2>
                  <p className="medicine-details">{formatDosage(medicine.dosage)}</p>
                  <p className="medicine-details">
                    {formatFrequency(medicine.frequency)} · {formatSchedule(medicine)}
                  </p>
                </div>

                {pendingDelete === medicine.id ? (
                  <div className="ui-card ui-card--danger">
                    <strong>Удалить «{medicine.name}»?</strong>
                    <p className="muted">Будущие напоминания этого лекарства будут отменены.</p>
                    <div className="inline-actions">
                      <Button variant="danger" onClick={() => void handleDelete(medicine.id)}>Удалить</Button>
                      <Button variant="secondary" onClick={() => setPendingDelete(null)}>Оставить</Button>
                    </div>
                  </div>
                ) : (
                  <div className="inline-actions">
                    <Button variant="danger" onClick={() => setPendingDelete(medicine.id)}>Удалить</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
