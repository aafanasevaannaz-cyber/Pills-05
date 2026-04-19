'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { requestNotificationPermission } from '@/features/reminders/nativeNotifications.logic'
import { isCapacitorAvailable } from '@/lib/capacitor'

export const PermissionReminder: React.FC = () => {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!isCapacitorAvailable()) return
    if (dismissed) return

    const checkPermissions = async () => {
      const shown = localStorage.getItem('permissions_shown')
      const denied = localStorage.getItem('permissions_denied')

      // Показываем напоминание если разрешения были отказаны
      if (denied && !shown) {
        setShow(true)
      }
    }

    checkPermissions()
  }, [dismissed])

  const handleDismiss = () => {
    setDismissed(true)
    setShow(false)
  }

  const handleRetry = async () => {
    const granted = await requestNotificationPermission()
    if (granted) {
      localStorage.setItem('permissions_shown', 'true')
      localStorage.removeItem('permissions_denied')
      setShow(false)
    }
  }

  const handleOpenSettings = () => {
    // Открыть системные настройки приложения
    if (typeof window !== 'undefined' && (window as any).cordova) {
      const cordova = (window as any).cordova
      cordova.InAppBrowser?.open('app-settings:', '_system')
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-yellow-50 border-t-4 border-yellow-400 z-40">
      <Card className="bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold mb-1">Разрешения не даны</p>
            <p className="text-sm text-gray-600">
              Приложение не сможет напоминать вам о лекарствах без разрешения на уведомления.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="primary" onClick={handleRetry} className="flex-1">
            Повторить
          </Button>
          <Button variant="secondary" onClick={handleOpenSettings} className="flex-1">
            Настройки
          </Button>
          <Button variant="secondary" onClick={handleDismiss} className="flex-1">
            Позже
          </Button>
        </div>
      </Card>
    </div>
  )
}
