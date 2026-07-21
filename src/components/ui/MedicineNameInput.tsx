'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { findMedicineNameSuggestions, commonMedicineNames } from '@/data/medicineNames'
import { recordDiagnosticEvent } from '@/lib/diagnostics'

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
  const [focused, setFocused] = useState(false)
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastDiagnosticRef = useRef('')

  const suggestions = useMemo(() => {
    const current = normalize(value)
    return findMedicineNameSuggestions(value, existingNames, 10)
      .filter((suggestion) => normalize(suggestion) !== current)
  }, [existingNames, value])

  const firstSuggestion = suggestions[0]
  const open = value.trim().length > 0 && suggestions.length > 0

  useEffect(() => {
    const stateKey = [value.trim().length, suggestions.length, focused, composing].join(':')
    if (stateKey === lastDiagnosticRef.current) return
    lastDiagnosticRef.current = stateKey
    const timer = window.setTimeout(() => {
      recordDiagnosticEvent('autocomplete.state', {
        valueLength: value.trim().length,
        suggestionCount: suggestions.length,
        focused,
        composing,
        inputVisible: Boolean(inputRef.current?.offsetParent),
      })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [composing, focused, suggestions.length, value])

  const choose = (suggestion: string, source: 'primary' | 'list' | 'keyboard' | 'native') => {
    recordDiagnosticEvent('autocomplete.chosen', {
      source,
      valueLengthBefore: value.trim().length,
      selectedLength: suggestion.length,
      suggestionCount: suggestions.length,
    })
    onChange(suggestion)
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(suggestion.length, suggestion.length)
    }, 0)
  }

  const updateValue = (nextValue: string) => {
    onChange(nextValue)
  }

  return (
    <div className="ui-field medicine-autocomplete">
      <label className="ui-label" htmlFor={id}>Название</label>
      <input
        ref={inputRef}
        id={id}
        className="ui-input medicine-autocomplete__input"
        value={value}
        list={`${id}-native-names`}
        placeholder="Например: Нексиум"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        autoFocus={autoFocus}
        enterKeyHint="next"
        aria-autocomplete="both"
        aria-expanded={open}
        aria-controls={`${id}-suggestions`}
        onFocus={() => {
          setFocused(true)
          recordDiagnosticEvent('autocomplete.focus', { valueLength: value.trim().length })
        }}
        onBlur={() => {
          setFocused(false)
          recordDiagnosticEvent('autocomplete.blur', {
            valueLength: value.trim().length,
            suggestionCount: suggestions.length,
          })
        }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(event) => {
          setComposing(false)
          updateValue(event.currentTarget.value)
          recordDiagnosticEvent('autocomplete.compositionEnd', {
            valueLength: event.currentTarget.value.trim().length,
          })
        }}
        onInput={(event) => {
          const nextValue = event.currentTarget.value
          updateValue(nextValue)
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Tab' || event.key === 'ArrowRight') && firstSuggestion) {
            event.preventDefault()
            choose(firstSuggestion, 'keyboard')
          }
        }}
      />

      <datalist id={`${id}-native-names`}>
        {commonMedicineNames.map((name) => <option value={name} key={name} />)}
      </datalist>

      {open && firstSuggestion ? (
        <button
          type="button"
          className="medicine-autocomplete__complete"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => choose(firstSuggestion, 'primary')}
        >
          <span>Нажмите, чтобы дописать</span>
          <strong>{firstSuggestion}</strong>
        </button>
      ) : (
        <p className="ui-help medicine-autocomplete__help">
          После первой буквы здесь появится готовое название. Любое другое название можно написать вручную.
        </p>
      )}

      {suggestions.length > 1 && (
        <div
          id={`${id}-suggestions`}
          className="medicine-suggestions"
          role="listbox"
          aria-label="Подсказки названий"
          aria-live="polite"
        >
          <p className="medicine-suggestions__title">Другие варианты</p>
          {suggestions.slice(1, 6).map((suggestion) => (
            <button
              type="button"
              className="medicine-suggestion"
              role="option"
              aria-selected={false}
              key={suggestion}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion, 'list')}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
