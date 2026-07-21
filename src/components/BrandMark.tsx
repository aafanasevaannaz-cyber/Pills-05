import React from 'react'

type BrandMarkProps = {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand-mark${compact ? ' brand-mark--compact' : ''}`} aria-hidden="true">
      <img
        className="brand-mark__image"
        src="/brand/chaipodusham.svg"
        alt=""
        width={720}
        height={158}
      />
    </div>
  )
}
