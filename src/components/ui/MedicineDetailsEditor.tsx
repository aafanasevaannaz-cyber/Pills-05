'use client'

import { Input } from '@/components/ui/Input'
import type { MedicineDraft } from '@/features/medicines/draft'

interface MedicineDetailsEditorProps {
  draft: MedicineDraft
  update: (patch: Partial<MedicineDraft>) => void
}

const dosageOptions = ['½ таблетки', '1 таблетка', '1½ таблетки', '2 таблетки']

export const MedicineDetailsEditor = ({ draft, update }: MedicineDetailsEditorProps) => (
  <div className="medicine-details-editor page-stack">
    <div>
      <h2 className="section-title">Дозировка</h2>
      <p className="muted">Поле уже заполнено значением «1 таблетка». Его можно изменить сейчас или после сохранения.</p>
    </div>

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
      label="Дозировка или способ приёма"
      value={draft.dosage}
      placeholder="Например: 10 мл, 2 капли, по инструкции"
      onChange={(event) => update({ dosage: event.target.value })}
      help="Можно написать любое значение. Пустое поле сохранится как «1 таблетка»."
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
        <strong>Следить за остатком таблеток</strong>
        <span className="choice__description">Дополнительные поля появятся только после включения</span>
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
