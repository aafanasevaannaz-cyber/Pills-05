import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet'
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
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={`ui-button ui-button--${variant} ${className}`.trim()}
  >
    {children}
  </button>
)
