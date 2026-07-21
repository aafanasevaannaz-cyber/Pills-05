import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'
import '@/styles/realme-fixes.css'
import '@/styles/reminders.css'
import '@/styles/soft-contrast.css'
import '@/styles/brand-autocomplete.css'
import '@/styles/qa-ux.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { DiagnosticsProvider } from '@/components/DiagnosticsProvider'
import { BottomNav } from '@/components/BottomNav'
import { BrandMark } from '@/components/BrandMark'
import { AndroidUxEnhancer } from '@/components/AndroidUxEnhancer'

export const metadata: Metadata = {
  title: 'Мои таблетки',
  description: 'Понятные напоминания о приёме лекарств',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d9d2c7' },
    { media: '(prefers-color-scheme: dark)', color: '#151714' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <DiagnosticsProvider>
          <ThemeProvider>
            <div className="app-frame">
              <main>{children}</main>
              <footer className="app-brand-footer" aria-label="Автор приложения Chaipodusham">
                <BrandMark compact />
              </footer>
              <BottomNav />
              <AndroidUxEnhancer />
            </div>
          </ThemeProvider>
        </DiagnosticsProvider>
      </body>
    </html>
  )
}
