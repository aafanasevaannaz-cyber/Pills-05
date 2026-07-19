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
        await Promise.allSettled(
          medicines.map((medicine) =>
            useRemindersStore.getState().syncReminderForMedicine(medicine)
          )
        )

        if (!localStorage.getItem('permissions_shown') && mounted) {
          setShowPermissions(true)
        }
      }

      if (mounted) setInitialized(true)
    }

    void initialize()

    return () => {
      mounted = false
    }
  }, [])

  if (!initialized) return null

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