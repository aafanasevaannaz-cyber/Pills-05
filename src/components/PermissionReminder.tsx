'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { requestNotificationPermission } from '@/features/reminders/nativeNotifications.logic'
import { isCapacitorAvailable } from '@/lib/capacitor'

export const PermissionReminder: React.FC = () => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isCapacitorAvailable()) return
    const denied = localStorage.getItem('permissions_denied')
    if (denied) setShow(true)
  }, [])

  const retry = async () => {
    const granted = await requestNotificationPermission()
    if (granted) {
      localStorage.setItem('permissions_shown', 'true')
      localStorage.removeItem('permissions_denied')
      setShow(false)
    }
  }

  if (!show) return null

  return (
    <div className="reminder-overlay" role="dialog" aria-modal="true" aria-labelledby="permission-title">
      <Card className="reminder-overlay__panel ui-card--warning">
        <div className="page-stack">
          <div className="reminder-bell" aria-hidden="true">🔔</div>
          <div>
            <h2 className="section-title" id="permission-title">Уведомления выключены</h2>
            <p className="muted">Без разрешения приложение не сможет напомнить о лекарстве, когда оно закрыто.</p>
          </div>
          <Button variant="primary" className="ui-button--full" onClick={() => void retry()}>
            Разрешить уведомления
          </Button>
          <Button variant="secondary" className="ui-button--full" onClick={() => setShow(false)}>
            Напомнить позже
          </Button>
          <p className="ui-help">После постоянного отказа разрешение включается в системных настройках Android: Приложения → Мои лекарства → Уведомления.</p>
        </div>
      </Card>
    </div>
  )
}
