'use client'

import React, { useEffect } from 'react'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { useSettingsStore } from '@/features/settings/store'

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useSettingsStore((state) => state.theme)
  const textSize = useSettingsStore((state) => state.textSize)
  const font = useSettingsStore((state) => state.font)
  const reduceAnimations = useSettingsStore((state) => state.reduceAnimations)

  useEffect(() => {
    useSettingsStore.getState().loadFromDB()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.textSize = textSize
    root.dataset.font = font
    root.style.setProperty('--animation-duration', reduceAnimations ? '0ms' : '180ms')

    if (Capacitor.isNativePlatform()) {
      const style = theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark
      void SystemBars.setStyle({ style }).catch((error) => {
        console.error('System bars style failed:', error)
      })
    }
  }, [font, reduceAnimations, textSize, theme])

  return <>{children}</>
}
