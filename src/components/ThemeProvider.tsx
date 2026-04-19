'use client'

import React, { useEffect } from 'react'
import { useSettingsStore } from '@/features/settings/store'
import { themeColors, fontStacks, textSizes, spacingMultiplier } from '@/features/settings/theme'

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { theme, textSize, font, reduceAnimations } = useSettingsStore()

  useEffect(() => {
    useSettingsStore.getState().loadFromDB()
  }, [])

  useEffect(() => {
    const colors = themeColors[theme]
    const fontSize = textSizes[textSize]
    const fontFamily = fontStacks[font]
    const spacing = spacingMultiplier[textSize]

    // Применить переменные в корень
    const root = document.documentElement
    root.style.setProperty('--bg-color', colors.bg)
    root.style.setProperty('--card-color', colors.card)
    root.style.setProperty('--text-color', colors.text)
    root.style.setProperty('--text-secondary-color', colors.textSecondary)
    root.style.setProperty('--border-color', colors.border)
    root.style.setProperty('--font-size-base', fontSize)
    root.style.setProperty('--font-family', fontFamily)
    root.style.setProperty('--spacing-multiplier', spacing.toString())

    // Применить атрибут для body
    document.body.style.backgroundColor = colors.bg
    document.body.style.color = colors.text
    document.body.style.fontFamily = fontFamily
    document.body.style.fontSize = fontSize

    // Применить режим редукции анимаций
    if (reduceAnimations) {
      document.documentElement.style.setProperty('--animation-duration', '0ms')
    } else {
      document.documentElement.style.setProperty('--animation-duration', '200ms')
    }

    // Применить тему через data атрибут
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme, textSize, font, reduceAnimations])

  return <>{children}</>
}
