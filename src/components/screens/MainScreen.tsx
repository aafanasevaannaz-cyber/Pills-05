import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export const MainScreen: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Напоминание о лекарствах</h1>
      <Card>
        <p className="mb-4">Нет активных напоминаний</p>
        <Button variant="primary">Добавить лекарство</Button>
      </Card>
    </div>
  )
}
