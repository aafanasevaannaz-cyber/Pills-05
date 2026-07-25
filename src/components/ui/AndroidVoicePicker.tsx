'use client'

import type { AndroidVoiceOption } from '@/features/sound/nativeAudio'

interface AndroidVoicePickerProps {
  voices: AndroidVoiceOption[]
  value: string
  onChange: (value: string) => void
}

export const AndroidVoicePicker = ({ voices, value, onChange }: AndroidVoicePickerProps) => {
  if (voices.length === 0) {
    return (
      <div className="status-strip">
        Приложение использует стандартный русский голос, установленный в Android. Дополнительные голоса на этом устройстве не найдены.
      </div>
    )
  }

  return (
    <label className="ui-field">
      <span className="ui-label">Какой голос использовать</span>
      <select
        className="ui-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Стандартный русский голос Android</option>
        {voices.map((voice) => (
          <option value={voice.name} key={voice.name}>
            {voice.label}{voice.networkRequired ? ' · нужен интернет' : ' · работает офлайн'}
          </option>
        ))}
      </select>
      <span className="ui-help">Набор голосов зависит от телефона и установленного речевого движка Android.</span>
    </label>
  )
}
