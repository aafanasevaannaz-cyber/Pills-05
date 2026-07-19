'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Сегодня', icon: '●' },
  { href: '/medicines', label: 'Лекарства', icon: '▦' },
  { href: '/history', label: 'История', icon: '✓' },
  { href: '/settings', label: 'Настройки', icon: '⚙' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" aria-label="Основные разделы">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
