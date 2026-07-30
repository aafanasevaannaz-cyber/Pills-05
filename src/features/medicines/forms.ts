import type { MedicineForm } from '@/types'

export type MedicineFormOption = {
  id: MedicineForm
  title: string
  defaultDosage: string
  reminderVerb: 'take' | 'use' | 'apply' | 'inject'
}

export const defaultMedicineForm: MedicineForm = 'tablet'

export const medicineFormOptions: MedicineFormOption[] = [
  { id: 'tablet', title: 'Таблетка', defaultDosage: '1 таблетка', reminderVerb: 'take' },
  { id: 'capsule', title: 'Капсула', defaultDosage: '1 капсула', reminderVerb: 'take' },
  { id: 'sachet', title: 'Саше', defaultDosage: '1 саше', reminderVerb: 'take' },
  { id: 'drops', title: 'Капли', defaultDosage: '1 капля', reminderVerb: 'use' },
  { id: 'syrup', title: 'Сироп', defaultDosage: '5 мл', reminderVerb: 'take' },
  { id: 'spray', title: 'Спрей', defaultDosage: '1 впрыск', reminderVerb: 'use' },
  { id: 'inhaler', title: 'Ингалятор', defaultDosage: '1 вдох', reminderVerb: 'use' },
  { id: 'injection', title: 'Инъекция', defaultDosage: '1 инъекция', reminderVerb: 'inject' },
  { id: 'cream', title: 'Крем', defaultDosage: 'тонкий слой', reminderVerb: 'apply' },
  { id: 'gel', title: 'Гель', defaultDosage: 'тонкий слой', reminderVerb: 'apply' },
  { id: 'patch', title: 'Пластырь', defaultDosage: '1 пластырь', reminderVerb: 'apply' },
  { id: 'powder', title: 'Порошок', defaultDosage: '1 пакетик', reminderVerb: 'take' },
  { id: 'solution', title: 'Раствор', defaultDosage: '5 мл', reminderVerb: 'use' },
  { id: 'other', title: 'Другое', defaultDosage: '1 доза', reminderVerb: 'use' },
]

export function isMedicineForm(value: unknown): value is MedicineForm {
  return medicineFormOptions.some((option) => option.id === value)
}

export function getMedicineFormOption(form?: MedicineForm): MedicineFormOption {
  return medicineFormOptions.find((option) => option.id === form) ?? medicineFormOptions[0]
}

export function getDefaultDosageForForm(form?: MedicineForm): string {
  return getMedicineFormOption(form).defaultDosage
}

export function getDosagePresetsForForm(form?: MedicineForm): string[] {
  switch (form) {
    case 'tablet': return ['½ таблетки', '1 таблетка', '1½ таблетки', '2 таблетки']
    case 'capsule': return ['1 капсула', '2 капсулы', '3 капсулы']
    case 'sachet': return ['½ саше', '1 саше', '2 саше']
    case 'drops': return ['1 капля', '2 капли', '5 капель', '10 капель']
    case 'syrup':
    case 'solution': return ['2,5 мл', '5 мл', '10 мл', '15 мл']
    case 'spray': return ['1 впрыск', '2 впрыска', '3 впрыска']
    case 'inhaler': return ['1 вдох', '2 вдоха']
    case 'injection': return ['1 инъекция', '0,5 мл', '1 мл', '2 мл']
    case 'cream':
    case 'gel': return ['тонкий слой', 'небольшое количество']
    case 'patch': return ['1 пластырь', '2 пластыря']
    case 'powder': return ['½ пакетика', '1 пакетик', '2 пакетика']
    default: return ['1 доза']
  }
}

function inferMedicineFormFromDosage(dosage: string): MedicineForm | undefined {
  const value = dosage.toLocaleLowerCase('ru-RU')
  if (value.includes('саше')) return 'sachet'
  if (value.includes('капсул')) return 'capsule'
  if (value.includes('таблет')) return 'tablet'
  if (value.includes('капл')) return 'drops'
  if (value.includes('впрыск')) return 'spray'
  if (value.includes('вдох')) return 'inhaler'
  if (value.includes('инъекц') || value.includes('укол')) return 'injection'
  if (value.includes('пластыр')) return 'patch'
  if (value.includes('слой') || value.includes('нанести')) return 'cream'
  if (value.includes('пакетик')) return 'powder'
  if (value.includes('мл')) return 'solution'
  return undefined
}

export function buildMedicineReminderText(
  medicineName: string,
  dosage: string,
  form?: MedicineForm
): string {
  const name = medicineName.trim() || 'лекарство'
  const resolvedForm = form ?? inferMedicineFormFromDosage(dosage) ?? defaultMedicineForm
  const amount = dosage.trim() || getDefaultDosageForForm(resolvedForm)
  const verb = getMedicineFormOption(resolvedForm).reminderVerb
  const action = verb === 'take'
    ? `Пора принять ${name}.`
    : verb === 'apply'
      ? `Пора нанести или применить ${name}.`
      : verb === 'inject'
        ? `Пора сделать ${name}.`
        : `Пора использовать ${name}.`
  return `${action} Дозировка: ${amount}.`
}
