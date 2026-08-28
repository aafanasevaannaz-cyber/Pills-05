'use client'

import { Input } from '@/components/ui/Input'
import {
  getDosagePresetsForForm,
  getMedicineFormOption,
  inferUnitsPerIntakeFromDosage,
  medicineFormOptions,
} from '@/features/medicines/forms'
import type { MedicineDraft } from '@/features/medicines/draft'
import type { MedicineForm } from '@/types'

interface MedicineDetailsEditorProps {
  draft: MedicineDraft
  update: (patch: Partial<MedicineDraft>) => void
}

const formatUnits = (value: number) => String(value).replace('.', ',')

export const MedicineDetailsEditor = ({ draft, update }: MedicineDetailsEditorProps) => {
  const formOption = getMedicineFormOption(draft.medicineForm)
  const dosageOptions = getDosagePresetsForForm(draft.medicineForm)

  const updateDosage = (dosage: string, medicineForm = draft.medicineForm) => {
    const inferred = inferUnitsPerIntakeFromDosage(dosage, medicineForm)
    update({
      dosage,
      ...(draft.trackStock && inferred !== null ? { unitsPerIntake: String(inferred) } : {}),
    })
  }

  const changeForm = (medicineForm: MedicineForm) => {
    const inferred = inferUnitsPerIntakeFromDosage(draft.dosage, medicineForm)
    update({
      medicineForm,
      ...(draft.trackStock && inferred !== null ? { unitsPerIntake: String(inferred) } : {}),
    })
  }

  const toggleStock = (trackStock: boolean) => {
    if (!trackStock) {
      update({ trackStock: false })
      return
    }
    const inferred = inferUnitsPerIntakeFromDosage(draft.dosage, draft.medicineForm)
    update({
      trackStock: true,
      ...(inferred !== null ? { unitsPerIntake: String(inferred) } : {}),
    })
  }

  const inferredUnits = inferUnitsPerIntakeFromDosage(draft.dosage, draft.medicineForm)

  return (
    <div className="medicine-details-editor page-stack">
      <div>
        <h2 className="section-title">Форма и дозировка</h2>
        <p className="muted">Форма помогает понятнее показывать лекарство. Дозировка необязательна — приложение не подставляет её за вас.</p>
      </div>

      <label className="ui-field">
        <span className="ui-label">Форма лекарства</span>
        <select
          className="ui-input"
          value={draft.medicineForm}
          onChange={(event) => changeForm(event.target.value as MedicineForm)}
        >
          {medicineFormOptions.map((option) => (
            <option value={option.id} key={option.id}>{option.title}</option>
          ))}
        </select>
        <span className="ui-help">Сейчас выбрано: {formOption.title.toLowerCase()}.</span>
      </label>

      <div className="dosage-shortcuts" role="group" aria-label="Быстрый выбор дозировки">
        {dosageOptions.map((dosage) => (
          <button
            type="button"
            className={draft.dosage === dosage ? 'is-selected' : ''}
            aria-pressed={draft.dosage === dosage}
            key={dosage}
            onClick={() => updateDosage(dosage)}
          >
            {dosage}
          </button>
        ))}
      </div>

      <Input
        label="Дозировка или способ применения — необязательно"
        value={draft.dosage}
        placeholder="Например: 1 таблетка, 10 мл, 2 капли"
        onChange={(event) => updateDosage(event.target.value)}
        help="Если оставить пустым, приложение сохранит пустое поле и ничего не будет предполагать."
      />

      <div>
        <h2 className="section-title">Продолжительность курса</h2>
        <div className="choice-grid" role="radiogroup" aria-label="Продолжительность курса">
          {[
            { id: 'ongoing', title: 'Постоянно', description: 'Без даты окончания' },
            { id: '7', title: '7 дней', description: 'Короткий курс' },
            { id: '14', title: '14 дней', description: 'Две недели' },
            { id: '30', title: '30 дней', description: 'Один месяц' },
            { id: '90', title: '90 дней', description: 'Три месяца' },
            { id: 'custom', title: 'До своей даты', description: 'Указать дату окончания' },
          ].map((option) => (
            <label className={`choice${draft.courseChoice === option.id ? ' is-selected' : ''}`} key={option.id}>
              <input
                type="radio"
                name="medicine-course"
                checked={draft.courseChoice === option.id}
                onChange={() => update({ courseChoice: option.id as MedicineDraft['courseChoice'] })}
              />
              <span className="choice__text">
                <strong>{option.title}</strong>
                <span className="choice__description">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {draft.courseChoice === 'custom' && (
        <Input
          label="Дата окончания"
          type="date"
          value={draft.customEndDate}
          onChange={(event) => update({ customEndDate: event.target.value })}
        />
      )}

      <div>
        <h2 className="section-title">Фото блистера после приёма</h2>
        <p className="muted">Фото делается только камерой в момент отметки. Оно помогает позже проверить, действительно ли вы уже принимали лекарство.</p>
        <div className="choice-grid" role="radiogroup" aria-label="Фото блистера после приёма">
          {[
            { id: 'off', title: 'Не использовать', description: 'Обычная отметка «Принято»' },
            { id: 'optional', title: 'По желанию', description: 'Можно сфотографировать блистер, но это не обязательно' },
            { id: 'required', title: 'Обязательно', description: 'Без нового фото приём нельзя отметить как принятый' },
          ].map((option) => (
            <label className={`choice${draft.photoConfirmationMode === option.id ? ' is-selected' : ''}`} key={option.id}>
              <input
                type="radio"
                name="photo-confirmation"
                checked={draft.photoConfirmationMode === option.id}
                onChange={() => update({ photoConfirmationMode: option.id as MedicineDraft['photoConfirmationMode'] })}
              />
              <span className="choice__text">
                <strong>{option.title}</strong>
                <span className="choice__description">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className={`choice${draft.trackStock ? ' is-selected' : ''}`}>
        <input
          type="checkbox"
          checked={draft.trackStock}
          onChange={(event) => toggleStock(event.target.checked)}
        />
        <span className="choice__text">
          <strong>Следить за остатком лекарства</strong>
          <span className="choice__description">Необязательно. Если включить, приложение предупредит, когда запас заканчивается.</span>
        </span>
      </label>

      {draft.trackStock && (
        <div className="stock-fields page-stack">
          <Input
            label="Сколько сейчас осталось"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={draft.stockQuantity}
            onChange={(event) => update({ stockQuantity: event.target.value })}
            help="Введите текущий остаток: например, 20 таблеток или 100 мл."
          />
          <Input
            label="Сколько расходуется за один приём"
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.25"
            value={draft.unitsPerIntake}
            onChange={(event) => update({ unitsPerIntake: event.target.value })}
            help={inferredUnits !== null
              ? `Подставлено из дозировки: ${formatUnits(inferredUnits)}. При необходимости можно изменить.`
              : 'Не удалось определить автоматически. Укажите расход вручную.'}
          />
          <Input
            label="За сколько дней предупредить о пополнении"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={draft.refillReminderDays}
            onChange={(event) => update({ refillReminderDays: event.target.value })}
          />
        </div>
      )}
    </div>
  )
}