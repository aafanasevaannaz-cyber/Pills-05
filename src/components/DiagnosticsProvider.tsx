'use client'

import { useEffect } from 'react'
import { installDiagnosticsCapture } from '@/lib/diagnostics'

export function DiagnosticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => installDiagnosticsCapture(), [])
  return <>{children}</>
}
