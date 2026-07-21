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
import {
  downloadDiagnosticReport,
  runMedicineAutocompleteSelfTest,
  shareDiagnosticReport,
} from '@/lib/diagnostics'

export default function SettingsPage() {
  const settings = useSettingsStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [autocompleteResult, setAutocompleteResult] = useState<string>('')

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

  const handleDiagnostics = async () => {
    setBusy(true)
    setStatus('')
    try {
      await downloadDiagnosticReport()
      setStatus('Файл диагностики создан. Пришлите его вместе с описанием, что нажимали перед ошибкой.')
    } catch (error) {
      console.error('Diagnostics export failed:', error)
      setStatus('Не удалось создать диагностический отчёт.')
    } finally {
      setBusy(false)
    }
  }

  const handleDiagnosticsShare = async () => {
    setBusy(true)
    setStatus('')
    try {
      const result = await shareDiagnosticReport()
      setStatus(
        result === 'shared'
          ? 'Открыто меню отправки диагностического отчёта.'
          : result === 'copied'
            ? 'Диагностический отчёт скопирован. Вставьте его в сообщение.'
            : 'Отчёт сохранён файлом, потому что отправка недоступна.'
      )
    } catch (error) {
      console.error('Diagnostics sharing failed:', error)
      setStatus('Не удалось подготовить отчёт для отправки.')
    } finally {
      setBusy(false)
    }
  }

  const handleAutocompleteTest = () => {
    const result = runMedicineAutocompleteSelfTest()
    const passedCount = result.checks.filter((check) => check.passed).length
    setAutocompleteResult(
      result.passed
        ? `Словарь работает: ${passedCount} из ${result.checks.length} проверок пройдено. Если подсказки не видны, проблема именно в экране или клавиатуре — это будет записано в отчёт.`
        : `Ошибка словаря: пройдено ${passedCount} из ${result.checks.length}. Сразу отправьте диагностический отчёт.`
    )
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
  const voiceDescription = settings.defaultVoiceMode === 'recorded'
    ? 'выбрана общая запись'
    : settings.defaultVoiceMode === 'off'
      ? 'голос выключен'
      : 'выбран русский голос Android'

  return (
    <div className="app-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Настройки</h1>
          <p className="app-subtitle">Оформление, звук, диагностика и перенос данных</p>
        </div>
      </header>

      <div className="page-stack">
        <Card className="settings-feature-card ui-card--warning">
          <div>
            <h2 className="section-title">Звук и голос по умолчанию</h2>
            <p className="muted">
              Сигнал «{selectedSound.title}», {voiceDescription}. Эти настройки предлагаются при добавлении нового лекарства.
            </p>
          </div>
          <Link href="/sound" className="ui-button ui-button--primary ui-button--full">
            Настроить сигнал и общую запись
          </Link>
        </Card>

        <Card>
          <h2 className="section-title">Оформление</h2>
          <p className="muted">Во всех вариантах убраны чисто-белые поверхности и резкие кислотные цвета.</p>
          <div className="choice-grid">
            {[
              { id: 'light', title: 'Приглушённая', description: 'Тёплый серо-бежевый фон без ярко-белых карточек' },
              { id: 'dark', title: 'Ночная', description: 'Очень спокойный тёмный фон и мягкий текст' },
              { id: 'high-contrast', title: 'Чёткая', description: 'Выше читаемость, но без белого по чёрному и жёлтых вспышек' },
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
          <h2 className="section-title">Диагностика ошибок</h2>
          <p className="muted">
            Приложение записывает падения и действия вокруг поля названия: длину текста, число найденных вариантов, работу клавиатуры и нажатия. Само название лекарства не сохраняется.
          </p>
          <p className="diagnostic-note">Сначала повторите ошибку, затем сразу откройте этот раздел и отправьте отчёт.</p>
          <div className="diagnostic-actions">
            <Button variant="primary" className="ui-button--full" disabled={busy} onClick={() => void handleDiagnosticsShare()}>
              Отправить журнал ошибки
            </Button>
            <Button variant="secondary" className="ui-button--full" disabled={busy} onClick={() => void handleDiagnostics()}>
              Сохранить журнал файлом
            </Button>
            <Button variant="secondary" className="ui-button--full" disabled={busy} onClick={handleAutocompleteTest}>
              Проверить словарь подсказок
            </Button>
          </div>
          {autocompleteResult && <div className="diagnostic-result" role="status">{autocompleteResult}</div>}
        </Card>

        <Card>
          <h2 className="section-title">Перенос на другое устройство</h2>
          <p className="muted">
            В резервную копию входят лекарства, расписание, история, звук и оформление. Голосовые аудиофайлы остаются только на этом устройстве.
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
