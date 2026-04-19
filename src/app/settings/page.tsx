'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useSettingsStore, Theme, TextSize, Font } from '@/features/settings/store'

export default function SettingsPage() {
  const {
    theme,
    textSize,
    font,
    reduceAnimations,
    soundEnabled,
    voiceEnabled,
    pushNotificationsEnabled,
    setTheme,
    setTextSize,
    setFont,
    setReduceAnimations,
    setSoundEnabled,
    setVoiceEnabled,
    setPushNotificationsEnabled,
    saveToDB,
  } = useSettingsStore()

  const handleChange = (fn: () => void) => {
    fn()
    saveToDB()
  }

  return (
    <div className="p-4 pb-20">
      <h1 className="text-3xl font-bold mb-6">Настройки</h1>

      {/* Тема */}
      <Card className="mb-4">
        <h2 className="text-2xl font-bold mb-4">Оформление</h2>

        <div className="mb-4">
          <label className="block text-lg font-semibold mb-3">Тема:</label>
          <div className="flex flex-col gap-2">
            {['light', 'dark', 'high-contrast'].map((t) => (
              <label key={t} className="flex items-center cursor-pointer p-2 rounded">
                <input
                  type="radio"
                  name="theme"
                  value={t}
                  checked={theme === t}
                  onChange={() => handleChange(() => setTheme(t as Theme))}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-lg">
                  {t === 'light'
                    ? 'Светлая'
                    : t === 'dark'
                      ? 'Темная'
                      : 'Высокий контраст'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-lg font-semibold mb-3">Размер текста:</label>
          <div className="flex flex-col gap-2">
            {['small', 'medium', 'large', 'extra-large'].map((size) => (
              <label key={size} className="flex items-center cursor-pointer p-2 rounded">
                <input
                  type="radio"
                  name="textSize"
                  value={size}
                  checked={textSize === size}
                  onChange={() => handleChange(() => setTextSize(size as TextSize))}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-lg">
                  {size === 'small'
                    ? 'Маленький'
                    : size === 'medium'
                      ? 'Обычный'
                      : size === 'large'
                        ? 'Большой'
                        : 'Очень большой'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-lg font-semibold mb-3">Шрифт:</label>
          <div className="flex flex-col gap-2">
            {['system', 'inter', 'roboto', 'open-sans', 'atkinson'].map((f) => (
              <label key={f} className="flex items-center cursor-pointer p-2 rounded">
                <input
                  type="radio"
                  name="font"
                  value={f}
                  checked={font === f}
                  onChange={() => handleChange(() => setFont(f as Font))}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-lg">
                  {f === 'system'
                    ? 'Системный'
                    : f === 'atkinson'
                      ? 'Atkinson (доступный)'
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center cursor-pointer p-2 rounded">
          <input
            type="checkbox"
            checked={reduceAnimations}
            onChange={(e) => handleChange(() => setReduceAnimations(e.target.checked))}
            className="mr-3 w-5 h-5"
          />
          <span className="text-lg">Уменьшить анимации</span>
        </label>
      </Card>

      {/* Уведомления */}
      <Card className="mb-4">
        <h2 className="text-2xl font-bold mb-4">Уведомления</h2>

        <label className="flex items-center cursor-pointer p-2 rounded mb-3">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => handleChange(() => setSoundEnabled(e.target.checked))}
            className="mr-3 w-5 h-5"
          />
          <span className="text-lg">Включить звук</span>
        </label>

        <label className="flex items-center cursor-pointer p-2 rounded mb-3">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={(e) => handleChange(() => setVoiceEnabled(e.target.checked))}
            className="mr-3 w-5 h-5"
          />
          <span className="text-lg">Включить голос</span>
        </label>

        <label className="flex items-center cursor-pointer p-2 rounded">
          <input
            type="checkbox"
            checked={pushNotificationsEnabled}
            onChange={(e) => handleChange(() => setPushNotificationsEnabled(e.target.checked))}
            className="mr-3 w-5 h-5"
          />
          <span className="text-lg">Push-уведомления</span>
        </label>
      </Card>

      <Link href="/">
        <Button variant="secondary" className="w-full">
          ← Вернуться
        </Button>
      </Link>
    </div>
  )
}
