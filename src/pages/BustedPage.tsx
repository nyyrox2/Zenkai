import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuroraBackground } from '../components/AuroraBackground'
import { GhostBuddy } from '../components/GhostBuddy'
import { useShield } from '../lib/shield'

const ROASTS = [
  'Ooh, inspecting the code? Bold. The ghost sees you.',
  'Nothing in there but div soup and my feelings.',
  'You came to watch anime and chose violence (F12).',
  'Plot twist: the real stream was the friends we made along the way.',
  'Hacker voice: "I\'m in." Me: you are in a div.',
  'Close it and I will pretend this never happened. Promise.',
  'Even the ghost has better debugging skills than this.',
  'Bold of you to assume I store secrets in the frontend.',
  'Your episode is waiting. The console is not an episode.',
]

/** Where the DevTools check sends people (see ShieldGate). Roasts them kindly, then sends them back once DevTools are closed. */
export default function BustedPage() {
  const { devtools } = useShield()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/home'

  useEffect(() => {
    document.title = 'Busted — Zenkai'
  }, [])
  useEffect(() => {
    if (devtools) return
    const t = window.setTimeout(() => navigate(from, { replace: true }), 2500)
    return () => clearTimeout(t)
  }, [devtools, from, navigate])

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-4 text-center">
      <AuroraBackground />
      <div className="relative">
        <div className="pt-14"><GhostBuddy lines={ROASTS} className="size-36 sm:size-48" /></div>
        <h1 className="mt-6 font-display text-3xl font-black tracking-tight sm:text-5xl">Caught you peeking 👀</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">
          {devtools ? 'Developer Tools are open. Close them and I will take you right back.' : 'Aww, you closed it. Taking you back...'}
        </p>
        {!devtools && (
          <button type="button" onClick={() => navigate(from, { replace: true })} className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform active:scale-95">
            Take me back now
          </button>
        )}
        <p className="mt-10 text-[11px] text-muted/60">Poke the ghost. It has opinions.</p>
      </div>
    </main>
  )
}
