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
import { formatStockDays, isRefillSoon } from '@/lib/stock'
import {
  defaultReminderSound,
  defaultReminderVolume,
} from '@/features/sound/options'
import type { Medicine } from '@/types'

const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate()

const isMedicineScheduledOn = (medicine: Medicine, date: Date) => {
  if (medicine.paused || medicine.frequency === 'as_needed') return false
  const target = new Date(date)
  target.setHours(12, 0, 0, 0)
  const created = new Date(medicine.createdAt)
  created.setHours(0, 0, 0, 0)
  if (target.getTime() < created.getTime()) return false
  if (medicine.endDate) {
    const end = new Date(medicine.endDate)
    end.setHours(23, 59, 59, 999)
    if (target.getTime() > end.getTime()) return false
  }
  if (medicine.frequency === 'daily') return true

  const targetDay = new Date(target)
  targetDay.setHours(0, 0, 0, 0)
  const days = Math.round((targetDay.getTime() - created.getTime()) / 86_400_000)
  return Math.abs(days) % 2 === 0
}

const dateAtTime = (day: Date, time: string) => {
  const [hour, minute] = time.split(':').map(Number)
  const result = new Date(day)
  result.setHours(hour, minute, 0, 0)
  return result
}

const formatEndDate = (value?: Date) => {
  if (!value) return null
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(value))
}

type Dose = {
  key: string
  medicine: Medicine
  time: string
  scheduledFor: Date
}

type ActionMessage = {
  text: string
  tone: 'success' | 'warning' | 'danger'
}

