import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`ui-card ${className}`.trim()}>{children}</div>
)
