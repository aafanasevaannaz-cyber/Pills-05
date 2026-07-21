'use client'

import React, { useId, useMemo } from 'react'
import { findMedicineNameSuggestions } from '@/data/medicineNames'

type MedicineNameInputProps = {
  value: string
  onChange: (value: string) => void
  existingNames?: string[]
  autoFocus?: boolean
}

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')

export const MedicineNameInput: React.FC<MedicineNameInputProps> = ({
  value,
  onChange,
  existingNames = [],
  autoFocus = false,
}) => {
  const id = useId()
  const suggestions = useMemo(() => {
    const current = normalize(value)
    return findMedicineNameSuggestions(value, existingNames, 8)
      .filter((suggestion) => normalize(suggestion) !== current)
  }, [existingNames, value])

  const firstSuggestion = suggestions[0]
  const open = value.trim().length > 0 && suggestions.length > 0

  const choose = (suggestion: string) => {
    onChange(suggestion)
    window.setTimeout(() => {
      const input = document.getElementById(id) as HTMLInputElement | null
      input?.focus()
      input?.setSelectionRange(suggestion.length, suggestion.length)
    }, 0)
  }

  return (
    <div className="ui-field medicine-autocomplete">
      <label className="ui-label" htmlFor={id}>Название</label>
      <input
        id={id}
        className="ui-input"
        value={value}
        placeholder="Начните писать, например: Амок…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-suggestions`}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.key === 'Tab' || event.key === 'ArrowRight') && firstSuggestion) {
            event.preventDefault()
            choose(firstSuggestion)
          }
        }}
      />
      <p className="ui-help">
        Пишите название. Под полем появится кнопка «Дописать». Любое отсутствующее название можно ввести вручную.
      </p>

      {open && firstSuggestion && (
        <button
          type="button"
          className="medicine-autocomplete__complete"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => choose(firstSuggestion)}
        >
          Дописать название:
          <strong>{firstSuggestion}</strong>
        </button>
      )}

      {suggestions.length > 1 && (
        <div
          id={`${id}-suggestions`}
          className="medicine-suggestions"
          role="listbox"
          aria-label="Подсказки названий"
          aria-live="polite"
        >
          <p className="medicine-suggestions__title">Другие подходящие варианты</p>
          {suggestions.slice(1).map((suggestion) => (
            <button
              type="button"
              className="medicine-suggestion"
              role="option"
              aria-selected={false}
              key={suggestion}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
