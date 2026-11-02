import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, Link2Off, Loader2, RefreshCw } from 'lucide-react'
import { Avatar } from './Avatar'
import { ANILIST_READY, connectAniList, disconnectAniList, getAniListToken, pullAniListLists, pullAniListProfile, setAniListLists, setAniListSync, useAniList } from '../lib/anilist'
import type { Profile } from '../lib/profile'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

const solid = 'inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background transition hover:opacity-90 active:scale-95 disabled:opacity-50'
const ghost = 'inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/60 px-4 text-sm font-semibold transition hover:bg-card-2 active:scale-95 disabled:opacity-50'

const nf = new Intl.NumberFormat('en')
const list = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0])

/** Connect an AniList account and pull its name / picture / banner into the Zenkai profile. */
export function AniListCard({ me }: { me: Profile }) {
  const link = useAniList()
  const [busy, setBusy] = useState(false)
  const ran = useRef(false)

  // With sync on, pick up AniList profile changes whenever the profile page opens.
  useEffect(() => {
    if (ran.current || !link?.sync || !getAniListToken()) return
    ran.current = true
    pullAniListProfile(me)
      .then(() => {})
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const importNow = async () => {
    setBusy(true)
    try {
      const c = await pullAniListProfile(me, true)
      toast(c.length ? `Imported ${list(c)} from AniList` : 'Already matches AniList', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const syncLists = async () => {
    setBusy(true)
    try {
      await pullAniListLists()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sync failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const u = link?.user
  const connected = !!link && link.expires > Date.now()

  return (
    <section className="rounded-3xl border border-border bg-card/60 p-5 sm:p-6" aria-label="AniList">
      <h2 className="font-display text-xl font-bold">AniList</h2>

      {!connected ? (
        <>
          <p className="mt-1 text-sm text-muted">Log in with AniList to use your name, picture and banner here. Your watchlist and episode progress sync too.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={connectAniList} disabled={!ANILIST_READY} className={solid}>
              Continue with AniList
            </button>
            {!ANILIST_READY && <span className="text-xs text-muted">Not set up yet: add VITE_ANILIST_CLIENT_ID.</span>}
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <Avatar size={48} src={u?.avatar} name={u?.name} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{u?.name ?? 'Connected'}</p>
              {u && (
                <p className="text-xs text-muted">
                  {nf.format(u.anime.count)} anime · {nf.format(u.anime.episodes)} episodes · {nf.format(u.manga.count)} manga · {nf.format(u.manga.chapters)} chapters
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Keep profile synced</p>
              <p className="text-xs text-muted">When you change your AniList name, picture or banner, Zenkai follows. Your own edits stay until then.</p>
            </div>
            <button type="button" role="switch" aria-checked={link.sync} aria-label="Keep profile synced with AniList" onClick={() => (setAniListSync(!link.sync), toast(`AniList sync ${link.sync ? 'off' : 'on'}`))} className={cn('relative h-7 w-12 shrink-0 rounded-full border transition', link.sync ? 'border-transparent bg-accent' : 'border-border bg-card-2')}>
              <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', link.sync ? 'left-6' : 'left-0.5')} />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Sync watchlist &amp; progress</p>
              <p className="text-xs text-muted">Your AniList lists fill My List, “Watching” shows land in Continue Watching at the next episode, and episodes you finish are saved to AniList.{link.lastSync ? ` Last synced ${new Date(link.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
            </div>
            <button type="button" role="switch" aria-checked={link.lists !== false} aria-label="Sync watchlist and progress with AniList" onClick={() => (setAniListLists(link.lists === false), toast(`List sync ${link.lists === false ? 'on' : 'off'}`))} className={cn('relative h-7 w-12 shrink-0 rounded-full border transition', link.lists !== false ? 'border-transparent bg-accent' : 'border-border bg-card-2')}>
              <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', link.lists !== false ? 'left-6' : 'left-0.5')} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={syncLists} disabled={busy} className={solid}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sync list now
            </button>
            <button type="button" onClick={importNow} disabled={busy} className={ghost}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Import profile now
            </button>
            {u && (
              <a href={u.url} target="_blank" rel="noopener noreferrer" className={ghost}>
                <ExternalLink className="size-4" />
                Open AniList
              </a>
            )}
            <button type="button" onClick={() => (disconnectAniList(), toast('AniList disconnected', 'info'))} className={ghost}>
              <Link2Off className="size-4" />
              Disconnect
            </button>
          </div>
        </>
      )}
    </section>
  )
}
