import { GENRES } from '../lib/constants'
import { useSearch } from '../context/SearchContext'
import { Marquee } from './Marquee'

const MASK = '[mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]'

/** Two counter-scrolling rows of genre chips; each chip opens search filtered to that genre. */
export function GenreMarquee() {
  const { openSearch } = useSearch()
  const first = GENRES.slice(0, Math.ceil(GENRES.length / 2))
  const second = GENRES.slice(Math.ceil(GENRES.length / 2))

  const chip = (g: { name: string }) => (
    <button
      key={g.name}
      type="button"
      onClick={() => openSearch({ genre: g.name })}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card/70 px-5 py-2.5 text-sm font-medium backdrop-blur transition hover:border-transparent hover:bg-foreground hover:text-background active:scale-95"
    >
      {g.name}
    </button>
  )

  return (
    <section aria-label="Browse by genre" className="flex flex-col gap-3 overflow-hidden py-2">
      <Marquee duration={45} className={MASK}>
        {first.map(chip)}
      </Marquee>
      <Marquee reverse duration={52} className={MASK}>
        {second.map(chip)}
      </Marquee>
    </section>
  )
}
