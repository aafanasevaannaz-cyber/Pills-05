import React from 'react'

type BrandMarkProps = {
  compact?: boolean
  caption?: string
}

export function BrandMark({ compact = false, caption = 'Подарок с заботой' }: BrandMarkProps) {
  return (
    <div className={`brand-mark${compact ? ' brand-mark--compact' : ''}`}>
      <img
        className="brand-mark__image"
        src="/brand/chaipodusham.svg"
        alt="Chaipodusham"
        width={720}
        height={158}
      />
      {caption && <span className="brand-mark__caption">{caption}</span>}
    </div>
  )
}
