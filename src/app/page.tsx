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
    let mounted = true

    const initialize = async () => {
      await initializeCapacitor()

      const platform = isCapacitorAvailable() ? 'android' : 'web'
      useRemindersStore.getState().setPlatform(platform)
      useSettingsStore.getState().loadFromDB()
      useMedicinesStore.getState().loadFromDB()
      useHistoryStore.getState().loadFromDB()

      const medicines = useMedicinesStore.getState().medicines
      useRemindersStore.getState().generateFromMedicines(medicines)

      if (platform === 'android') {
        if (useSettingsStore.getState().pushNotificationsEnabled) {
          await Promise.all(
            medicines.map(async (medicine) => {
              try {
                await useRemindersStore.getState().syncReminderForMedicine(medicine)
              } catch (error) {
                console.error(`Reminder sync failed for ${medicine.name}:`, error)
              }
            })
          )
        }

        if (!localStorage.getItem('permissions_shown') && mounted) {
          setShowPermissions(true)
        }
      }

      if (mounted) setInitialized(true)
    }

    void initialize()
    return () => { mounted = false }
  }, [])

  if (!initialized) {
    return (
      <div className="app-page" role="status">
        <p className="muted">Загружаем лекарства…</p>
      </div>
    )
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
