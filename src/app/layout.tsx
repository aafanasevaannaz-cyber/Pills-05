import type { Metadata } from 'next'
import '@/styles/globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Напоминание о лекарствах',
  description: 'Простое приложение для пожилых людей',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="m-0 p-0">
        <ThemeProvider>
          <main className="max-w-2xl mx-auto min-h-screen">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
