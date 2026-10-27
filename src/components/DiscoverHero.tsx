import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { AuroraBackground } from './AuroraBackground'
import { BlurText } from './BlurText'
import { FadeSlideshow } from './FadeSlideshow'
import { GradientText } from './GradientText'
import { Particles } from './Particles'
import { ShinyText } from './ShinyText'
import type { ShowcaseImage } from '../services/showcase'

/** Top of the Novels / Manga home pages: aurora + particles, animated headline and the search field. */
export function DiscoverHero({
  eyebrow,
  title,
  accent,
  subtitle,
  kanji,
  query,
  onQuery,
  placeholder,
  backdrop,
  blurBackdrop = false,
  children,
}: {
  eyebrow: string
  title: string
  accent: string
  subtitle: string
  kanji: string
  query: string
  onQuery: (v: string) => void
  placeholder: string
  /** artwork that fades in and out behind the headline */
  backdrop?: ShowcaseImage[]
  /** soften the artwork into an ambient colour wash (for portrait covers) */
  blurBackdrop?: boolean
  children?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-28 sm:px-6 sm:pb-14 sm:pt-36">
      {backdrop && backdrop.length > 0 && (
        <>
          <FadeSlideshow images={backdrop} preferWide interval={8000} className="opacity-50 dark:opacity-40" imgClassName={blurBackdrop ? 'scale-110 blur-2xl' : undefined} />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/55 via-background/60 to-background" />
        </>
      )}
      <AuroraBackground />
      <Particles count={44} className="opacity-70" />
      <span aria-hidden className="pointer-events-none absolute -right-4 top-16 select-none font-display text-[9rem] font-black leading-none text-foreground/[0.04]">
        {kanji}
      </span>
      <div className="relative mx-auto max-w-7xl">
        <p className="mb-3 eyebrow text-accent">
          <ShinyText speed={4}>{eyebrow}</ShinyText>
        </p>
        <BlurText text={title} className="font-display text-4xl font-black leading-[1.05] tracking-tight [text-wrap:balance]" />
        <p className="font-display text-4xl font-black leading-[1.05] tracking-tight">
          <GradientText>{accent}</GradientText>
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{subtitle}</p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:max-w-md">
            <span className="sr-only">{placeholder}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="discover-search"
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={placeholder}
              className="h-12 w-full rounded-full border border-border bg-card/70 pl-11 pr-11 text-sm outline-none backdrop-blur transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => onQuery('')} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </label>
          {children}
        </div>
      </div>
    </section>
  )
}
