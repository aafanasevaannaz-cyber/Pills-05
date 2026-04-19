'use client'

import { MainScreen } from '@/components/screens/MainScreen'
import { useEffect } from 'react'
import { useMedicinesStore } from '@/features/medicines/store'
import { useHistoryStore } from '@/features/history/store'

export default function Home() {
  useEffect(() => {
    // Load data from localStorage on mount
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
  }, [])

  return <MainScreen />
}
