import React from 'react'
import { Link } from 'react-router-dom'
import { getLevelProgress, getHunterRank } from '../../lib/ascension/types'
import { HunterRankBadge } from './HunterRankBadge'

interface CompactXPBarProps {
  totalXp: number
  level: number
  showLink?: boolean
  className?: string
  compact?: boolean
}

export const CompactXPBar: React.FC<CompactXPBarProps> = ({
  totalXp,
  level,
  showLink = true,
  className = '',
  compact = false,
}) => {
  const progress = getLevelProgress(totalXp)
  const rank = getHunterRank(level)

  const content = (
    <div
      className={`group relative flex flex-col gap-1.5 p-2 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md transition-all hover:border-cyan-500/40 hover:bg-black/60 ${className}`}
    >
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <HunterRankBadge levelOrTier={level} size="xs" showIcon={false} />
          <span className="font-bold text-white tracking-wide">
            LVL <span className="text-cyan-400 font-extrabold">{level}</span>
          </span>
        </div>
        {!compact && (
          <span className="text-[11px] text-white/50">
            <span className="text-white/80">{progress.currentLevelXp.toLocaleString()}</span> /{' '}
            {progress.neededForNextLevel.toLocaleString()} XP
          </span>
        )}
        <span className="text-[11px] font-bold text-cyan-400">{progress.percent}%</span>
      </div>

      {/* Progress Bar Track */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, progress.percent))}%`,
            background: `linear-gradient(90deg, ${rank.color}, #00f0ff)`,
            boxShadow: `0 0 8px ${rank.glowColor}`,
          }}
        />
      </div>
    </div>
  )

  if (showLink) {
    return (
      <Link to="/ascension" className="block focus:outline-none" title="Open Ascension System">
        {content}
      </Link>
    )
  }

  return content
}

export default CompactXPBar
