'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { requestNotificationPermission } from '@/features/reminders/nativeNotifications.logic'

interface PermissionsScreenProps {
  onComplete: () => void
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onComplete }) => {
  const [requested, setRequested] = useState(false)
  const [granted, setGranted] = useState(false)

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission()
    setRequested(true)
    if (result) {
      setGranted(true)
      localStorage.setItem('permissions_shown', 'true')
      setTimeout(onComplete, 1500)
    } else {
      // Пользователь отказал — запомнить для повторного предложения
      localStorage.setItem('permissions_denied', 'true')
      setTimeout(onComplete, 2000)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('permissions_denied', 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <div className="text-center">
          <div className="text-5xl mb-6">🔔</div>
          <h2 className="text-2xl font-bold mb-4">Разрешите уведомления</h2>
          <p className="text-gray-600 mb-6">
            Приложение будет напоминать вам о приеме лекарств.
          </p>

          {requested && granted && (
            <p className="text-sm text-green-600 mb-6 font-semibold">
              ✓ Спасибо! Уведомления включены.
            </p>
          )}

          {requested && !granted && (
            <p className="text-sm text-red-600 mb-6">
              Разрешения не даны. Вы можете включить их в настройках позже.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleRequestPermission}
              disabled={requested}
            >
              {requested ? (granted ? '✓ Готово' : '✗ Отказано') : 'Разрешить'}
            </Button>
            {!requested && (
              <Button variant="secondary" className="w-full" onClick={handleSkip}>
                Позже
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Вы всегда можете изменить это в настройках.
          </p>
        </div>
      </Card>
    </div>
  )
}
