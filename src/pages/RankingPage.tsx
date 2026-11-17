import { Trophy } from 'lucide-react'
import { Leaderboard } from '../components/Leaderboard'

export default function RankingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-24 sm:px-6">
      <header className="relative mb-8 overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-b from-accent/20 via-accent/5 to-transparent px-5 py-6 text-center">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-accent/20 text-accent"><Trophy className="size-6" /></span>
        <h1 className="font-display text-3xl font-black uppercase tracking-widest">Hall of Hunters</h1>
        <p className="mt-1 text-sm text-muted">Top 50 by level. Earn XP by watching and reading.</p>
      </header>
      <Leaderboard podium />
    </main>
  )
}
