'use client'

import { Input } from '@/components/ui/Input'
import {
  getDefaultDosageForForm,
  getDosagePresetsForForm,
  getMedicineFormOption,
  medicineFormOptions,
} from '@/features/medicines/forms'
import type { MedicineDraft } from '@/features/medicines/draft'
import type { MedicineForm } from '@/types'

interface MedicineDetailsEditorProps {
  draft: MedicineDraft
  update: (patch: Partial<MedicineDraft>) => void
}

export const MedicineDetailsEditor = ({ draft, update }: MedicineDetailsEditorProps) => {
  const formOption = getMedicineFormOption(draft.medicineForm)
  const dosageOptions = getDosagePresetsForForm(draft.medicineForm)

  const changeForm = (medicineForm: MedicineForm) => {
    const currentDefault = getDefaultDosageForForm(draft.medicineForm)
    const shouldReplaceDosage = !draft.dosage.trim() || draft.dosage.trim() === currentDefault
    update({
      medicineForm,
      dosage: shouldReplaceDosage ? getDefaultDosageForForm(medicineForm) : draft.dosage,
    })
  }

  return (
    <div className="medicine-details-editor page-stack">
      <div>
        <h2 className="section-title">Форма и дозировка</h2>
        <p className="muted">Выберите, что это: таблетка, капсула, саше, капли, спрей или другая форма. Дозировку можно изменить на любое значение.</p>
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
            onClick={() => update({ dosage })}
          >
            {dosage}
          </button>
        ))}
      </div>

      <Input
        label="Дозировка или способ применения"
        value={draft.dosage}
        placeholder="Например: 10 мл, 2 капли, тонкий слой"
        onChange={(event) => update({ dosage: event.target.value })}
        help={`Можно написать любое значение. Пустое поле сохранится как «${getDefaultDosageForForm(draft.medicineForm)}».`}
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

      <label className={`choice${draft.trackStock ? ' is-selected' : ''}`}>
        <input
          type="checkbox"
          checked={draft.trackStock}
          onChange={(event) => update({ trackStock: event.target.checked })}
        />
        <span className="choice__text">
          <strong>Следить за остатком лекарства</strong>
          <span className="choice__description">Подходит для таблеток, саше, капсул, миллилитров и других единиц</span>
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
          />
          <Input
            label="Сколько расходуется за один приём"
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.5"
            value={draft.unitsPerIntake}
            onChange={(event) => update({ unitsPerIntake: event.target.value })}
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
