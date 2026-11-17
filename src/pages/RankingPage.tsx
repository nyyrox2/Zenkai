import { Leaderboard } from '../components/Leaderboard'

export default function RankingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-24 sm:px-6">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Ranking</p>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Hall of Hunters</h1>
        <p className="mt-1 text-sm text-muted">Top 50 by level. Earn XP by watching and reading.</p>
      </header>
      <Leaderboard podium />
    </main>
  )
}
