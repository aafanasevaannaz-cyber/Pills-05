'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { PermissionReminder } from '@/components/PermissionReminder'
import { ReminderScreen } from '@/components/screens/ReminderScreen'
import { useMedicinesStore } from '@/features/medicines/store'
import { useHistoryStore } from '@/features/history/store'
import { useRemindersStore } from '@/features/reminders/store'
import { startScheduler, stopScheduler } from '@/features/reminders/scheduler'
import { formatDosage, formatFrequency, getMedicineTimes } from '@/lib/formatMedicine'
import type { Medicine } from '@/types'

const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate()

const isMedicineScheduledOn = (medicine: Medicine, date: Date) => {
  if (medicine.frequency === 'as_needed') return false
  if (medicine.frequency === 'daily') return true

  const created = new Date(medicine.createdAt)
  created.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - created.getTime()) / 86_400_000)
  return Math.abs(days) % 2 === 0
}

const dateAtTime = (day: Date, time: string) => {
  const [hour, minute] = time.split(':').map(Number)
  const result = new Date(day)
  result.setHours(hour, minute, 0, 0)
  return result
}

type Dose = {
  key: string
  medicine: Medicine
  time: string
  scheduledFor: Date
}

export const MainScreen: React.FC = () => {
  const medicines = useMedicinesStore((state) => state.medicines)
  const history = useHistoryStore((state) => state.history)
  const activeReminder = useRemindersStore((state) => state.activeReminder)
  const markTaken = useRemindersStore((state) => state.markTaken)
  const markSkipped = useRemindersStore((state) => state.markSkipped)
  const delayReminder = useRemindersStore((state) => state.delayReminder)
  const addEntry = useHistoryStore((state) => state.addEntry)
  const [actionMessage, setActionMessage] = useState('')
  const now = new Date()

  useEffect(() => {
    startScheduler()
    const interval = window.setInterval(() => {
      useRemindersStore.getState().checkReminders()
    }, 10_000)

    return () => {
      window.clearInterval(interval)
      stopScheduler()
    }
  }, [])

  const todayDoses = useMemo<Dose[]>(() => {
    const today = new Date()
    return medicines
      .filter((medicine) => isMedicineScheduledOn(medicine, today))
      .flatMap((medicine) =>
        getMedicineTimes(medicine).map((time) => ({
          key: `${medicine.id}-${time}`,
          medicine,
          time,
          scheduledFor: dateAtTime(today, time),
        }))
      )
      .sort((first, second) => first.scheduledFor.getTime() - second.scheduledFor.getTime())
  }, [medicines])

  const todayHistory = useMemo(
    () => history.filter((entry) => sameDay(new Date(entry.scheduledFor), now)),
    [history, now]
  )

  const statusForDose = (dose: Dose) =>
    todayHistory
      .filter((entry) => entry.medicineId === dose.medicine.id)
      .find((entry) => {
        const scheduled = new Date(entry.scheduledFor)
        return scheduled.getHours() === dose.scheduledFor.getHours() &&
          scheduled.getMinutes() === dose.scheduledFor.getMinutes()
      })?.status

  const completed = todayDoses.filter((dose) => {
    const status = statusForDose(dose)
    return status === 'taken' || status === 'skipped'
  }).length

  const nextDose =
    todayDoses.find((dose) => !statusForDose(dose) && dose.scheduledFor.getTime() >= Date.now()) ??
    todayDoses.find((dose) => !statusForDose(dose)) ??
    null

  const activeMedicine = activeReminder
    ? medicines.find((medicine) => medicine.id === activeReminder.medicineId) ?? null
    : null

  const addHistoryEntry = (status: 'taken' | 'skipped' | 'late') => {
    if (!activeReminder) return
    addEntry({
      id: `${Date.now()}-${status}`,
      medicineId: activeReminder.medicineId,
      takenAt: new Date(),
      scheduledFor: new Date(activeReminder.scheduledTime),
      status,
    })
  }

  const showMessage = (message: string) => {
    setActionMessage(message)
    window.setTimeout(() => setActionMessage(''), 2600)
  }

  const handleTaken = () => {
    if (!activeReminder) return
    addHistoryEntry('taken')
    markTaken(activeReminder.id)
    showMessage('Приём отмечен')
  }

  const handleSkipped = () => {
    if (!activeReminder) return
    addHistoryEntry('skipped')
    markSkipped(activeReminder.id)
    showMessage('Отмечено: не принято')
  }

  const handleDelay = () => {
    if (!activeReminder) return
    addHistoryEntry('late')
    delayReminder(activeReminder.id)
    showMessage('Напомним через 10 минут')
  }

  const formattedDate = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  return (
    <>
      <PermissionReminder />
      <div className="app-page">
        <header className="app-header">
          <div>
            <h1 className="app-title">Сегодня</h1>
            <p className="app-subtitle">{formattedDate}</p>
          </div>
          <Link href="/add" className="ui-button ui-button--primary" aria-label="Добавить лекарство">
            + Добавить
          </Link>
        </header>

        {actionMessage && <div className="status-strip" role="status">✓ {actionMessage}</div>}

        {medicines.length > 0 && (
          <Card className="progress-card ui-card--soft">
            <div className="progress-row">
              <div>
                <strong>План на день</strong>
                <div className="muted">Отмечено {completed} из {todayDoses.length}</div>
              </div>
              <strong>{todayDoses.length === 0 ? '—' : `${Math.round((completed / todayDoses.length) * 100)}%`}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div
                className="progress-fill"
                style={{ width: todayDoses.length === 0 ? '0%' : `${(completed / todayDoses.length) * 100}%` }}
              />
            </div>
          </Card>
        )}

        <div className="dashboard-grid">
          <section className="dashboard-schedule">
            <h2 className="section-title">Расписание</h2>
            {medicines.length === 0 ? (
              <Card className="ui-card--soft center">
                <h2 className="section-title">Лекарств пока нет</h2>
                <p className="muted">Добавьте название, дозировку и время. Напоминание появится автоматически.</p>
                <Link href="/add" className="ui-button ui-button--primary ui-button--full">
                  Добавить первое лекарство
                </Link>
              </Card>
            ) : todayDoses.length === 0 ? (
              <Card className="ui-card--success">
                <strong>На сегодня приёмов нет</strong>
                <p className="muted">Лекарства «по необходимости» остаются в разделе «Лекарства».</p>
              </Card>
            ) : (
              <div className="medicine-list">
                {todayDoses.map((dose) => {
                  const status = statusForDose(dose)
                  const statusLabel =
                    status === 'taken' ? 'Принято' :
                    status === 'skipped' ? 'Не принято' :
                    status === 'late' ? 'Отложено' :
                    dose.scheduledFor.getTime() < Date.now() ? 'Время прошло' : 'По плану'

                  return (
                    <Card
                      key={dose.key}
                      className={status === 'taken' ? 'ui-card--success' : status === 'skipped' ? 'ui-card--danger' : ''}
                    >
                      <div className="medicine-row">
                        <div className="medicine-time">{dose.time}</div>
                        <div>
                          <h3 className="medicine-name">{dose.medicine.name}</h3>
                          <p className="medicine-details">
                            {formatDosage(dose.medicine.dosage)} · {formatFrequency(dose.medicine.frequency)}
                          </p>
                          <span className="medicine-badge">{statusLabel}</span>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          <aside className="dashboard-reminder">
            <h2 className="section-title">Ближайший приём</h2>
            {nextDose ? (
              <Card className="reminder-hero">
                <p className="reminder-kicker">СЛЕДУЮЩИЙ</p>
                <h2 className="reminder-name">{nextDose.medicine.name}</h2>
                <div className="reminder-meta">
                  <span><strong>Время:</strong> {nextDose.time}</span>
                  <span><strong>Дозировка:</strong> {formatDosage(nextDose.medicine.dosage)}</span>
                </div>
              </Card>
            ) : (
              <Card className="ui-card--success">
                <strong>На сегодня всё отмечено</strong>
                <p className="muted">Историю приёма можно открыть в нижнем меню.</p>
              </Card>
            )}
            <div className="quick-actions">
              <Link href="/medicines" className="ui-button ui-button--secondary">Все лекарства</Link>
              <Link href="/settings" className="ui-button ui-button--secondary">Проверить звук</Link>
            </div>
          </aside>
        </div>
      </div>

      {activeReminder && activeMedicine && (
        <ReminderScreen
          medicineName={activeMedicine.name}
          dosage={formatDosage(activeMedicine.dosage)}
          scheduledTime={new Date(activeReminder.scheduledTime).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          onTaken={handleTaken}
          onDelayed={handleDelay}
          onSkipped={handleSkipped}
        />
      )}
    </>
  )
}
