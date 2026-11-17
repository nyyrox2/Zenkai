import { useNameStyles } from '../lib/nameStyles'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'

/** Any member's name in their equipped effect / font / colour. Plain text until their style has loaded. */
export function UserName({ id, name, className }: { id?: string; name: string; className?: string }) {
  const st = useNameStyles([id])[id ?? '']
  if (!st) return <>{name}</>
  return <TextEffectRenderer text={name} effectId={st.effect} fontId={st.font} colorId={st.color ?? 'default'} fallbackClass="text-foreground" className={className} />
}
