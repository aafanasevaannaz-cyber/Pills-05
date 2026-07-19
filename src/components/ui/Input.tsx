import React, { useId } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  help?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  help,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = error || help ? `${inputId}-description` : undefined

  return (
    <div className="ui-field">
      {label && <label className="ui-label" htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        className={`ui-input ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...props}
      />
      {error ? (
        <p className="ui-error" id={descriptionId}>{error}</p>
      ) : help ? (
        <p className="ui-help" id={descriptionId}>{help}</p>
      ) : null}
    </div>
  )
}
