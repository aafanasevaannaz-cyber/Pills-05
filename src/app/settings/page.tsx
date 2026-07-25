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

type SettingsTab = 'main' | 'appearance' | 'data' | 'diagnostics'

const tabs: Array<{ id: SettingsTab; title: string }> = [
  { id: 'main', title: 'Главное' },
  { id: 'appearance', title: 'Вид' },
  { id: 'data', title: 'Данные' },
  { id: 'diagnostics', title: 'Ошибки' },
]

export default function SettingsPage() {
  const settings = useSettingsStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('main')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [autocompleteResult, setAutocompleteResult] = useState('')

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
      setStatus('Файл диагностики создан. Пришлите его вместе с описанием ошибки.')
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
          ? 'Открыто меню отправки журнала.'
          : result === 'copied'
            ? 'Журнал скопирован. Вставьте его в сообщение.'
            : 'Журнал сохранён файлом.'
      )
    } catch (error) {
      console.error('Diagnostics sharing failed:', error)
      setStatus('Не удалось подготовить журнал.')
    } finally {
      setBusy(false)
    }
  }

  const handleAutocompleteTest = () => {
    const result = runMedicineAutocompleteSelfTest()
    const passedCount = result.checks.filter((check) => check.passed).length
    setAutocompleteResult(
      result.passed
        ? `Словарь работает: ${passedCount} из ${result.checks.length} проверок.`
        : `Ошибка словаря: пройдено ${passedCount} из ${result.checks.length}. Отправьте журнал.`
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
    ? 'общая запись'
    : settings.defaultVoiceMode === 'off'
      ? 'без голоса'
      : 'русский голос Android'

  return (
    <div className="app-page settings-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Настройки</h1>
          <p className="app-subtitle">Выберите раздел — длинной страницы больше нет</p>
        </div>
      </header>

      <nav className="settings-tabs" aria-label="Разделы настроек">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`settings-tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              setStatus('')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            {tab.title}
          </button>
        ))}
      </nav>

      <div className="settings-panel" style={{ marginTop: 14 }}>
        {activeTab === 'main' && (
          <>
            <Card className="settings-feature-card ui-card--warning">
              <div>
                <h2 className="section-title">Звук и голос</h2>
                <p className="muted">
                  Сейчас: «{selectedSound.title}», {voiceDescription}.
                </p>
              </div>
              <Link href="/sound" className="ui-button ui-button--primary ui-button--full">
                Настроить звук и голос
              </Link>
            </Card>

            <Card>
              <h2 className="section-title">Движение интерфейса</h2>
              <label className={`choice${settings.reduceAnimations ? ' is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={settings.reduceAnimations}
                  onChange={(event) => settings.setReduceAnimations(event.target.checked)}
                />
                <span className="choice__text">
                  <span className="choice__title">Уменьшить анимации</span>
                  <span className="choice__description">Меньше движения и мерцания</span>
                </span>
              </label>
            </Card>
          </>
        )}

        {activeTab === 'appearance' && (
          <>
            <Card>
              <h2 className="section-title">Цветовая тема</h2>
              <div className="choice-grid">
                {[
                  { id: 'light', title: 'Приглушённая', description: 'Тёплый серо-бежевый фон' },
                  { id: 'dark', title: 'Ночная', description: 'Спокойный тёмный фон' },
                  { id: 'high-contrast', title: 'Чёткая', description: 'Выше читаемость без кислотных цветов' },
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
                  { id: 'extra-large', title: 'Очень большой', description: '24 пикселя' },
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
              <div className="choice-grid">
                {[
                  { id: 'system', title: 'Обычный', description: 'Стандартный Android' },
                  { id: 'serif', title: 'Книжный', description: 'С засечками' },
                  { id: 'mono', title: 'Ровный', description: 'Одинаковая ширина символов' },
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
          </>
        )}

        {activeTab === 'data' && (
          <Card>
            <h2 className="section-title">Перенос на другое устройство</h2>
            <p className="muted">
              В копию входят лекарства, расписание, история, звук и оформление. Голосовые файлы остаются на этом устройстве.
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
        )}

        {activeTab === 'diagnostics' && (
          <Card>
            <h2 className="section-title">Диагностика ошибок</h2>
            <p className="muted">
              Сначала повторите ошибку. Затем отправьте журнал: в нём есть действия интерфейса и системные ошибки, но нет названий лекарств и дозировок.
            </p>
            <div className="diagnostic-actions">
              <Button variant="primary" className="ui-button--full" disabled={busy} onClick={() => void handleDiagnosticsShare()}>
                Отправить журнал ошибки
              </Button>
              <Button variant="secondary" className="ui-button--full" disabled={busy} onClick={() => void handleDiagnostics()}>
                Сохранить журнал файлом
              </Button>
              <Button variant="secondary" className="ui-button--full" disabled={busy} onClick={handleAutocompleteTest}>
                Проверить подсказки названий
              </Button>
            </div>
            {autocompleteResult && <div className="diagnostic-result" role="status">{autocompleteResult}</div>}
          </Card>
        )}

        {status && <div className="status-strip" role="status">{status}</div>}
      </div>
    </div>
  )
}
