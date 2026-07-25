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

const twoDigits = (value: number) => String(value).padStart(2, '0')
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))

const normalizeTime = (hours: number, minutes: number) =>
  `${twoDigits(clamp(hours, 0, 23))}:${twoDigits(clamp(minutes, 0, 59))}`

const parts = (time: string): [number, number] => {
  const [hours, minutes] = time.split(':').map(Number)
  return [clamp(hours, 0, 23), clamp(minutes, 0, 59)]
}

export const MedicineScheduleEditor = ({ times, onChange }: MedicineScheduleEditorProps) => {
  const safeTimes = times.length ? times : ['08:00']

  const replace = (index: number, nextTime: string) => {
    onChange(safeTimes.map((time, current) => current === index ? nextTime : time))
  }

  const setCount = (count: number) => {
    const preset = presets[count]
    if (preset) {
      const next = preset.map((fallback, index) => safeTimes[index] ?? fallback)
      onChange(next)
    }
  }

  const addTime = () => {
    const [lastHours, lastMinutes] = parts(safeTimes[safeTimes.length - 1] ?? '08:00')
    onChange([...safeTimes, normalizeTime((lastHours + 4) % 24, lastMinutes)])
  }

  const removeTime = (index: number) => {
    if (safeTimes.length <= 1) return
    onChange(safeTimes.filter((_, current) => current !== index))
  }

  return (
    <div className="schedule-editor page-stack">
      <div>
        <span className="ui-label">Сколько раз в день?</span>
        <div className="schedule-count-grid" role="group" aria-label="Количество приёмов в день">
          {[1, 2, 3, 4].map((count) => (
            <button
              type="button"
              className={`schedule-count${safeTimes.length === count ? ' is-selected' : ''}`}
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
        {safeTimes.map((time, index) => {
          const [hours, minutes] = parts(time)
          return (
            <section className="schedule-time-row" key={`${index}-${time}`}>
              <div className="schedule-time-row__heading">
                <strong>Приём {index + 1}</strong>
                {safeTimes.length > 1 && (
                  <button type="button" className="schedule-time-remove" onClick={() => removeTime(index)}>
                    Удалить
                  </button>
                )}
              </div>
              <div className="schedule-time-inputs" aria-label={`Время приёма ${index + 1}`}>
                <label>
                  <span>Часы</span>
                  <input
                    className="ui-input schedule-number-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(event) => replace(index, normalizeTime(Number(event.target.value), minutes))}
                  />
                </label>
                <span className="schedule-time-colon" aria-hidden="true">:</span>
                <label>
                  <span>Минуты</span>
                  <input
                    className="ui-input schedule-number-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(event) => replace(index, normalizeTime(hours, Number(event.target.value)))}
                  />
                </label>
              </div>
              <div className="schedule-minute-shortcuts" aria-label="Быстрый выбор минут">
                {[0, 15, 30, 45].map((minute) => (
                  <button
                    type="button"
                    className={minutes === minute ? 'is-selected' : ''}
                    aria-pressed={minutes === minute}
                    key={minute}
                    onClick={() => replace(index, normalizeTime(hours, minute))}
                  >
                    :{twoDigits(minute)}
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <Button variant="secondary" className="ui-button--full" onClick={addTime}>
        + Добавить ещё время
      </Button>
    </div>
  )
}
