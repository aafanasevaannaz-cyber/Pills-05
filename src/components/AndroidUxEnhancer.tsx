'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { stopAllReminderAudio } from '@/features/sound/stopAllAudio'
import { recordDiagnosticEvent } from '@/lib/diagnostics'

export function AndroidUxEnhancer() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const root = document.documentElement
    root.dataset.globalBack = pathname === '/' ? 'false' : 'true'
    return () => {
      delete root.dataset.globalBack
    }
  }, [pathname])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const baseline = window.innerHeight
    const update = () => {
      const keyboardOpen = viewport.height < baseline * 0.76
      document.documentElement.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false'
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      delete document.documentElement.dataset.keyboardOpen
    }
  }, [])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('button')
      if (!button || !button.textContent?.includes('Остановить звук')) return
      void stopAllReminderAudio().then((stopped) => {
        recordDiagnosticEvent('audio.stopButton', { stopped })
      })
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  if (pathname === '/') return null

  return (
    <button
      type="button"
      className="global-back-button"
      data-global-back="true"
      onClick={() => {
        void stopAllReminderAudio()
        router.back()
      }}
      aria-label="Вернуться назад"
    >
      ← Назад
    </button>
  )
}
