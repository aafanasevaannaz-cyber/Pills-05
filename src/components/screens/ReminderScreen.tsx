import React from 'react'
import { Button } from '@/components/ui/Button'

export const ReminderScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-blue-100 flex items-center justify-center z-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-6">Время принять таблетки</h1>
        <p className="text-xl mb-8">Лекарство: Аспирин</p>
        <div className="flex flex-col gap-4">
          <Button variant="primary">Я принял</Button>
          <Button variant="secondary">Отложить на 10 мин</Button>
          <Button variant="danger">Пропустил</Button>
        </div>
      </div>
    </div>
  )
}
