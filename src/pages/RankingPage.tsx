import { Trophy } from 'lucide-react'
import { Leaderboard } from '../components/Leaderboard'

export default function RankingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-24 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent/15 text-accent"><Trophy className="size-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Ranking</h1>
          <p className="text-sm text-muted">Top 50 hunters by level. Earn XP by watching and reading.</p>
        </div>
      </header>
      <Leaderboard />
    </main>
  )
}
