'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  useSettingsStore,
  type Font,
  type TextSize,
  type Theme,
} from '@/features/settings/store'
import { playReminderChime } from '@/features/sound/player'
import {
  isNativeNotificationsAvailable,
  scheduleTestNotification,
} from '@/features/reminders/nativeNotifications.logic'
import { exportBackup, importBackupFile } from '@/lib/backup'

export default function SettingsPage() {
  const settings = useSettingsStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const testSound = async () => {
    setBusy(true)
    setStatus('')
    try {
      await playReminderChime(1)
      if (isNativeNotificationsAvailable()) {
        const scheduled = await scheduleTestNotification()
        setStatus(
          scheduled
            ? 'Сигнал прозвучал сейчас. Ещё одно проверочное уведомление придёт через несколько секунд.'
            : 'Разрешите уведомления для приложения в настройках телефона.'
        )
      } else {
        setStatus('Проверочный сигнал воспроизведён.')
      }
    } catch (error) {
      console.error('Sound test failed:', error)
      setStatus('Не удалось запустить проверку звука.')
    } finally {
      setBusy(false)
    }
  }

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

  return (
    <div className="app-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Настройки</h1>
          <p className="app-subtitle">Оформление, звук и перенос данных</p>
        </div>
      </header>

      <div className="page-stack">
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
          <p className="muted">Эти шрифты уже есть на устройстве и действительно меняются без интернета.</p>
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
          <h2 className="section-title">Звук и уведомления</h2>
          <div className="page-stack">
            <label className={`choice${settings.soundEnabled ? ' is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(event) => settings.setSoundEnabled(event.target.checked)}
              />
              <span className="choice__text">
                <span className="choice__title">Звуковой сигнал</span>
                <span className="choice__description">Проигрывать сигнал при открытом приложении</span>
              </span>
            </label>
            <label className={`choice${settings.voiceEnabled ? ' is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={settings.voiceEnabled}
                onChange={(event) => settings.setVoiceEnabled(event.target.checked)}
              />
              <span className="choice__text">
                <span className="choice__title">Голосом назвать лекарство</span>
                <span className="choice__description">Произнести название и дозировку по-русски</span>
              </span>
            </label>
            <label className={`choice${settings.pushNotificationsEnabled ? ' is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={settings.pushNotificationsEnabled}
                onChange={(event) => settings.setPushNotificationsEnabled(event.target.checked)}
              />
              <span className="choice__text">
                <span className="choice__title">Уведомления</span>
                <span className="choice__description">Показывать напоминания, когда приложение закрыто</span>
              </span>
            </label>
            <Button variant="primary" className="ui-button--full" disabled={busy} onClick={() => void testSound()}>
              Проверить звук и уведомление
            </Button>
            <p className="ui-help">
              Громкость закрытого приложения регулируется кнопками громкости и разделом «Уведомления» в Android. Приложение не может самовольно обойти беззвучный режим.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="section-title">Перенос на другое устройство</h2>
          <p className="muted">
            В резервную копию входят лекарства, расписание, история и оформление. Медицинские данные никуда не отправляются автоматически.
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
