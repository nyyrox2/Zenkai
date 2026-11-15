import React, { useEffect } from 'react'
import {
  ascensionCell,
  dismissLevelUp,
  setAscensionSound,
} from '../../lib/ascension/ascensionStore'
import { getHunterRank } from '../../lib/ascension/types'
import { HunterRankBadge } from './HunterRankBadge'

/** Synthesize a futuristic Solo Leveling system chime via Web Audio API */
function playLevelUpChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // Synth chord 1: C5 -> G5 -> C6 high tech chime
    const freqs = [523.25, 659.25, 783.99, 1046.5]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.08)

      gain.gain.setValueAtTime(0.001, now + idx * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.08 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.8)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.85)
    })
  } catch {}
}

export const SystemLevelUpModal: React.FC = () => {
  const [state, setState] = React.useState(ascensionCell.get())

  useEffect(() => {
    return ascensionCell.subscribe(() => {
      setState(ascensionCell.get())
    })
  }, [])

  const levelUp = state.pendingLevelUp

  useEffect(() => {
    if (levelUp && state.soundEnabled) {
      playLevelUpChime()
    }
  }, [levelUp, state.soundEnabled])

  if (!levelUp) return null

  const rank = getHunterRank(levelUp.newLevel)
  const isRankUp = levelUp.newRank !== levelUp.oldRank

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Background Holographic Halo */}
      <div
        className="absolute -inset-10 opacity-30 blur-3xl pointer-events-none rounded-full"
        style={{
          background: `radial-gradient(circle, ${rank.color} 0%, transparent 70%)`,
        }}
      />

      {/* Solo Leveling System Window */}
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-500/50 bg-[#090b10] shadow-[0_0_50px_rgba(0,240,255,0.25)] text-white p-6 sm:p-8"
        style={{
          borderColor: rank.borderColor,
          boxShadow: `0 0 40px ${rank.glowColor}`,
        }}
      >
        {/* Top Tech Border Banner */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        {/* System Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-semibold">
              SYSTEM NOTIFICATION // QUEST REWARD
            </span>
          </div>

          <button
            onClick={() => setAscensionSound(!state.soundEnabled)}
            className="text-xs font-mono text-white/50 hover:text-white px-2 py-0.5 rounded border border-white/10 transition-colors"
            title={state.soundEnabled ? 'Mute level up chime' : 'Unmute level up chime'}
          >
            {state.soundEnabled ? '🔊 SFX ON' : '🔇 SFX OFF'}
          </button>
        </div>

        {/* Level Up Announcement */}
        <div className="text-center py-6">
          <div className="inline-block px-3 py-1 mb-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono uppercase tracking-widest font-bold">
            LEVEL UP!
          </div>

          <h2 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-white mb-2">
            LEVEL <span className="text-cyan-400 font-mono">{levelUp.newLevel}</span>
          </h2>

          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-sm text-white/50 font-mono">
              LVL {levelUp.oldLevel}
            </span>
            <span className="text-cyan-400 font-bold">➔</span>
            <HunterRankBadge levelOrTier={levelUp.newLevel} size="md" showTitle={true} />
          </div>

          {isRankUp && (
            <div className="mt-4 p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-300 text-xs font-mono font-semibold animate-pulse">
              ⚡ RANK AWAKENING: PROMOTED TO {rank.name} ({rank.title})!
            </div>
          )}
        </div>

        {/* Unlocked Perks List */}
        {levelUp.unlockedPerks && levelUp.unlockedPerks.length > 0 && (
          <div className="mt-2 mb-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white/60 mb-2.5">
              UNLOCKED PERKS & PRIVILEGES:
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {levelUp.unlockedPerks.map((perk, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm"
                >
                  <span className="text-xl">{perk.badge}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white font-mono">{perk.title}</p>
                    <p className="text-[11px] text-white/60 truncate">{perk.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accept Button */}
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={() => dismissLevelUp()}
            className="w-full py-3 px-4 rounded-xl font-mono text-sm uppercase tracking-wider font-bold transition-all duration-300 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] active:scale-[0.98]"
          >
            CONFIRM & CONTINUE
          </button>
        </div>
      </div>
    </div>
  )
}

export default SystemLevelUpModal
