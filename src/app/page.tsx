'use client'

import { MainScreen } from '@/components/screens/MainScreen'
import { PermissionsScreen } from '@/components/screens/PermissionsScreen'
import { useEffect, useState } from 'react'
import { useMedicinesStore } from '@/features/medicines/store'
import { useHistoryStore } from '@/features/history/store'
import { useRemindersStore } from '@/features/reminders/store'
import { useSettingsStore } from '@/features/settings/store'
import { initializeCapacitor, isCapacitorAvailable } from '@/lib/capacitor'

export default function Home() {
  const [showPermissions, setShowPermissions] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Инициализация Capacitor для Android
    initializeCapacitor()

    // Определить платформу
    const platform = isCapacitorAvailable() ? 'android' : 'web'
    useRemindersStore.getState().setPlatform(platform as any)

    // Загрузить настройки
    useSettingsStore.getState().loadFromDB()

    // Загрузить данные из localStorage
    useMedicinesStore.getState().loadFromDB()
    const historyData = localStorage.getItem('history')
    if (historyData) {
      try {
        const entries = JSON.parse(historyData)
        const store = useHistoryStore.getState()
        entries.forEach((entry: any) => store.addEntry(entry))
      } catch (e) {
        console.log('History load error')
      }
    }

    // Синхронизировать напоминания с native notifications (если Android)
    if (platform === 'android') {
      const medicines = useMedicinesStore.getState().medicines
      medicines.forEach((medicine) => {
        useRemindersStore.getState().syncReminderForMedicine(medicine)
      })

      // Показать экран разрешений при первом запуске
      const permissionsShown = localStorage.getItem('permissions_shown')
      if (!permissionsShown) {
        setShowPermissions(true)
      }
    }

    setInitialized(true)
  }, [])

  if (!initialized) {
    return null // Загрузка
  }

  return (
    <>
      {showPermissions && (
        <PermissionsScreen
          onComplete={() => {
            localStorage.setItem('permissions_shown', 'true')
            setShowPermissions(false)
          }}
        />
      )}
      <MainScreen />
    </>
  )
}
