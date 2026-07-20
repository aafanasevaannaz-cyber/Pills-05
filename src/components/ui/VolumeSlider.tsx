'use client'

import React from 'react'
import {
  getReminderVolumeOption,
  reminderVolumeOptions,
  type ReminderVolume,
} from '@/features/sound/options'

interface VolumeSliderProps {
  id: string
  label: string
  value: ReminderVolume
  onChange: (value: ReminderVolume) => void
  help?: string
  disabled?: boolean
}

const volumeSteps: ReminderVolume[] = reminderVolumeOptions.map((option) => option.id)

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  id,
  label,
  value,
  onChange,
  help,
  disabled = false,
}) => {
  const selected = getReminderVolumeOption(value)
  const valueIndex = Math.max(0, volumeSteps.indexOf(value))

  return (
    <div className="volume-slider">
      <div className="volume-slider__heading">
        <label className="ui-label" htmlFor={id}>{label}</label>
        <strong className="volume-slider__value">{selected.title}</strong>
      </div>
      {help && <p className="muted volume-slider__help">{help}</p>}
      <input
        id={id}
        className="volume-slider__input"
        type="range"
        min={0}
        max={volumeSteps.length - 1}
        step={1}
        value={valueIndex}
        disabled={disabled}
        aria-valuetext={selected.title}
        onChange={(event) => {
          const next = volumeSteps[Number(event.target.value)] ?? 'maximum'
          onChange(next)
        }}
      />
      <div className="volume-slider__ticks" aria-hidden="true">
        {reminderVolumeOptions.map((option) => (
          <span key={option.id}>{option.title}</span>
        ))}
      </div>
    </div>
  )
}
