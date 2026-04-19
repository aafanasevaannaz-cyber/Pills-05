import React from 'react'
import { useSettingsStore } from '@/features/settings/store'
import { buttonHeight } from '@/features/settings/theme'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  className?: string
  type?: 'button' | 'submit' | 'reset'
  ariaLabel?: string
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  type = 'button',
  ariaLabel,
}) => {
  const textSize = useSettingsStore((s) => s.textSize)
  const reduceAnimations = useSettingsStore((s) => s.reduceAnimations)
  const theme = useSettingsStore((s) => s.theme)

  const height = buttonHeight[textSize]
  const baseClasses = `
    min-h-[${height}] px-6 rounded-lg font-semibold transition-colors
    flex items-center justify-center gap-2
    text-base md:text-lg
    border-none cursor-pointer
    button-press
    focus:outline-none focus:ring-4 focus:ring-offset-2
  `

  const variantClasses: Record<string, string> = {
    primary:
      theme === 'high-contrast'
        ? 'bg-white text-black border-2 border-black hover:bg-gray-100'
        : 'bg-var(--color-success) text-white hover:bg-green-600 disabled:bg-gray-400',
    secondary:
      theme === 'high-contrast'
        ? 'bg-black text-white border-2 border-white hover:bg-gray-900'
        : 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
    danger:
      theme === 'high-contrast'
        ? 'bg-white text-black border-2 border-black hover:bg-gray-100'
        : 'bg-var(--color-error) text-white hover:bg-red-600 disabled:bg-gray-400',
  }

  const animationClass = reduceAnimations ? '' : 'active:scale-95'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${baseClasses} ${variantClasses[variant]} ${animationClass} ${className}`.trim()}
      style={{
        minHeight: height,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}
