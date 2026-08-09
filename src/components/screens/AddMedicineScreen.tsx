'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MedicineDetailsEditor } from '@/components/ui/MedicineDetailsEditor'
import { MedicineNameInput } from '@/components/ui/MedicineNameInput'
import { MedicineScheduleEditor } from '@/components/ui/MedicineScheduleEditor'
import { MedicineSoundEditor } from '@/components/ui/MedicineSoundEditor'
import {
  courseEndDate,
  createDraft,
  draftFromMedicine,
  type MedicineDraft,
} from '@/features/medicines/draft'
import { getDefaultDosageForForm } from '@/features/medicines/forms'
import { useMedicinesStore } from '@/features/medicines/store'
import { useRemindersStore } from '@/features/reminders/store'
import { useSettingsStore } from '@/features/settings/store'
import { deleteCustomVoice } from '@/features/sound/nativeAudio'
import { stopAllReminderAudio } from '@/features/sound/stopAllAudio'
import type { Medicine } from '@/types'

const stepNames = ['Название', 'Частота', 'Время', 'Звук и голос', 'Форма и дозировка']
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

export const AddMedicineScreen = () => {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<MedicineDraft>(() => createDraft(useSettingsStore.getState()))
  const [editingId, setEditingId] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [allowDuplicate, setAllowDuplicate] = useState(false)

  const medicines = useMedicinesStore((state) => state.medicines)
  const addMedicine = useMedicinesStore((state) => state.addMedicine)
  const updateMedicine = useMedicinesStore((state) => state.updateMedicine)
  const syncReminder = useRemindersStore((state) => state.syncReminderForMedicine)
  const removeReminders = useRemindersStore((state) => state.removeMedicineReminders)
  const sharedVoicePath = useSettingsStore((state) => state.customVoicePath)

  useEffect(() => {
    useSettingsStore.getState().loadFromDB()
    useMedicinesStore.getState().loadFromDB()
    const id = new URLSearchParams(window.location.search).get('edit') ?? ''
    setEditingId(id)
    const medicine = id ? useMedicinesStore.getState().getMedicine(id) : null
    setDraft(medicine ? draftFromMedicine(medicine) : createDraft(useSettingsStore.getState()))
    return () => { void stopAllReminderAudio() }
  }, [])

  const editingMedicine = useMemo(
    () => medicines.find((medicine) => medicine.id === editingId) ?? null,
    [editingId, medicines]
  )
  const duplicate = medicines.find((medicine) =>
    medicine.id !== editingId && medicine.name.trim().toLocaleLowerCase('ru-RU') === draft.name.trim().toLocaleLowerCase('ru-RU')
  )
  const update = (patch: Partial<MedicineDraft>) => {
    if (Object.prototype.hasOwnProperty.call(patch, 'name')) setAllowDuplicate(false)
    setDraft((current) => ({ ...current, ...patch }))
    setStatus('')
  }

  const next = () => {
    if (step === 1) {
      if (!draft.name.trim()) return setStatus('Введите название лекарства.')
      if (duplicate && !allowDuplicate) {
        return setStatus('Такое название уже есть. Можно открыть существующую запись или добавить ещё одну.')
      }
      setStep(2)
      return
    }
    if (step === 2) {
      if (!draft.frequency) return setStatus('Выберите частоту приёма.')
      setStep(draft.frequency === 'as_needed' ? 5 : 3)
      return
    }
    if (step === 3) {
      if (!draft.times.length || draft.times.some((time) => !validTime(time))) {
        return setStatus('Добавьте хотя бы одно корректное время.')
      }
      setStep(4)
      return
    }
    if (step === 4) {
      if (draft.voiceMode === 'recorded' && !draft.customVoicePath) {
        return setStatus('Запишите фразу или выберите голос Android.')
      }
      setStep(5)
    }
  }

  const back = () => {
    if (step === 1) return router.push('/medicines')
    if (step === 5 && draft.frequency === 'as_needed') return setStep(2)
    setStep((current) => Math.max(1, current - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const buildMedicine = (): Medicine | null => {
    const endDate = courseEndDate(draft.courseChoice, draft.customEndDate)
    if (draft.courseChoice === 'custom' && !endDate) {
      setStatus('Выберите дату окончания курса.')
      return null
    }
    const stock = Number(draft.stockQuantity)
    const units = Number(draft.unitsPerIntake)
    const refillDays = Number(draft.refillReminderDays)
    if (draft.trackStock && (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(units) || units <= 0)) {
      setStatus('Для учёта остатка укажите количество и расход за один приём.')
      return null
    }
    return {
      id: editingMedicine?.id ?? Date.now().toString(),
      name: draft.name.trim(),
      medicineForm: draft.medicineForm,
      dosage: draft.dosage.trim() || getDefaultDosageForForm(draft.medicineForm),
      frequency: draft.frequency || 'daily',
      scheduleType: 'custom',
      customTimes: draft.frequency === 'as_needed' ? undefined : Array.from(new Set(draft.times)).sort(),
      reminderSound: draft.sound,
      reminderVolume: draft.volume,
      voiceEnabled: draft.voiceMode !== 'off',
      voiceMode: draft.voiceMode,
      voiceVolume: draft.voiceMode === 'recorded' ? draft.customVoiceVolume : draft.voiceVolume,
      customVoiceVolume: draft.customVoiceVolume,
      voiceRate: draft.voiceRate,
      voicePitch: draft.voicePitch,
      androidVoiceName: draft.androidVoiceName,
      customVoicePath: draft.voiceMode === 'recorded' ? draft.customVoicePath : undefined,
      paused: editingMedicine?.paused ?? false,
      endDate: draft.frequency === 'as_needed' ? undefined : endDate,
      stockQuantity: draft.trackStock ? stock : undefined,
      unitsPerIntake: draft.trackStock ? units : undefined,
      refillReminderDays: draft.trackStock && Number.isFinite(refillDays) ? Math.max(0, refillDays) : undefined,
      stockUpdatedAt: draft.trackStock ? new Date() : undefined,
      createdAt: editingMedicine?.createdAt ?? new Date(),
      notes: editingMedicine?.notes,
    }
  }

  const save = async () => {
    if (saving) return
    if (!draft.name.trim()) {
      setStep(1)
      return setStatus('Введите название лекарства.')
    }
    const medicine = buildMedicine()
    if (!medicine) return
    setSaving(true)
    setStatus('Сохраняем и обновляем напоминания…')
    const oldVoicePath = editingMedicine?.customVoicePath
    try {
      await stopAllReminderAudio()
      if (editingMedicine) {
        await removeReminders(editingMedicine.id)
        const updated = updateMedicine(editingMedicine.id, medicine)
        if (!updated) throw new Error('Medicine update failed')
        if (!updated.paused) await syncReminder(updated)
      } else {
        const added = addMedicine(medicine)
        if (!added.paused) await syncReminder(added)
      }
      if (oldVoicePath && oldVoicePath !== medicine.customVoicePath && oldVoicePath !== sharedVoicePath) {
        await deleteCustomVoice(oldVoicePath).catch(() => undefined)
      }
      router.replace('/medicines')
    } catch (error) {
      console.error('Medicine save failed:', error)
      setStatus('Лекарство сохранено не полностью. Проверьте разрешения на уведомления.')
      setSaving(false)
    }
  }

  return (
    <div className="app-page add-medicine-page">
      <header className="app-header">
        <div>
          <p className="app-subtitle">Шаг {step} из 5 · {stepNames[step - 1]}</p>
          <h1 className="app-title">{editingMedicine ? 'Изменить лекарство' : 'Добавить лекарство'}</h1>
        </div>
        <Link href="/medicines" className="ui-button ui-button--secondary">Отмена</Link>
      </header>

      <div className="progress-track" aria-label={`Шаг ${step} из 5`}>
        <div className="progress-fill" style={{ width: `${step * 20}%` }} />
      </div>

      <Card className={`ui-card--soft add-step-card add-step-card--step-${step}`}>
        {step === 1 && (
          <div className="page-stack">
            <div><h2 className="section-title">Как называется лекарство?</h2><p className="muted">Начните вводить название. Можно выбрать подсказку или написать своё.</p></div>
            <MedicineNameInput value={draft.name} onChange={(name) => update({ name })} existingNames={medicines.map(({ name }) => name)} autoFocus />
            {duplicate && !editingMedicine && (
              <div className="page-stack">
                <div className="status-strip" role="status">
                  «{duplicate.name}» уже есть. Это не мешает создать вторую отдельную запись.
                </div>
                <div className="form-actions">
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/add?edit=${encodeURIComponent(duplicate.id)}`)}
                  >
                    Открыть существующее
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setAllowDuplicate(true)
                      setStatus('Будет создана ещё одна отдельная запись с этим названием.')
                      setStep(2)
                    }}
                  >
                    Добавить ещё одно
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="page-stack">
            <div><h2 className="section-title">Как часто принимать?</h2><p className="muted">Количество приёмов и точное время задаются отдельно.</p></div>
            <div className="choice-grid">
              {[
                { id: 'daily', title: 'Каждый день', text: 'В выбранные часы ежедневно' },
                { id: 'every_other', title: 'Через день', text: 'В выбранные часы раз в два дня' },
                { id: 'as_needed', title: 'По необходимости', text: 'Без автоматических напоминаний' },
              ].map((option) => (
                <button type="button" className={`choice${draft.frequency === option.id ? ' is-selected' : ''}`} key={option.id} onClick={() => update({ frequency: option.id as Medicine['frequency'] })}>
                  <span className="choice__text"><strong>{option.title}</strong><span className="choice__description">{option.text}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="page-stack">
            <div><h2 className="section-title">В какое время напомнить?</h2><p className="muted">Каждое время можно выбрать отдельно — два или три приёма не привязаны к готовым часам.</p></div>
            <MedicineScheduleEditor times={draft.times} onChange={(times) => update({ times })} />
          </div>
        )}

        {step === 4 && <MedicineSoundEditor draft={draft} sharedVoicePath={sharedVoicePath} update={update} setStatus={setStatus} />}
        {step === 5 && <MedicineDetailsEditor draft={draft} update={update} />}

        {status && <div className="status-strip status-strip--warning" role="status">{status}</div>}
        <div className="form-actions add-step-actions">
          <Button variant="secondary" disabled={saving} onClick={back}>Назад</Button>
          {step < 5 ? (
            <Button variant="primary" disabled={saving} onClick={next}>Продолжить</Button>
          ) : (
            <Button variant="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Сохраняем…' : 'Сохранить'}</Button>
          )}
        </div>
      </Card>
    </div>
  )
}
