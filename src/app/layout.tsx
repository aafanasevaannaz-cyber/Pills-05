import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'
import '@/styles/realme-fixes.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { BottomNav } from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'Мои лекарства',
  description: 'Понятные напоминания о приёме лекарств',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1ea' },
    { media: '(prefers-color-scheme: dark)', color: '#141816' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="app-frame">
            <main>{children}</main>
            <BottomNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
