import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div className={`ui-card ${className}`.trim()} {...props}>{children}</div>
)
