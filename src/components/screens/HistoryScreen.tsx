import React from 'react'
import { Card } from '@/components/ui/Card'

export const HistoryScreen: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">История приёма</h1>
      <Card>
        <p className="text-gray-500">История пуста</p>
      </Card>
    </div>
  )
}
