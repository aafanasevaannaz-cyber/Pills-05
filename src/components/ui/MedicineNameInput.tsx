'use client'

import React, { useId, useMemo, useState } from 'react'
import { findMedicineNameSuggestions } from '@/data/medicineNames'

type MedicineNameInputProps = {
  value: string
  onChange: (value: string) => void
  existingNames?: string[]
  autoFocus?: boolean
}

export const MedicineNameInput: React.FC<MedicineNameInputProps> = ({
  value,
  onChange,
  existingNames = [],
  autoFocus = false,
}) => {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(
    () => findMedicineNameSuggestions(value, existingNames),
    [existingNames, value]
  )
  const open = focused && suggestions.length > 0

  return (
    <div className="ui-field medicine-autocomplete">
      <label className="ui-label" htmlFor={id}>Название</label>
      <input
        id={id}
        className="ui-input"
        value={value}
        placeholder="Начните писать, например: Амок…"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-suggestions`}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="ui-help">После двух букв появятся офлайн-подсказки. Можно написать любое другое название.</p>
      {open && (
        <div id={`${id}-suggestions`} className="medicine-suggestions" role="listbox" aria-label="Подсказки названий">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              className="medicine-suggestion"
              role="option"
              aria-selected={value === suggestion}
              key={suggestion}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(suggestion)
                setFocused(false)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
