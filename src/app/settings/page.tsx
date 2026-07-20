'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  useSettingsStore,
  type Font,
  type TextSize,
  type Theme,
} from '@/features/settings/store'
import { getReminderSoundOption } from '@/features/sound/options'
import { exportBackup, importBackupFile } from '@/lib/backup'

export default function SettingsPage() {
  const settings = useSettingsStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    setBusy(true)
    setStatus('')
    try {
      await exportBackup()
      setStatus('Резервная копия создана. Сохраните файл в надёжном месте.')
    } catch (error) {
      console.error('Backup export failed:', error)
      setStatus('Не удалось создать резервную копию.')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy(true)
    setStatus('')
    try {
      await importBackupFile(file)
      setStatus('Данные восстановлены. Приложение сейчас перезапустится.')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      console.error('Backup import failed:', error)
      setStatus(error instanceof Error ? error.message : 'Не удалось восстановить данные.')
    } finally {
      setBusy(false)
    }
  }

  const selectedSound = getReminderSoundOption(settings.soundChoice)

  return (
    <div className="app-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Настройки</h1>
          <p className="app-subtitle">Оформление, звук и перенос данных</p>
        </div>
      </header>

      <div className="page-stack">
        <Card className="settings-feature-card ui-card--warning">
          <div>
            <h2 className="section-title">Звук и голос</h2>
            <p className="muted">
              Сейчас выбран сигнал «{selectedSound.title}». Голосовая озвучка {settings.voiceEnabled ? 'включена' : 'выключена'}.
            </p>
          </div>
          <Link href="/sound" className="ui-button ui-button--primary ui-button--full">
            Настроить и проверить звук
          </Link>
        </Card>

        <Card>
          <h2 className="section-title">Тема</h2>
          <div className="choice-grid">
            {[
              { id: 'light', title: 'Светлая', description: 'Светлый фон и тёмный текст' },
              { id: 'dark', title: 'Тёмная', description: 'Тёмный фон без белых пятен' },
              { id: 'high-contrast', title: 'Высокий контраст', description: 'Чёрный, белый и жёлтый' },
            ].map((option) => (
              <label className={`choice${settings.theme === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="theme"
                  checked={settings.theme === option.id}
                  onChange={() => settings.setTheme(option.id as Theme)}
                />
                <span className="choice__text">
                  <span className="choice__title">{option.title}</span>
                  <span className="choice__description">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="section-title">Размер текста</h2>
          <div className="choice-grid">
            {[
              { id: 'small', title: 'Компактный', description: '16 пикселей' },
              { id: 'medium', title: 'Обычный', description: '18 пикселей' },
              { id: 'large', title: 'Большой', description: '21 пиксель' },
              { id: 'extra-large', title: 'Очень большой', description: '24 пикселя и крупные кнопки' },
            ].map((option) => (
              <label className={`choice${settings.textSize === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="textSize"
                  checked={settings.textSize === option.id}
                  onChange={() => settings.setTextSize(option.id as TextSize)}
                />
                <span className="choice__text">
                  <span className="choice__title">{option.title}</span>
                  <span className="choice__description">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="section-title">Шрифт</h2>
          <p className="muted">Эти шрифты уже есть на устройстве и работают без интернета.</p>
          <div className="choice-grid">
            {[
              { id: 'system', title: 'Обычный', description: 'Стандартный шрифт Android' },
              { id: 'serif', title: 'Книжный', description: 'Буквы с засечками' },
              { id: 'mono', title: 'Ровный', description: 'Все символы одинаковой ширины' },
            ].map((option) => (
              <label className={`choice${settings.font === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="font"
                  checked={settings.font === option.id}
                  onChange={() => settings.setFont(option.id as Font)}
                />
                <span className="choice__text">
                  <span className="choice__title">{option.title}</span>
                  <span className="choice__description">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="section-title">Перенос на другое устройство</h2>
          <p className="muted">
            В резервную копию входят лекарства, расписание, история, звук и оформление. Медицинские данные никуда не отправляются автоматически.
          </p>
          <div className="form-actions">
            <Button variant="primary" disabled={busy} onClick={() => void handleExport()}>
              Сохранить резервную копию
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
              Восстановить из файла
            </Button>
          </div>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImport(event)}
          />
        </Card>

        <Card>
          <h2 className="section-title">Движение</h2>
          <label className={`choice${settings.reduceAnimations ? ' is-selected' : ''}`}>
            <input
              type="checkbox"
              checked={settings.reduceAnimations}
              onChange={(event) => settings.setReduceAnimations(event.target.checked)}
            />
            <span className="choice__text">
              <span className="choice__title">Уменьшить анимации</span>
              <span className="choice__description">Убрать лишнее движение интерфейса</span>
            </span>
          </label>
        </Card>

        {status && <div className="status-strip" role="status">{status}</div>}
      </div>
    </div>
  )
}
