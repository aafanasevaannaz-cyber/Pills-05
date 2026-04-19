'use client'

import { MainScreen } from '@/components/screens/MainScreen'
import { useEffect } from 'react'
import { useMedicinesStore } from '@/features/medicines/store'
import { useHistoryStore } from '@/features/history/store'
import { useRemindersStore } from '@/features/reminders/store'
import { initializeCapacitor, isCapacitorAvailable } from '@/lib/capacitor'

export default function Home() {
  useEffect(() => {
    // Инициализация Capacitor для Android
    initializeCapacitor()

    // Определить платформу
    const platform = isCapacitorAvailable() ? 'android' : 'web'
    useRemindersStore.getState().setPlatform(platform as any)

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
    }
  }, [])

  return <MainScreen />
}
