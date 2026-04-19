import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Напоминание о лекарствах',
  description: 'Простое приложение для пожилых людей',
  viewport: 'width=device-width, initial-scale=1',
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
      <body className="bg-gray-50 m-0 p-0">
        <main className="max-w-2xl mx-auto bg-white min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
