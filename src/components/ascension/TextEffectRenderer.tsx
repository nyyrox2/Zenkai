import React, { useEffect, useState, useMemo } from 'react'
import {
  TEXT_EFFECTS,
  FONT_STYLES,
  NAME_COLORS,
} from '../../lib/ascension/types'
import { cn } from '../../lib/utils'

export interface TextEffectRendererProps {
  text: string
  effectId?: string | null
  fontId?: string | null
  colorId?: string | null
  className?: string
  fallbackClass?: string
}

// ============================================================================
// RGB CYBER GLITCH — Direct Port of APK's ZenkaiGlitchText.kt
// ============================================================================
const GLITCH_GLYPHS = ['X', 'Z', '/', '<', '>', '_', '-', '1', '0', '#', '%', '!']

function glitchCharacters(original: string): string {
  const chars = original.split('')
  const glitchCount = Math.floor(Math.random() * 2) + 1
  for (let i = 0; i < glitchCount; i++) {
    const idx = Math.floor(Math.random() * chars.length)
    if (chars[idx] !== ' ') {
      chars[idx] = GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)]
    }
  }
  return chars.join('')
}

const ZenkaiGlitchShader: React.FC<{
  text: string
  colorClass: string
  fontFamily?: string
  letterSpacing?: string
  className?: string
}> = ({ text, colorClass, fontFamily, letterSpacing, className }) => {
  const [isGlitching, setIsGlitching] = useState(false)
  const [displayText, setDisplayText] = useState(text)
  const [offsetXRed, setOffsetXRed] = useState(0)
  const [offsetYRed, setOffsetYRed] = useState(0)
  const [offsetXCyan, setOffsetXCyan] = useState(0)
  const [offsetYCyan, setOffsetYCyan] = useState(0)
  const [glitchAlpha, setGlitchAlpha] = useState(0)
  const [showScanline, setShowScanline] = useState(false)
  const [scanlineOffset, setScanlineOffset] = useState(0)

  useEffect(() => {
    let isCancelled = false
    let timeoutId: NodeJS.Timeout | null = null

    const runGlitchLoop = async () => {
      while (!isCancelled) {
        // Short idle interval so the glitch is actively visible and dynamic
        setIsGlitching(false)
        setDisplayText(text)
        setGlitchAlpha(0.2)
        setShowScanline(false)
        await new Promise((r) => { timeoutId = setTimeout(r, 400 + Math.random() * 400) })
        if (isCancelled) break

        // Glitch burst: 4 to 6 quick frames (APK timing)
        const burstFrames = Math.floor(Math.random() * 3) + 4
        for (let i = 0; i < burstFrames; i++) {
          if (isCancelled) break
          const redX = Math.floor(Math.random() * 9) - 4
          const redY = Math.floor(Math.random() * 3) - 1
          const cyanX = -redX * 0.85 + (Math.floor(Math.random() * 5) - 2)
          const cyanY = -redY

          setIsGlitching(true)
          setGlitchAlpha(Math.random() * 0.35 + 0.65)
          setOffsetXRed(redX)
          setOffsetYRed(redY)
          setOffsetXCyan(cyanX)
          setOffsetYCyan(cyanY)
          setShowScanline(Math.random() < 0.6)
          setScanlineOffset(Math.floor(Math.random() * 15) - 7)

          if (Math.random() < 0.45) {
            setDisplayText(glitchCharacters(text))
          } else {
            setDisplayText(text)
          }

          const frameDuration = 50 + Math.random() * 35
          await new Promise((r) => { timeoutId = setTimeout(r, frameDuration) })
        }

        // Secondary stutter
        if (!isCancelled && Math.random() < 0.6) {
          await new Promise((r) => { timeoutId = setTimeout(r, 60) })
          if (isCancelled) break
          setIsGlitching(true)
          setGlitchAlpha(0.6)
          setOffsetXRed(3)
          setOffsetYRed(0)
          setOffsetXCyan(-2.5)
          setOffsetYCyan(0)
          setDisplayText(text)
          setShowScanline(false)
          await new Promise((r) => { timeoutId = setTimeout(r, 45) })
        }

        setIsGlitching(false)
        setDisplayText(text)
        setGlitchAlpha(0.2)
        setShowScanline(false)
      }
    }

    runGlitchLoop()

    return () => {
      isCancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [text])

  const styleObj = {
    fontFamily: fontFamily || 'inherit',
    letterSpacing: letterSpacing || 'inherit',
  }

  return (
    <span
      className={cn('relative inline-block select-none', className)}
      style={styleObj}
    >
      {/* Red Chromatic Aberration Layer */}
      {isGlitching && (
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none font-bold select-none"
          style={{
            transform: `translate(${offsetXRed}px, ${offsetYRed}px)`,
            color: '#FF1E27',
            opacity: glitchAlpha * 0.85,
            mixBlendMode: 'screen',
            filter: 'drop-shadow(0 0 4px #FF1E27)',
          }}
        >
          {displayText}
        </span>
      )}

      {/* Cyan Chromatic Aberration Layer */}
      {isGlitching && (
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none font-bold select-none"
          style={{
            transform: `translate(${offsetXCyan}px, ${offsetYCyan}px)`,
            color: '#00E5FF',
            opacity: glitchAlpha * 0.75,
            mixBlendMode: 'screen',
            filter: 'drop-shadow(0 0 4px #00E5FF)',
          }}
        >
          {displayText}
        </span>
      )}

      {/* Crisp Base Text with Sub-pixel RGB Split */}
      <span
        className={cn(colorClass || 'text-foreground font-black')}
        style={{
          textShadow: '1px 0 2px rgba(255, 0, 85, 0.5), -1px 0 2px rgba(0, 229, 255, 0.5)',
        }}
      >
        {displayText}
      </span>

      {/* Micro Scanline Slice */}
      {isGlitching && showScanline && (
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{
            top: '50%',
            height: '1.5px',
            transform: `translateY(${scanlineOffset}px)`,
            backgroundColor: 'rgba(0, 229, 255, 0.8)',
            boxShadow: '0 0 8px #00E5FF',
          }}
        />
      )}
    </span>
  )
}

// ============================================================================
// VISCOUS LIQUID MELTING SHADER — SVG Displacement Warping & Fluid Gradient
// ============================================================================
interface MeltThemeConfig {
  gradient: string
  glowColor: string
}

const MELT_THEMES: Record<string, MeltThemeConfig> = {
  melt: {
    gradient: 'bg-gradient-to-b from-white via-rose-400 to-rose-700 bg-clip-text text-transparent font-black',
    glowColor: '#e11d48',
  },
  acid: {
    gradient: 'bg-gradient-to-b from-white via-lime-300 to-emerald-700 bg-clip-text text-transparent font-black',
    glowColor: '#84cc16',
  },
  molten: {
    gradient: 'bg-gradient-to-b from-amber-100 via-orange-400 to-red-800 bg-clip-text text-transparent font-black',
    glowColor: '#f97316',
  },
  void: {
    gradient: 'bg-gradient-to-b from-white via-purple-400 to-purple-950 bg-clip-text text-transparent font-black',
    glowColor: '#a855f7',
  },
}

const ZenkaiLiquidMeltingShader: React.FC<{
  text: string
  effectId: string
  colorClass: string
  fontFamily?: string
  letterSpacing?: string
  className?: string
  fallbackClass?: string
}> = ({ text, effectId, colorClass, fontFamily, letterSpacing, className, fallbackClass }) => {
  const theme = MELT_THEMES[effectId] || MELT_THEMES.melt
  const filterId = `zenkai-melt-${effectId}`

  const effectiveGradient = theme.gradient || colorClass || fallbackClass

  return (
    <span
      className={cn('relative inline-block select-none', className)}
      style={{
        fontFamily: fontFamily || 'inherit',
        letterSpacing: letterSpacing || 'inherit',
      }}
    >
      {/* Real Fluid Turbulence Displacement SVG Filter */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02 0.07"
              numOctaves="3"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="4s"
                values="0.02 0.07; 0.03 0.11; 0.02 0.07"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="7"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
          </filter>
        </defs>
      </svg>

      {/* Liquefied melting text with organic fluid displacement and gravity sag */}
      <span
        className={cn('inline-block', effectiveGradient)}
        style={{
          filter: `url(#${filterId})`,
          animation: 'viscous-liquid-sag 3.5s ease-in-out infinite',
        }}
      >
        {text}
      </span>
    </span>
  )
}

// ============================================================================
// MAIN COMPONENT: TextEffectRenderer
// ============================================================================
export const TextEffectRenderer: React.FC<TextEffectRendererProps> = ({
  text,
  effectId = 'none',
  fontId = 'default',
  colorId = 'default',
  className = '',
  fallbackClass = '',
}) => {
  const effect = useMemo(() => TEXT_EFFECTS.find((e) => e.id === effectId), [effectId])
  const font = useMemo(() => FONT_STYLES.find((f) => f.id === fontId), [fontId])
  const nameColor = useMemo(() => NAME_COLORS.find((c) => c.id === colorId), [colorId])

  const colorClass = nameColor?.cssClass || ''
  const effectClass = effect?.className || ''
  const fontFamily = font?.fontFamily || "'Outfit', sans-serif"
  const letterSpacing = font?.letterSpacing || 'normal'

  // If glitch effect is active, render via APK chromatic aberration state machine
  if (effectId === 'glitch') {
    return (
      <ZenkaiGlitchShader
        text={text}
        colorClass={colorClass}
        fontFamily={fontFamily}
        letterSpacing={letterSpacing}
        className={className}
      />
    )
  }

  // If a melting liquid shader is active, render with organic SVG displacement
  if (effectId === 'melt' || effectId === 'acid' || effectId === 'molten' || effectId === 'void') {
    return (
      <ZenkaiLiquidMeltingShader
        text={text}
        effectId={effectId}
        colorClass={colorClass}
        fontFamily={fontFamily}
        letterSpacing={letterSpacing}
        className={className}
        fallbackClass={fallbackClass}
      />
    )
  }

  // Material shaders define their own master multi-stop gradient
  const isMaterialShader = [
    'chrome',
    'gold',
    'holographic',
    'synthwave',
    'supernova',
    'frostbite',
    'sakura',
    'shimmer',
    'aurora',
    'sunset',
    'frost',
    'halo',
    'sakurafree',
    'prism',
    'cyberwave',
    'blossomstorm',
    'mistveil',
    'eclipse',
    'starfall',
  ].includes(effectId || '')

  const combinedClasses = [
    isMaterialShader ? effectClass : (colorClass || effectClass || fallbackClass),
    isMaterialShader ? '' : effectClass,
    className,
  ].filter(Boolean).join(' ')

  return (
    <span
      className={cn('inline-block select-none', combinedClasses)}
      style={{
        fontFamily,
        letterSpacing,
      }}
    >
      {text}
    </span>
  )
}

export default TextEffectRenderer
