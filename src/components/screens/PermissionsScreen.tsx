'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { requestNotificationPermission } from '@/features/reminders/nativeNotifications.logic'

interface PermissionsScreenProps {
  onComplete: () => void
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onComplete }) => {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const request = async () => {
    setBusy(true)
    const granted = await requestNotificationPermission()
    if (granted) {
      localStorage.setItem('permissions_shown', 'true')
      localStorage.removeItem('permissions_denied')
      setMessage('Уведомления включены')
      window.setTimeout(onComplete, 650)
    } else {
      localStorage.setItem('permissions_denied', 'true')
      setMessage('Уведомления пока не разрешены')
      setBusy(false)
    }
  }

  const later = () => {
    localStorage.setItem('permissions_denied', 'true')
    onComplete()
  }

  return (
    <div className="reminder-overlay" role="dialog" aria-modal="true" aria-labelledby="permission-title">
      <Card className="reminder-overlay__panel">
        <div className="page-stack center">
          <div className="reminder-bell" aria-hidden="true">🔔</div>
          <div>
            <h2 className="section-title" id="permission-title">Разрешить напоминания?</h2>
            <p className="muted">Android покажет отдельный системный запрос. Нажмите «Разрешить», чтобы получать напоминания при закрытом приложении.</p>
          </div>
          {message && <div className="status-strip" role="status">{message}</div>}
          <Button variant="primary" className="ui-button--full" onClick={() => void request()} disabled={busy}>
            Разрешить уведомления
          </Button>
          <Button variant="secondary" className="ui-button--full" onClick={later} disabled={busy}>
            Сделать позже
          </Button>
        </div>
      </Card>
    </div>
  )
}
