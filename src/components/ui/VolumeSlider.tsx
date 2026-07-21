'use client'

import React, { useEffect } from 'react'
import { useAddMedicineUI } from '@/features/medicines/uiStore'
import {
  previewCustomVoice,
  previewReminderSound,
  previewReminderVoice,
  stopReminderPreview,
} from '@/features/sound/nativeAudio'
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
let previewTimer: number | undefined
let previewGeneration = 0

const scheduleAudioPreview = (play: () => Promise<void>) => {
  if (typeof window === 'undefined') return
  const generation = ++previewGeneration
  if (previewTimer) window.clearTimeout(previewTimer)
  void stopReminderPreview()
  previewTimer = window.setTimeout(() => {
    if (generation !== previewGeneration) return
    void play().catch((error) => {
      console.error('Live volume preview failed:', error)
    })
  }, 120)
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  id,
  label,
  value,
  onChange,
  help,
  disabled = false,
}) => {
  const customVoicePath = useAddMedicineUI((state) => state.customVoicePath)
  const selected = getReminderVolumeOption(value)
  const valueIndex = Math.max(0, volumeSteps.indexOf(value))

  useEffect(() => {
    if (id !== 'medicine-signal-volume') return

    const previewSelectedSignal = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('.sound-option') : null
      if (!target) return
      window.setTimeout(() => {
        const state = useAddMedicineUI.getState()
        scheduleAudioPreview(() => previewReminderSound(state.soundChoice, state.volumeChoice))
      }, 0)
    }

    document.addEventListener('click', previewSelectedSignal)
    return () => document.removeEventListener('click', previewSelectedSignal)
  }, [id])

  const previewValue = (next: ReminderVolume) => {
    const state = useAddMedicineUI.getState()

    if (id === 'medicine-signal-volume') {
      scheduleAudioPreview(() => previewReminderSound(state.soundChoice, next))
      return
    }

    if (id === 'medicine-android-voice-volume') {
      scheduleAudioPreview(() => previewReminderVoice('Тест', '', state.voiceRate, next))
      return
    }

    if (id === 'medicine-recorded-voice-volume' && state.customVoicePath) {
      scheduleAudioPreview(() => previewCustomVoice(state.customVoicePath, next))
    }
  }

  const previewHint = id === 'medicine-recorded-voice-volume' && !customVoicePath
    ? 'После записи двигайте бегунок — голос прозвучит с новой громкостью.'
    : 'Двигайте бегунок — выбранная громкость прозвучит сразу.'

  return (
    <div className="volume-slider">
      <div className="volume-slider__heading">
        <label className="ui-label" htmlFor={id}>{label}</label>
        <strong className="volume-slider__value">{selected.title}</strong>
      </div>
      {help && <p className="muted volume-slider__help">{help}</p>}
      <p className="muted volume-slider__help">{previewHint}</p>
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
          previewValue(next)
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
