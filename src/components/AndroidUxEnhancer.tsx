'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useAddMedicineUI } from '@/features/medicines/uiStore'
import { previewReminderSound } from '@/features/sound/nativeAudio'
import { stopAllReminderAudio } from '@/features/sound/stopAllAudio'
import { recordDiagnosticEvent } from '@/lib/diagnostics'

const clampHour = (value: number) => ((value % 24) + 24) % 24
const clampMinute = (value: number) => ((value % 60) + 60) % 60
const two = (value: number) => String(value).padStart(2, '0')

function parseTime(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return { hour: 8, minute: 0 }
  return {
    hour: clampHour(Number(match[1])),
    minute: clampMinute(Number(match[2])),
  }
}

function updateNativeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

export function AndroidUxEnhancer() {
  const pathname = usePathname()
  const router = useRouter()
  const [timeInput, setTimeInput] = useState<HTMLInputElement | null>(null)
  const [hour, setHour] = useState(8)
  const [minute, setMinute] = useState(0)
  const currentTime = useMemo(() => `${two(hour)}:${two(minute)}`, [hour, minute])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.globalBack = pathname === '/' ? 'false' : 'true'
    return () => {
      delete root.dataset.globalBack
    }
  }, [pathname])

  const openTimePicker = (input: HTMLInputElement) => {
    const parsed = parseTime(input.value)
    setHour(parsed.hour)
    setMinute(parsed.minute)
    setTimeInput(input)
    input.blur()
    recordDiagnosticEvent('timePicker.opened', {
      hadValue: Boolean(input.value),
      nativePickerPrevented: true,
    })
  }

  useEffect(() => {
    const blockNativeTimePicker = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const input = target.closest('input[type="time"]') as HTMLInputElement | null
      if (!input) return
      event.preventDefault()
      event.stopPropagation()
      openTimePicker(input)
    }

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('button')
      if (!button) return
      const label = button.textContent?.replace(/\s+/g, ' ').trim() ?? ''

      if (label.includes('Остановить звук')) {
        event.preventDefault()
        event.stopPropagation()
        void stopAllReminderAudio().then((stopped) => {
          recordDiagnosticEvent('audio.stopButton', { stopped })
        })
        return
      }

      if (pathname.includes('/add') && button.classList.contains('sound-option')) {
        window.setTimeout(() => {
          const state = useAddMedicineUI.getState()
          void stopAllReminderAudio()
            .then(() => previewReminderSound(state.soundChoice, state.volumeChoice))
            .then(() => recordDiagnosticEvent('sound.previewSelected', { sound: state.soundChoice }))
            .catch((error) => console.error('Medicine sound preview failed:', error))
        }, 30)
      }
    }

    document.addEventListener('pointerdown', blockNativeTimePicker, true)
    document.addEventListener('click', blockNativeTimePicker, true)
    document.addEventListener('click', handleGlobalClick, true)
    return () => {
      document.removeEventListener('pointerdown', blockNativeTimePicker, true)
      document.removeEventListener('click', blockNativeTimePicker, true)
      document.removeEventListener('click', handleGlobalClick, true)
    }
  }, [pathname])

  const goBack = () => {
    const visibleBack = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .filter((button) => !button.dataset.globalBack && button.textContent?.trim() === 'Назад')
      .find((button) => !button.disabled)

    if (visibleBack) {
      visibleBack.click()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    router.back()
  }

  const confirmTime = () => {
    if (!timeInput) return
    updateNativeInput(timeInput, currentTime)
    recordDiagnosticEvent('timePicker.confirmed', {
      hour,
      minute,
    })
    setTimeInput(null)
  }

  return (
    <>
      {pathname !== '/' && (
        <button
          type="button"
          className="global-back-button"
          data-global-back="true"
          onClick={goBack}
          aria-label="Вернуться назад"
        >
          ← Назад
        </button>
      )}

      {timeInput && (
        <div className="custom-time-overlay" role="dialog" aria-modal="true" aria-labelledby="custom-time-title">
          <div className="custom-time-panel">
            <h2 id="custom-time-title">Выберите время</h2>
            <p className="muted">Спокойный выбор времени внутри приложения</p>

            <div className="custom-time-display" aria-live="polite">{currentTime}</div>

            <div className="custom-time-controls">
              <div className="custom-time-column">
                <span className="custom-time-label">Часы</span>
                <button type="button" onClick={() => setHour((value) => clampHour(value + 1))}>+ час</button>
                <button type="button" onClick={() => setHour((value) => clampHour(value - 1))}>− час</button>
              </div>
              <div className="custom-time-column">
                <span className="custom-time-label">Минуты</span>
                <button type="button" onClick={() => setMinute((value) => clampMinute(value + 5))}>+ 5 минут</button>
                <button type="button" onClick={() => setMinute((value) => clampMinute(value - 5))}>− 5 минут</button>
              </div>
            </div>

            <div className="custom-time-actions">
              <Button variant="secondary" onClick={() => setTimeInput(null)}>Отмена</Button>
              <Button variant="primary" onClick={confirmTime}>Выбрать {currentTime}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
