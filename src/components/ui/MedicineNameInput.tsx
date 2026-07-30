'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { findMedicineNameSuggestions } from '@/data/medicineNames'
import { recordDiagnosticEvent } from '@/lib/diagnostics'

const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')

function highlightedName(name: string, query: string): React.ReactNode {
  const normalizedName = normalize(name)
  const normalizedQuery = normalize(query)
  const index = normalizedName.indexOf(normalizedQuery)
  if (!normalizedQuery || index < 0) return name
  return (
    <>
      {name.slice(0, index)}
      <strong>{name.slice(index, index + query.trim().length)}</strong>
      {name.slice(index + query.trim().length)}
    </>
  )
}

interface MedicineNameInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  existingNames?: string[]
  autoFocus?: boolean
}

export const MedicineNameInput: React.FC<MedicineNameInputProps> = ({
  value,
  onChange,
  onSubmit,
  existingNames = [],
  autoFocus = false,
}) => {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimer = useRef<number | undefined>(undefined)
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(() => {
    const current = normalize(value)
    return findMedicineNameSuggestions(value, existingNames, 7)
      .filter((suggestion) => normalize(suggestion) !== current)
      .slice(0, 5)
  }, [existingNames, value])
  const open = focused && value.trim().length > 0 && suggestions.length > 0

  useEffect(() => {
    document.documentElement.dataset.autocompleteOpen = open ? 'true' : 'false'
    return () => {
      delete document.documentElement.dataset.autocompleteOpen
    }
  }, [open])

  const choose = (suggestion: string) => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current)
    recordDiagnosticEvent('autocomplete.chosen', {
      valueLengthBefore: value.trim().length,
      selectedLength: suggestion.length,
      suggestionCount: suggestions.length,
    })
    onChange(suggestion)
    setFocused(false)
    inputRef.current?.blur()
  }

  const submit = () => {
    if (onSubmit) {
      onSubmit()
      return
    }
    const card = inputRef.current?.closest('.add-step-card')
    const primaryAction = card?.querySelector<HTMLButtonElement>('.add-step-actions .ui-button--primary')
    primaryAction?.click()
  }

  return (
    <div className="ui-field medicine-autocomplete">
      <label className="ui-label" htmlFor={id}>Название</label>
      <input
        ref={inputRef}
        id={id}
        className="ui-input medicine-autocomplete__input"
        value={value}
        placeholder="Например: Нексиум"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        autoFocus={autoFocus}
        enterKeyHint="next"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-suggestions`}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current)
          setFocused(true)
          recordDiagnosticEvent('autocomplete.focus', { valueLength: value.trim().length })
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setFocused(false), 180)
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (suggestions[0]) {
              choose(suggestions[0])
              return
            }
            if (value.trim()) {
              setFocused(false)
              inputRef.current?.blur()
              window.setTimeout(submit, 0)
            }
          }
          if (event.key === 'Escape') setFocused(false)
        }}
      />
      <p className="ui-help">Можно выбрать подсказку или написать любое название вручную.</p>

      {open && (
        <div id={`${id}-suggestions`} className="medicine-suggestions" role="listbox" aria-label="Подсказки названий">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              className="medicine-suggestion"
              role="option"
              aria-selected={false}
              key={suggestion}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              {highlightedName(suggestion, value)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
