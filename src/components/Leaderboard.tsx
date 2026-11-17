import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import { Avatar } from './Avatar'
import { useLeaderboard, type RankedUser } from '../lib/ranking'
import { getHunterRank } from '../lib/ascension/types'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'
import { useNameStyles, type NameStyle } from '../lib/nameStyles'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'

const MEDAL = ['text-yellow-400', 'text-slate-300', 'text-amber-600']
// podium slot order is 2nd, 1st, 3rd; index = rank - 1
const PODIUM = [
  { color: '#facc15', avatar: 84, height: 'h-28', delay: 0.15 },
  { color: '#cbd5e1', avatar: 64, height: 'h-20', delay: 0 },
  { color: '#d97706', avatar: 64, height: 'h-14', delay: 0.3 },
]

const Name = ({ u, st, className }: { u: RankedUser; st?: NameStyle; className?: string }) => (
  <TextEffectRenderer text={u.name} effectId={st?.effect ?? 'none'} fontId={st?.font ?? 'default'} colorId={st?.color ?? 'default'} fallbackClass="text-foreground" className={className} />
)

function PodiumSlot({ u, i, st, me }: { u: RankedUser; i: number; st?: NameStyle; me: boolean }) {
  const { color, avatar, height, delay } = PODIUM[i]
  const rank = getHunterRank(u.level)
  return (
    <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45, ease: 'easeOut' }} className="flex min-w-0 flex-1 flex-col items-center">
      <Link to={`/u/${u.username}`} className="flex w-full min-w-0 flex-col items-center gap-1.5 text-center active:scale-95">
        {i === 0 && <Crown className="size-6" style={{ color }} fill={color} fillOpacity={0.25} />}
        <span className="rounded-full p-1" style={{ boxShadow: `0 0 ${i === 0 ? 36 : 22}px ${color}66, inset 0 0 0 2px ${color}` }}>
          <Avatar name={u.name} src={u.avatar} frame={u.frame} size={avatar} />
        </span>
        <span className={cn('max-w-full px-1 text-sm font-bold leading-tight', me && 'underline decoration-accent underline-offset-4')}><Name u={u} st={st} /></span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: rank.color }}>{rank.name} · {rank.title}</span>
        <span className="text-xs font-bold tabular-nums">Lv {u.level}</span>
        <span className="text-[10px] text-muted tabular-nums">{u.totalXp.toLocaleString()} XP</span>
      </Link>
      <div className={cn('mt-2 grid w-full place-items-center rounded-t-2xl border border-b-0', height)} style={{ borderColor: `${color}55`, background: `linear-gradient(to bottom, ${color}33, transparent)` }}>
        <span className="font-display text-4xl font-black tabular-nums" style={{ color }}>{i + 1}</span>
      </div>
    </motion.div>
  )
}

/** Top hunters by total XP (level). `limit` trims it for sidebars; `podium` shows the top 3 on a podium and the rest as a list. */
export function Leaderboard({ limit, className, podium }: { limit?: number; className?: string; podium?: boolean }) {
  const { rows, loading, failed } = useLeaderboard()
  const { user } = useAuth()
  const styles = useNameStyles(rows?.slice(0, limit).map((r) => r.id) ?? [])

  if (loading) return <p className="py-6 text-center text-sm text-muted">Loading ranking…</p>
  if (failed || !rows) return <p className="py-6 text-center text-sm text-muted">Couldn't load the ranking right now.</p>
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No ranked hunters yet. Watch something to earn XP!</p>

  const top = podium ? rows.slice(0, 3) : []
  const start = top.length
  const slots = [1, 0, 2].filter((i) => top[i])

  return (
    <>
      {!!top.length && (
        <div className="mb-6 flex items-end gap-2">
          {slots.map((i) => <PodiumSlot key={top[i].id} u={top[i]} i={i} st={styles[top[i].id]} me={user?.id === top[i].id} />)}
        </div>
      )}
      <ol className={cn('space-y-1.5', className)}>
        {rows.slice(start, limit).map((u, j) => {
          const i = j + start
          const rank = getHunterRank(u.level)
          const st = styles[u.id]
          return (
            <li key={u.id}>
              <Link
                to={`/u/${u.username}`}
                className={cn(
                  'flex items-center gap-3 rounded-2xl p-2 transition hover:bg-foreground/5 active:scale-[0.98]',
                  podium && 'border border-border bg-card px-3 py-2.5',
                  user?.id === u.id && 'bg-accent/10 ring-1 ring-accent/30',
                )}
              >
                <span className={cn('w-6 shrink-0 text-center font-display text-sm font-black tabular-nums', MEDAL[i] ?? 'text-muted')}>{i + 1}</span>
                <Avatar name={u.name} src={u.avatar} frame={u.frame} size={podium ? 44 : 36} />
                <span className="min-w-0 flex-1">
                  <span className="block py-1 text-sm font-semibold"><Name u={u} st={st} /></span>
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
    </>
  )
}