export const MainScreen: React.FC = () => {
  const medicines = useMedicinesStore((state) => state.medicines)
  const consumeStock = useMedicinesStore((state) => state.consumeStock)
  const history = useHistoryStore((state) => state.history)
  const activeReminder = useRemindersStore((state) => state.activeReminder)
  const markTaken = useRemindersStore((state) => state.markTaken)
  const markSkipped = useRemindersStore((state) => state.markSkipped)
  const delayReminder = useRemindersStore((state) => state.delayReminder)
  const syncReminderForMedicine = useRemindersStore((state) => state.syncReminderForMedicine)
  const addEntry = useHistoryStore((state) => state.addEntry)
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null)
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

  const lowStockMedicines = useMemo(
    () => medicines.filter((medicine) => !medicine.paused && medicine.stockQuantity !== undefined && isRefillSoon(medicine)),
    [medicines]
  )

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

  const takenCount = todayDoses.filter((dose) => statusForDose(dose) === 'taken').length
  const skippedCount = todayDoses.filter((dose) => statusForDose(dose) === 'skipped').length
  const pendingCount = Math.max(0, todayDoses.length - takenCount - skippedCount)
  const takenPercent = todayDoses.length === 0
    ? 0
    : Math.round((takenCount / todayDoses.length) * 100)

  const nextDose =
    todayDoses.find((dose) => !statusForDose(dose) && dose.scheduledFor.getTime() >= Date.now()) ??
    todayDoses.find((dose) => !statusForDose(dose)) ??
    null

  const activeMedicine = activeReminder
    ? medicines.find((medicine) => medicine.id === activeReminder.medicineId) ?? null
    : null

  const addHistoryEntry = (status: 'taken' | 'skipped' | 'late', photoUri?: string) => {
    if (!activeReminder) return
    addEntry({
      id: `${Date.now()}-${status}`,
      medicineId: activeReminder.medicineId,
      takenAt: new Date(),
      scheduledFor: new Date(activeReminder.scheduledTime),
      status,
      photoUri,
    })
  }

  const showMessage = (text: string, tone: ActionMessage['tone']) => {
    setActionMessage({ text, tone })
    window.setTimeout(() => setActionMessage(null), 3000)
  }

  const handleTaken = (photoUri?: string) => {
    if (!activeReminder) return
    const medicineId = activeReminder.medicineId
    addHistoryEntry('taken', photoUri)
    markTaken(activeReminder.id)
    const updatedMedicine = consumeStock(medicineId)
    if (updatedMedicine) {
      void syncReminderForMedicine(updatedMedicine).catch((error) => {
        console.error('Stock refill reminder reschedule failed:', error)
      })
      const stock = updatedMedicine.stockQuantity ?? 0
      showMessage(photoUri ? `Приём отмечен, фото сохранено. Осталось: ${stock}` : `Приём отмечен. Осталось: ${stock}`, stock <= 0 ? 'warning' : 'success')
    } else {
      showMessage(photoUri ? 'Приём отмечен, фото блистера сохранено' : 'Приём отмечен как принятый', 'success')
    }
  }

  const handleSkipped = () => {
    if (!activeReminder) return
    addHistoryEntry('skipped')
    markSkipped(activeReminder.id)
    showMessage('Отмечено: лекарство не принято', 'danger')
  }

  const handleDelay = () => {
    if (!activeReminder) return
    addHistoryEntry('late')
    delayReminder(activeReminder.id)
    showMessage('Напомним через 10 минут', 'warning')
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

        {actionMessage && (
          <div className={`status-strip status-strip--${actionMessage.tone}`} role="status">
            <span aria-hidden="true">
              {actionMessage.tone === 'success' ? '✓' : actionMessage.tone === 'danger' ? '×' : '⏱'}
            </span>
            {actionMessage.text}
          </div>
        )}

        {lowStockMedicines.length > 0 && (
          <Card className="ui-card--warning" style={{ marginBottom: 18 }}>
            <h2 className="section-title">Скоро понадобится пополнить запас</h2>
            <div className="stock-warning-list">
              {lowStockMedicines.map((medicine) => (
                <div className="stock-warning-item" key={medicine.id}>
                  <strong>{medicine.name}</strong>
                  <span>{medicine.stockQuantity ?? 0} · {formatStockDays(medicine)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {todayDoses.length > 0 && (
          <Card className="progress-card ui-card--soft">
            <div className="progress-row">
              <div>
                <strong>План на день</strong>
                <div className="muted">Принято {takenCount} из {todayDoses.length}</div>
                {skippedCount > 0 && <div className="progress-missed">Не принято: {skippedCount}</div>}
              </div>
              <strong>{takenPercent}%</strong>
            </div>
            <div className="progress-track" aria-label={`Принято ${takenCount} из ${todayDoses.length}`}>
              <div className="progress-fill" style={{ width: `${takenPercent}%` }} />
            </div>
          </Card>
        )}

        {medicines.length === 0 ? (
          <section className="dashboard-schedule">
            <Card className="ui-card--soft center">
              <h2 className="section-title">Лекарств пока нет</h2>
              <p className="muted">
                Добавьте первое лекарство. После сохранения появятся расписание, ближайший приём и прогресс.
              </p>
              <Link href="/add" className="ui-button ui-button--primary ui-button--full">
                Добавить первое лекарство
              </Link>
            </Card>
          </section>
        ) : (
          <div className="dashboard-grid">
            <section className="dashboard-schedule">
              <h2 className="section-title">Расписание</h2>
              {todayDoses.length === 0 ? (
                <Card className="ui-card--soft">
                  <strong>На сегодня приёмов нет</strong>
                  <p className="muted">
                    Возможно, сегодня день без приёма или курс уже закончился.
                  </p>
                </Card>
              ) : (
                <div className="medicine-list">
                  {todayDoses.map((dose) => {
                    const status = statusForDose(dose)
                    const stockText = formatStockDays(dose.medicine)
                    const endText = formatEndDate(dose.medicine.endDate)
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
                          <div className="medicine-copy">
                            <h3 className="medicine-name">{dose.medicine.name}</h3>
                            <p className="medicine-details">
                              {formatDosage(dose.medicine.dosage)} · {formatFrequency(dose.medicine.frequency)}
                            </p>
                            {stockText && <p className="medicine-details">Запас: {dose.medicine.stockQuantity} · {stockText}</p>}
                            {endText && <p className="medicine-details">Курс до {endText}</p>}
                            <span className="medicine-badge">{statusLabel}</span>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </section>

            {todayDoses.length > 0 && (
              <aside className="dashboard-reminder">
                <h2 className="section-title">Ближайший приём</h2>
                {nextDose ? (
                  <Card className="reminder-hero">
                    <p className="reminder-kicker">СЛЕДУЮЩИЙ</p>
                    <h2 className="reminder-name">{nextDose.medicine.name}</h2>
                    <div className="reminder-meta">
                      <span><strong>Время:</strong> {nextDose.time}</span>
                      {nextDose.medicine.dosage && <span><strong>Дозировка:</strong> {formatDosage(nextDose.medicine.dosage)}</span>}
                      {nextDose.medicine.stockQuantity !== undefined && (
                        <span><strong>Осталось:</strong> {nextDose.medicine.stockQuantity}</span>
                      )}
                      {nextDose.medicine.endDate && (
                        <span><strong>Курс до:</strong> {formatEndDate(nextDose.medicine.endDate)}</span>
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card className={skippedCount > 0 ? 'ui-card--warning' : 'ui-card--success'}>
                    <strong>{skippedCount > 0 ? 'Ожидающих приёмов больше нет' : 'На сегодня всё принято'}</strong>
                    <p className="muted">
                      Принято: {takenCount}. Не принято: {skippedCount}. Ожидает: {pendingCount}.
                    </p>
                  </Card>
                )}
                <div className="quick-actions">
                  <Link href="/medicines" className="ui-button ui-button--secondary">Все лекарства</Link>
                  <Link href="/sound" className="ui-button ui-button--secondary">Проверить звук</Link>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {activeReminder && activeMedicine && (
        <ReminderScreen
          medicineName={activeMedicine.name}
          dosage={formatDosage(activeMedicine.dosage)}
          scheduledTime={new Date(activeReminder.scheduledTime).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          reminderSound={activeMedicine.reminderSound ?? defaultReminderSound}
          reminderVolume={activeMedicine.reminderVolume ?? defaultReminderVolume}
          medicineVoiceEnabled={activeMedicine.voiceEnabled !== false}
          medicineVoiceRate={activeMedicine.voiceRate ?? 'slow'}
          photoConfirmationMode={activeMedicine.photoConfirmationMode ?? 'off'}
          onTaken={handleTaken}
          onDelayed={handleDelay}
          onSkipped={handleSkipped}
        />
      )}
    </>
  )
}