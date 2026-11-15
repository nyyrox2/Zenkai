import React from 'react'
import type { HunterRankTier } from '../../lib/ascension/types'
import { cn } from '../../lib/utils'

interface HunterRankInsigniaProps {
  tier: HunterRankTier
  size?: number
  className?: string
  animated?: boolean
  showGlow?: boolean
}

// ============================================================================
// ZENKAI // HUNTER RANK INSIGNIA SYSTEM — Modular Chiseled Titanium Emblems
// Based on the user's Behance reference emblem geometry:
// - Lower ranks have fewer modular geometric pieces (latent energy).
// - As rank increases, pieces combine and expand into higher-tier configurations.
// - Authentic beveled chiseled metal texture with dynamic specular gleam sweep.
// ============================================================================

export const HunterRankInsignia: React.FC<HunterRankInsigniaProps> = ({
  tier,
  size = 46,
  className = '',
  animated = true,
  showGlow = false,
}) => {
  const id = `zk-emblem-${tier}-${Math.random().toString(36).substring(2, 7)}`

  // Rank Color & Material Config
  const rankConfig = {
    E: {
      accent: '#94A3B8', // Graphite Silver
      accentGlow: 'rgba(148, 163, 184, 0.3)',
      duration: '4.8s',
      name: 'Graphite Silver',
    },
    D: {
      accent: '#38BDF8', // Titanium Blue
      accentGlow: 'rgba(56, 189, 248, 0.4)',
      duration: '4.0s',
      name: 'Titanium Blue',
    },
    C: {
      accent: '#10B981', // Emerald
      accentGlow: 'rgba(16, 185, 129, 0.4)',
      duration: '3.4s',
      name: 'Emerald',
    },
    B: {
      accent: '#A855F7', // Amethyst
      accentGlow: 'rgba(168, 85, 247, 0.45)',
      duration: '2.8s',
      name: 'Amethyst',
    },
    A: {
      accent: '#F59E0B', // Champagne Gold
      accentGlow: 'rgba(245, 158, 11, 0.45)',
      duration: '2.3s',
      name: 'Champagne Gold',
    },
    S: {
      accent: '#EF4444', // Crimson Steel
      accentGlow: 'rgba(239, 68, 68, 0.5)',
      duration: '1.9s',
      name: 'Crimson Steel',
    },
    SS: {
      accent: '#38BDF8', // Platinum / Ice Blue
      accentGlow: 'rgba(56, 189, 248, 0.6)',
      duration: '1.5s',
      name: 'Platinum Ice',
    },
  }[tier]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none overflow-visible', className)}
      style={{
        filter: showGlow ? `drop-shadow(0 0 10px ${rankConfig.accentGlow})` : undefined,
      }}
    >
      <defs>
        {/* Dark Chiseled Titanium Body Gradient */}
        <linearGradient id={`${id}-body`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2A2F3A" />
          <stop offset="40%" stopColor="#171A21" />
          <stop offset="70%" stopColor="#0D0F14" />
          <stop offset="100%" stopColor="#1E232D" />
        </linearGradient>

        {/* Chiseled Bevel Highlight (Bright Upper Metal Edge) */}
        <linearGradient id={`${id}-bevel-light`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#CBD5E1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#64748B" stopOpacity="0.3" />
        </linearGradient>

        {/* Chiseled Bevel Shadow (Dark Recessed Edge) */}
        <linearGradient id={`${id}-bevel-dark`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0B0D12" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.98" />
        </linearGradient>

        {/* Specular Light Sweep Glide (Dynamic Animation Increasing with Rank) */}
        <linearGradient id={`${id}-gleam`} x1="-100%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="55%" stopColor={rankConfig.accent} stopOpacity="0.8" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          {animated && (
            <animate
              attributeName="x1"
              from="-150%"
              to="150%"
              dur={rankConfig.duration}
              repeatCount="indefinite"
            />
          )}
          {animated && (
            <animate
              attributeName="x2"
              from="0%"
              to="300%"
              dur={rankConfig.duration}
              repeatCount="indefinite"
            />
          )}
        </linearGradient>

        {/* Subtle Rank Accent Core Luster */}
        <radialGradient id={`${id}-accent`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={rankConfig.accent} stopOpacity="0.9" />
          <stop offset="60%" stopColor={rankConfig.accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0D0F14" stopOpacity="0.1" />
        </radialGradient>
      </defs>

      {/* ====================================================================
          PIECE 1: CENTRAL DIAMOND APEX CORE
          (Present on ALL Ranks — The Hunter's Core Mana Matrix)
          ==================================================================== */}
      <g id="core-diamond">
        {/* Outer Chiseled Beveled Facet */}
        <polygon
          points="32,10 38,27 32,38 26,27"
          fill={`url(#${id}-body)`}
          stroke={`url(#${id}-bevel-light)`}
          strokeWidth="0.85"
        />
        {/* Inner Recessed Dark Titanium Facet */}
        <polygon
          points="32,14 36,27 32,35 28,27"
          fill="#0B0D13"
          stroke={`url(#${id}-bevel-dark)`}
          strokeWidth="0.6"
        />
        {/* Specular Gleam Overlay */}
        <polygon
          points="32,10 38,27 32,38 26,27"
          fill={`url(#${id}-gleam)`}
          style={{ mixBlendMode: 'screen' }}
        />
        {/* Core Vertical Chiseled Ridge & Rank Accent Slit */}
        <line
          x1="32"
          y1="13"
          x2="32"
          y2="35"
          stroke={tier === 'E' ? '#CBD5E1' : rankConfig.accent}
          strokeWidth={tier === 'SS' ? '1.2' : '0.9'}
          strokeLinecap="round"
          opacity={tier === 'E' ? 0.6 : 0.85}
        />
      </g>

      {/* ====================================================================
          PIECE 2: BOTTOM DIAMOND DROP ANCHOR
          (Unlocks on Rank C, A, S, SS)
          ==================================================================== */}
      {(tier === 'C' || tier === 'A' || tier === 'S' || tier === 'SS') && (
        <g id="bottom-diamond">
          <polygon
            points="32,42 35.5,48.5 32,54 28.5,48.5"
            fill={`url(#${id}-body)`}
            stroke={`url(#${id}-bevel-light)`}
            strokeWidth="0.75"
          />
          <polygon
            points="32,44.5 34,48.5 32,52 30,48.5"
            fill="#090B0E"
          />
          <polygon
            points="32,42 35.5,48.5 32,54 28.5,48.5"
            fill={`url(#${id}-gleam)`}
            style={{ mixBlendMode: 'screen' }}
          />
          <circle cx="32" cy="48.5" r="0.8" fill={rankConfig.accent} />
        </g>
      )}

      {/* ====================================================================
          PIECE 3 & 4: LOWER STABILIZER BLADES (Left & Right)
          (Unlocks on Rank D, C, A, S, SS)
          ==================================================================== */}
      {(tier === 'D' || tier === 'C' || tier === 'A' || tier === 'S' || tier === 'SS') && (
        <g id="lower-stabilizers">
          {/* Lower Left Stabilizer Blade */}
          <polygon
            points="18,40 28,40 26,45 16,45"
            fill={`url(#${id}-body)`}
            stroke={`url(#${id}-bevel-light)`}
            strokeWidth="0.75"
          />
          <polygon
            points="19,41 27,41 25.5,44 17.5,44"
            fill="#0E1117"
            stroke={`url(#${id}-bevel-dark)`}
            strokeWidth="0.5"
          />
          <polygon
            points="18,40 28,40 26,45 16,45"
            fill={`url(#${id}-gleam)`}
            style={{ mixBlendMode: 'screen' }}
          />

          {/* Lower Right Stabilizer Blade */}
          <polygon
            points="36,40 46,40 48,45 38,45"
            fill={`url(#${id}-body)`}
            stroke={`url(#${id}-bevel-light)`}
            strokeWidth="0.75"
          />
          <polygon
            points="37,41 45,41 46.5,44 38.5,44"
            fill="#0E1117"
            stroke={`url(#${id}-bevel-dark)`}
            strokeWidth="0.5"
          />
          <polygon
            points="36,40 46,40 48,45 38,45"
            fill={`url(#${id}-gleam)`}
            style={{ mixBlendMode: 'screen' }}
          />
        </g>
      )}

      {/* ====================================================================
          PIECE 5 & 6: UPPER MAIN SWEEPING WINGS (Left & Right)
          (Unlocks on Rank B, A, S, SS)
          ==================================================================== */}
      {(tier === 'B' || tier === 'A' || tier === 'S' || tier === 'SS') && (
        <g id="upper-wings">
          {/* Upper Left Wing Blade */}
          <polygon
            points="7,29 27,29 24,37 10,37"
            fill={`url(#${id}-body)`}
            stroke={`url(#${id}-bevel-light)`}
            strokeWidth="0.85"
          />
          <polygon
            points="9,30.5 25.5,30.5 23,35.5 11.5,35.5"
            fill="#0C0E14"
            stroke={`url(#${id}-bevel-dark)`}
            strokeWidth="0.6"
          />
          {/* Subtle Accent Inset Line */}
          <line x1="12" y1="33" x2="23" y2="33" stroke={rankConfig.accent} strokeWidth="0.75" opacity="0.6" />
          <polygon
            points="7,29 27,29 24,37 10,37"
            fill={`url(#${id}-gleam)`}
            style={{ mixBlendMode: 'screen' }}
          />

          {/* Upper Right Wing Blade */}
          <polygon
            points="37,29 57,29 54,37 40,37"
            fill={`url(#${id}-body)`}
            stroke={`url(#${id}-bevel-light)`}
            strokeWidth="0.85"
          />
          <polygon
            points="38.5,30.5 55,30.5 52.5,35.5 41,35.5"
            fill="#0C0E14"
            stroke={`url(#${id}-bevel-dark)`}
            strokeWidth="0.6"
          />
          {/* Subtle Accent Inset Line */}
          <line x1="41" y1="33" x2="52" y2="33" stroke={rankConfig.accent} strokeWidth="0.75" opacity="0.6" />
          <polygon
            points="37,29 57,29 54,37 40,37"
            fill={`url(#${id}-gleam)`}
            style={{ mixBlendMode: 'screen' }}
          />
        </g>
      )}

      {/* ====================================================================
          PIECE 7 & 8: ADVANCED OUTER EXTENSION BLADES
          (Unlocks on Rank S & SS — High-Echelon Sovereign Expansion)
          ==================================================================== */}
      {(tier === 'S' || tier === 'SS') && (
        <g id="outer-extension-blades">
          {/* Left Extended Razor Winglet */}
          <polygon
            points="3,23 9,23 7,27 1,27"
            fill={`url(#${id}-body)`}
            stroke={`url(#${id}-bevel-light)`}
            strokeWidth="0.7"
          />
          <polygon
            points="3,23 9,23 7,27 1,27"
            fill={`url(#${id}-gleam)`}
            style={{ mixBlendMode: 'screen' }}
          />

          {/* Right Extended Razor Winglet */}
          <polygon
            points="55,23 61,23 63,27 57,27"
            fill={`url(#${id}-body)`}
            stroke={`url(#${id}-bevel-light)`}
            strokeWidth="0.7"
          />
          <polygon
            points="55,23 61,23 63,27 57,27"
            fill={`url(#${id}-gleam)`}
            style={{ mixBlendMode: 'screen' }}
          />
        </g>
      )}

      {/* ====================================================================
          PIECE 9 & 10: SOVEREIGN CROWN APEX & ICE CORE ORBIT
          (Unlocks ONLY on Rank SS — The Complete Shadow Monarch Ascension)
          ==================================================================== */}
      {tier === 'SS' && (
        <g id="sovereign-crown">
          {/* Top Pinnacle Crown Diamond */}
          <polygon
            points="32,4 34.5,8 32,10 29.5,8"
            fill="#E2E8F0"
            stroke="#FFFFFF"
            strokeWidth="0.6"
          />

          {/* Lower Sub-Drop Anchor Shard */}
          <polygon
            points="32,56 34,59 32,62 30,59"
            fill="#38BDF8"
            opacity="0.85"
          />

          {/* Floating Radiant Ice Diamond Core inside center */}
          <polygon
            points="32,23 34.5,27 32,31 29.5,27"
            fill={`url(#${id}-accent)`}
            stroke="#38BDF8"
            strokeWidth="0.8"
          />
          <circle cx="32" cy="27" r="1.2" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  )
}

export default HunterRankInsignia
