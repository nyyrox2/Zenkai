import { Link, useLocation } from 'react-router-dom'
import { NAV_LINKS } from '../lib/constants'
import { openShortcuts } from '../lib/keys'
import { openChangelog } from '../lib/changelog'
import { sectionOf } from '../lib/sections'
import { cn } from '../lib/utils'
import { CommunitySection } from './CommunitySection'
import { DotPattern } from './DotPattern'
import { Logo } from './Logo'

/** The disclaimer, DMCA notice and data credits live on the Profile page. */
const LegalLink = () => (
  <Link to="/profile#legal" className="underline-offset-2 transition-colors hover:text-accent hover:underline">
    Disclaimer, DMCA &amp; credits
  </Link>
)

export function Footer() {
  const section = sectionOf(useLocation().pathname)
  if (section === 'movies') return <MoviesFooter />
  if (section === 'novel' || section === 'manga') return <ReaderFooter kind={section} />
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-border pb-28 pt-14 md:pb-14">
      <DotPattern className="[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo size={40} />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Discover what to watch next. Zenkai brings the best of anime into one beautiful, fast place — on every screen.
          </p>
        </div>

        <nav aria-label="Footer" className="flex gap-12 text-sm">
          <ul className="space-y-3">
            <li className="text-xs font-semibold uppercase tracking-widest text-muted">Explore</li>
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="transition-colors hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/app" className="transition-colors hover:text-accent">
                Android app
              </Link>
            </li>
            <li>
              <Link to="/" className="transition-colors hover:text-accent">
                Switch section
              </Link>
            </li>
            <li>
              <button type="button" onClick={openChangelog} className="transition-colors hover:text-accent">
                What&apos;s new (v1.0.1)
              </button>
            </li>
            <li className="hidden md:list-item">
              <button type="button" onClick={openShortcuts} className="transition-colors hover:text-accent">
                Keyboard shortcuts
              </button>
            </li>
          </ul>
          <ul className="space-y-3">
            <li className="text-xs font-semibold uppercase tracking-widest text-muted">Data</li>
            <li>
              <a href="https://anilist.co" target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-accent">
                AniList
              </a>
            </li>
            <li>
              <a href="https://myanimelist.net" target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-accent">
                MyAnimeList
              </a>
            </li>
            <li>
              <a href="https://jikan.moe" target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-accent">
                Jikan API
              </a>
            </li>
            <li>
              <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-accent">
                TMDB
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <CommunitySection />
      <p className="relative mx-auto mt-12 max-w-7xl px-4 text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} Zenkai. <LegalLink />
      </p>
    </footer>
  )
}

/** Novels and Manga get their own small footer: no anime links, no app promo. */
function ReaderFooter({ kind }: { kind: 'novel' | 'manga' }) {
  const novel = kind === 'novel'
  return (
    <footer className={cn('relative mt-10 overflow-hidden border-t border-border pb-14 pt-14')}>
      <DotPattern className="[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo size={40} to={`/${kind}`} />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {novel
              ? 'Web novels and light novels, in a reader made for long sessions. Your place is saved on this device.'
              : 'Fresh manga chapters in webtoon, left-to-right or right-to-left reading. Your place is saved on this device.'}
          </p>
        </div>
        <ul className="space-y-3 text-sm">
          <li className="text-xs font-semibold uppercase tracking-widest text-muted">{novel ? 'Sources' : 'Data'}</li>
          {(novel
            ? [
                ['NovelFire', 'https://novelfire.net'],
                ['NovelFull', 'https://novelfull.com'],
              ]
            : [['AniList', 'https://anilist.co']]
          ).map(([n, u]) => (
            <li key={n}>
              <a href={u} target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-accent">
                {n}
              </a>
            </li>
          ))}
          <li>
            <Link to="/" className="transition-colors hover:text-accent">
              Switch section
            </Link>
          </li>
        </ul>
      </div>
      <p className="relative mx-auto mt-12 max-w-7xl px-4 text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} Zenkai. <LegalLink />
      </p>
    </footer>
  )
}

/** Movies get their own small black & white footer. */
function MoviesFooter() {
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-border pb-28 pt-14 md:pb-14">
      <DotPattern className="[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo size={40} to="/movies" />
          <p className="mt-4 text-sm leading-relaxed text-muted">Films and series from every server, one tap away. Switch servers any time if one is slow.</p>
        </div>
        <ul className="space-y-3 text-sm">
          <li className="text-xs font-semibold uppercase tracking-widest text-muted">Explore</li>
          <li><Link to="/movies/browse?type=movie" className="transition-colors hover:text-accent">Movies</Link></li>
          <li><Link to="/movies/browse?type=tv" className="transition-colors hover:text-accent">TV Shows</Link></li>
          <li><a href="https://www.themoviedb.org" target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-accent">TMDB</a></li>
          <li><Link to="/" className="transition-colors hover:text-accent">Switch section</Link></li>
        </ul>
      </div>
      <p className="relative mx-auto mt-12 max-w-7xl px-4 text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} Zenkai. <LegalLink />
      </p>
    </footer>
  )
}
