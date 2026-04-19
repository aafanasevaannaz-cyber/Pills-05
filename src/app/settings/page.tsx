'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useState } from 'react'

export default function SettingsPage() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(true)

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>
      <Card>
        <div className="mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="mr-3 w-5 h-5"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            <span className="text-lg">Включить звук</span>
          </label>
        </div>
        <div className="mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="mr-3 w-5 h-5"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
            />
            <span className="text-lg">Включить голос</span>
          </label>
        </div>
        <div className="mb-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="mr-3 w-5 h-5"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
            />
            <span className="text-lg">Включить push-уведомления</span>
          </label>
        </div>
        <Link href="/">
          <Button variant="secondary" className="w-full">
            ← Вернуться
          </Button>
        </Link>
      </Card>
    </div>
  )
}
