import { Link } from 'react-router-dom'
import { Avatar } from './Avatar'
import { useLeaderboard } from '../lib/ranking'
import { getHunterRank } from '../lib/ascension/types'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'
import { useNameStyles } from '../lib/nameStyles'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'

const MEDAL = ['text-yellow-400', 'text-slate-300', 'text-amber-600']

/** Top hunters by total XP (level). `limit` trims it for sidebars. */
export function Leaderboard({ limit, className }: { limit?: number; className?: string }) {
  const { rows, loading, failed } = useLeaderboard()
  const { user } = useAuth()
  const styles = useNameStyles(rows?.slice(0, limit).map((r) => r.id) ?? [])

  if (loading) return <p className="py-6 text-center text-sm text-muted">Loading ranking…</p>
  if (failed || !rows) return <p className="py-6 text-center text-sm text-muted">Couldn't load the ranking right now.</p>
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No ranked hunters yet. Watch something to earn XP!</p>

  return (
    <ol className={cn('space-y-1', className)}>
      {rows.slice(0, limit).map((u, i) => {
        const rank = getHunterRank(u.level)
        const st = styles[u.id]
        return (
          <li key={u.id}>
            <Link
              to={`/u/${u.username}`}
              className={cn(
                'flex items-center gap-3 rounded-2xl p-2 transition hover:bg-foreground/5 active:scale-[0.98]',
                user?.id === u.id && 'bg-accent/10 ring-1 ring-accent/30',
              )}
            >
              <span className={cn('w-6 shrink-0 text-center font-display text-sm font-black tabular-nums', MEDAL[i] ?? 'text-muted')}>{i + 1}</span>
              <Avatar name={u.name} src={u.avatar} frame={u.frame} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block -mx-3 -my-1 truncate px-3 py-1 text-sm font-semibold"><TextEffectRenderer text={u.name} effectId={st?.effect ?? 'none'} fontId={st?.font ?? 'default'} colorId={st?.color ?? 'default'} fallbackClass="text-foreground" /></span>
                <span className="block truncate text-xs" style={{ color: rank.color }}>{rank.name} · {rank.title}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold tabular-nums">Lv {u.level}</span>
                <span className="block text-[10px] text-muted tabular-nums">{u.totalXp.toLocaleString()} XP</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
