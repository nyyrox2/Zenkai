import { useEffect, useState } from 'react'
import { ascensionCell, getAscensionState } from '../lib/ascension/ascensionStore'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'

/** The signed-in user's own name in their equipped effect / font / colour (live-updates when they change it). */
export function MyName({ name, colorOverride, className }: { name: string; colorOverride?: string | null; className?: string }) {
  const [s, setS] = useState(getAscensionState())
  useEffect(() => ascensionCell.subscribe(() => setS(getAscensionState())), [])
  return (
    <span className="-mx-4 -my-2.5 block min-w-0 truncate px-4 py-2.5">
      <TextEffectRenderer text={name} effectId={s.equippedTextEffect} fontId={s.equippedFontStyle} colorId={colorOverride || s.equippedNameColor} fallbackClass="text-foreground" className={className} />
    </span>
  )
}
