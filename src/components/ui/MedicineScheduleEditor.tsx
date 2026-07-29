'use client'

import { Button } from '@/components/ui/Button'

interface MedicineScheduleEditorProps {
  times: string[]
  onChange: (times: string[]) => void
}

const presets: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
}

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const twoDigits = (value: number) => String(value).padStart(2, '0')
const normalizeTime = (value: string, fallback = '08:00') => validTime(value) ? value : fallback

const addMinutes = (time: string, delta: number) => {
  const [hours, minutes] = normalizeTime(time).split(':').map(Number)
  const dayMinutes = 24 * 60
  const total = ((hours * 60 + minutes + delta) % dayMinutes + dayMinutes) % dayMinutes
  return `${twoDigits(Math.floor(total / 60))}:${twoDigits(total % 60)}`
}

export const MedicineScheduleEditor = ({ times, onChange }: MedicineScheduleEditorProps) => {
  const safeTimes = times.length ? times.map((time, index) => normalizeTime(time, presets[4][index] ?? '08:00')) : ['08:00']
  const hasDuplicates = new Set(safeTimes).size !== safeTimes.length

  const replace = (index: number, nextTime: string) => {
    if (!validTime(nextTime)) return
    onChange(safeTimes.map((time, current) => current === index ? nextTime : time))
  }

  const setCount = (count: number) => {
    const preset = presets[count]
    if (!preset) return
    onChange(preset.map((fallback, index) => safeTimes[index] ?? fallback))
  }

  const addTime = () => {
    const lastTime = safeTimes[safeTimes.length - 1] ?? '08:00'
    let candidate = addMinutes(lastTime, 4 * 60)
    for (let attempt = 0; attempt < 24 && safeTimes.includes(candidate); attempt += 1) {
      candidate = addMinutes(candidate, 60)
    }
    onChange([...safeTimes, candidate])
  }

  const removeTime = (index: number) => {
    if (safeTimes.length <= 1) return
    onChange(safeTimes.filter((_, current) => current !== index))
  }

  return (
    <div className="schedule-editor page-stack">
      <div className="schedule-count-section">
        <span className="ui-label">Сколько раз в день?</span>
        <div className="schedule-count-grid" role="group" aria-label="Количество приёмов в день">
          {[1, 2, 3, 4].map((count) => (
            <button
              type="button"
              className={`schedule-count${safeTimes.length === count ? ' is-selected' : ''}`}
              aria-label={`${count} ${count === 1 ? 'раз' : 'раза'} в день`}
              aria-pressed={safeTimes.length === count}
              key={count}
              onClick={() => setCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <div className="schedule-times page-stack">
        {safeTimes.map((time, index) => (
          <section className="schedule-time-row" key={`medicine-time-${index}`} aria-label={`Приём ${index + 1}`}>
            <strong className="schedule-time-index" aria-hidden="true">{index + 1}</strong>
            <input
              aria-label={`Время приёма ${index + 1}`}
              className="ui-input schedule-time-native-input"
              type="time"
              inputMode="none"
              lang="ru-RU"
              step={60}
              value={time}
              onChange={(event) => replace(index, event.target.value)}
            />
            <button
              type="button"
              className="schedule-time-step"
              aria-label={`Приём ${index + 1}, минус 15 минут`}
              onClick={() => replace(index, addMinutes(time, -15))}
            >
              −15
            </button>
            <button
              type="button"
              className="schedule-time-step"
              aria-label={`Приём ${index + 1}, плюс 15 минут`}
              onClick={() => replace(index, addMinutes(time, 15))}
            >
              +15
            </button>
            {safeTimes.length > 1 && (
              <button
                type="button"
                className="schedule-time-remove"
                aria-label={`Удалить время приёма ${index + 1}`}
                onClick={() => removeTime(index)}
              >
                ×
              </button>
            )}
          </section>
        ))}
      </div>

      {hasDuplicates && (
        <div className="status-strip status-strip--warning" role="alert">
          Два приёма стоят на одно время. Измените один из них.
        </div>
      )}

      <Button variant="secondary" className="ui-button--full schedule-add-time" onClick={addTime}>
        + Добавить ещё время
      </Button>
    </div>
  )
}
