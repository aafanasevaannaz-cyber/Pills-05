import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Напоминание о лекарствах',
  description: 'Простое приложение для пожилых людей',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="bg-gray-50">
        <main className="max-w-2xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
