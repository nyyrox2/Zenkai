import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from './Avatar'
import { useLeaderboard, type RankedUser } from '../lib/ranking'
import { getHunterRank } from '../lib/ascension/types'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'
import { useNameStyles, type NameStyle } from '../lib/nameStyles'
import { ascensionCell, getAscensionState } from '../lib/ascension/ascensionStore'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'

/** Your own row reads the equipped style straight from this device, so it is right even before the cloud copy catches up. */
function useOwnStyle(active: boolean): NameStyle | undefined {
  const [s, setS] = useState(getAscensionState())
  useEffect(() => (active ? ascensionCell.subscribe(() => setS(getAscensionState())) : undefined), [active])
  return active ? { effect: s.equippedTextEffect, font: s.equippedFontStyle, color: s.equippedNameColor === 'default' ? null : s.equippedNameColor } : undefined
}

function Row({ u, i, st, me, big }: { u: RankedUser; i: number; st?: NameStyle; me: boolean; big: boolean }) {
  const rank = getHunterRank(u.level)
  const own = useOwnStyle(me)
  const s = own ?? st
  return (
    <Link
      to={`/u/${u.username}`}
      className={cn('relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/5', me && 'bg-foreground/5')}
    >
      {me && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
      <span className={cn('w-6 shrink-0 text-center font-display text-sm font-black tabular-nums', i < 3 ? 'text-foreground' : 'text-muted')}>{i + 1}</span>
      <Avatar name={u.name} src={u.avatar} frame={u.frame} size={big ? 48 : 40} />
      <span className="min-w-0 flex-1">
        <span className="block py-0.5 text-sm font-semibold">
          <TextEffectRenderer text={u.name} effectId={s?.effect ?? 'none'} fontId={s?.font ?? 'default'} colorId={s?.color ?? 'default'} fallbackClass="text-foreground" />
        </span>
        <span className="block truncate text-xs text-muted">{rank.name} · {rank.title}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold tabular-nums">Lv {u.level}</span>
        <span className="block text-[11px] text-muted tabular-nums">{u.totalXp.toLocaleString()} XP</span>
      </span>
    </Link>
  )
}

/** Top hunters by total XP (level). `limit` trims it for sidebars; `podium` puts the list in a card with the top 3 slightly larger. */
export function Leaderboard({ limit, className, podium }: { limit?: number; className?: string; podium?: boolean }) {
  const { rows, loading, failed } = useLeaderboard()
  const { user } = useAuth()
  const styles = useNameStyles(rows?.slice(0, limit).map((r) => r.id) ?? [])

  if (loading) return <p className="py-6 text-center text-sm text-muted">Loading ranking…</p>
  if (failed || !rows) return <p className="py-6 text-center text-sm text-muted">Couldn't load the ranking right now.</p>
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No ranked hunters yet. Watch something to earn XP!</p>

  return (
    <ol className={cn('overflow-hidden rounded-2xl', podium && 'divide-y divide-border border border-border bg-card', className)}>
      {rows.slice(0, limit).map((u, i) => (
        <li key={u.id}><Row u={u} i={i} st={styles[u.id]} me={user?.id === u.id} big={!!podium && i < 3} /></li>
      ))}
    </ol>
  )
}
