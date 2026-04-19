import React from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

export const AddMedicineScreen: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Добавить лекарство</h1>
      <Input
        label="Название лекарства"
        placeholder="Введите название"
      />
      <Select
        label="Частота приёма"
        options={[
          { value: 'daily', label: 'Каждый день' },
          { value: 'every_other', label: 'Через день' },
          { value: 'as_needed', label: 'По необходимости' },
        ]}
      />
      <Input
        label="Дозировка"
        placeholder="Например: 1 таблетка"
      />
      <div className="flex gap-4">
        <Button variant="primary">Сохранить</Button>
        <Button variant="secondary">Отмена</Button>
      </div>
    </div>
  )
}
