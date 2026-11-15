import React from 'react'
import { getHunterRank, type HunterRankTier } from '../../lib/ascension/types'
import { HunterRankInsignia } from './HunterRankInsignia'
import { cn } from '../../lib/utils'

interface HunterRankBadgeProps {
  levelOrTier: number | HunterRankTier
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showTitle?: boolean
  showIcon?: boolean
  className?: string
}

export const HunterRankBadge: React.FC<HunterRankBadgeProps> = ({
  levelOrTier,
  size = 'sm',
  showTitle = false,
  showIcon = true,
  className = '',
}) => {
  const rank = typeof levelOrTier === 'number' ? getHunterRank(levelOrTier) : getHunterRank(
    levelOrTier === 'SS' ? 50 :
    levelOrTier === 'S' ? 40 :
    levelOrTier === 'A' ? 30 :
    levelOrTier === 'B' ? 20 :
    levelOrTier === 'C' ? 10 :
    levelOrTier === 'D' ? 5 : 1
  )

  const sizeStyles = {
    xs: 'text-[10px] px-2 py-0.5 gap-1.5 font-semibold tracking-wider',
    sm: 'text-xs px-2.5 py-0.5 gap-2 font-bold tracking-wider',
    md: 'text-sm px-3 py-1 gap-2.5 font-bold tracking-wide',
    lg: 'text-base px-4 py-1.5 gap-3 font-extrabold tracking-wide',
  }[size]

  const insigniaPixelSize = {
    xs: 15,
    sm: 18,
    md: 22,
    lg: 28,
  }[size]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[#242730] bg-[#111318]/90 text-[#F4F4F5] transition-all duration-200 select-none backdrop-blur-md hover:border-[#383C49]',
        sizeStyles,
        className
      )}
      title={`${rank.name} — ${rank.title}`}
    >
      {showIcon && (
        <HunterRankInsignia
          tier={rank.tier}
          size={insigniaPixelSize}
          animated={true}
        />
      )}
      <span className="uppercase font-mono font-bold tracking-wider text-[#F4F4F5]">
        {rank.name}
      </span>
      {showTitle && (
        <span className="text-[#9298A4] font-sans text-[0.85em] font-normal border-l border-[#242730] pl-2">
          {rank.title}
        </span>
      )}
    </span>
  )
}

export default HunterRankBadge
