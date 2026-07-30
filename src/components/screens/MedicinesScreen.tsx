'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import { stopAllReminderAudio } from '@/features/sound/stopAllAudio'
import { formatDosage, formatFrequency, formatMedicineForm, formatSchedule } from '@/lib/formatMedicine'

export function MedicinesScreen() {
  const medicines = useMedicinesStore((state) => state.medicines)
  const removeMedicine = useMedicinesStore((state) => state.removeMedicine)
  const updateMedicine = useMedicinesStore((state) => state.updateMedicine)
  const removeReminders = useRemindersStore((state) => state.removeMedicineReminders)
  const syncReminder = useRemindersStore((state) => state.syncReminderForMedicine)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState('')

  const pause = async (id: string) => {
    setBusyId(id)
    await stopAllReminderAudio()
    await removeReminders(id)
    const updated = updateMedicine(id, { paused: true })
    setStatus(updated ? `«${updated.name}» приостановлено. Напоминания отключены.` : 'Не удалось приостановить лекарство.')
    setBusyId('')
  }

  const resume = async (id: string) => {
    setBusyId(id)
    const updated = updateMedicine(id, { paused: false })
    if (updated) {
      await syncReminder(updated).catch((error) => console.error('Reminder resume failed:', error))
      setStatus(`«${updated.name}» снова активно.`)
    }
    setBusyId('')
  }

  const remove = async (id: string) => {
    setBusyId(id)
    await stopAllReminderAudio()
    await removeReminders(id).catch((error) => console.error('Reminder cancellation failed:', error))
    removeMedicine(id)
    setPendingDelete(null)
    setBusyId('')
    setStatus('Лекарство и его будущие напоминания удалены.')
  }

  return (
    <div className="app-page medicines-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Лекарства</h1>
          <p className="app-subtitle">Расписание, редактирование и временное отключение</p>
        </div>
        <Link href="/add" className="ui-button ui-button--primary">+ Добавить</Link>
      </header>

      {status && <div className="status-strip" role="status">{status}</div>}

      {medicines.length === 0 ? (
        <Card className="ui-card--soft center">
          <h2 className="section-title">Список пока пуст</h2>
          <p className="muted">После добавления лекарство появится здесь и в расписании.</p>
          <Link href="/add" className="ui-button ui-button--primary ui-button--full">Добавить лекарство</Link>
        </Card>
      ) : (
        <div className="medicine-list">
          {medicines.map((medicine) => (
            <Card key={medicine.id} className={medicine.paused ? 'medicine-card--paused' : ''}>
              <div className="page-stack">
                <div>
                  <div className="medicine-card-heading">
                    <h2 className="medicine-name">{medicine.name}</h2>
                    <span className={`medicine-state${medicine.paused ? ' is-paused' : ''}`}>
                      {medicine.paused ? 'Приостановлено' : 'Активно'}
                    </span>
                  </div>
                  <p className="medicine-details">{formatMedicineForm(medicine.medicineForm)} · {formatDosage(medicine.dosage, medicine.medicineForm)}</p>
                  <p className="medicine-details">{formatFrequency(medicine.frequency)} · {formatSchedule(medicine)}</p>
                </div>

                {pendingDelete === medicine.id ? (
                  <div className="delete-confirmation">
                    <strong>Удалить «{medicine.name}»?</strong>
                    <p className="muted">Будущие уведомления, сигнал и голос этого лекарства будут отменены.</p>
                    <div className="inline-actions">
                      <Button variant="danger" disabled={busyId === medicine.id} onClick={() => void remove(medicine.id)}>Удалить</Button>
                      <Button variant="secondary" disabled={busyId === medicine.id} onClick={() => setPendingDelete(null)}>Оставить</Button>
                    </div>
                  </div>
                ) : (
                  <div className="medicine-manage-actions">
                    <Link href={`/add?edit=${encodeURIComponent(medicine.id)}`} className="ui-button ui-button--primary">Изменить</Link>
                    {medicine.paused ? (
                      <Button variant="secondary" disabled={busyId === medicine.id} onClick={() => void resume(medicine.id)}>Возобновить</Button>
                    ) : (
                      <Button variant="secondary" disabled={busyId === medicine.id} onClick={() => void pause(medicine.id)}>Приостановить</Button>
                    )}
                    <Button variant="danger" disabled={busyId === medicine.id} onClick={() => setPendingDelete(medicine.id)}>Удалить</Button>
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
