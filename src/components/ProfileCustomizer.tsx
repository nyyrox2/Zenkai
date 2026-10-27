import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Check, ChevronDown, Crop, Frame, ImagePlus, Images, Pencil, Search, Sparkles, Trash2, UserRound, X, type LucideIcon } from 'lucide-react'
import { Avatar } from './Avatar'
import { BlurText } from './BlurText'
import { CustomSelect } from './CustomSelect'
import { ImageCropper, type CropKind } from './ImageCropper'
import { SpotlightCard } from './SpotlightCard'
import { FRAMES, FRAME_GROUPS, frameById, frameGroup, frameUrl } from '../lib/frames'
import { saveProfile, type Profile } from '../lib/profile'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

export type SectionKey = 'name' | 'avatar' | 'overlay' | 'banner'

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const
const solid = 'inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background transition hover:opacity-90 active:scale-95'
const pill = 'inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/60 px-4 text-sm font-semibold transition hover:border-accent hover:text-accent active:scale-95'

/* ------------------------------------------------------------------ hero */

export function ProfileHero({ me, onEdit }: { me: Profile; onEdit: (k: SectionKey) => void }) {
  const frame = frameById(me.frame)
  return (
    <motion.section initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="relative overflow-hidden rounded-3xl border border-border bg-card/60" aria-label="Profile preview">
      <div className="relative h-40 overflow-hidden bg-card-2 sm:h-56">
        <AnimatePresence>
          {me.banner && (
            <motion.img key={me.banner} src={me.banner} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" initial={{ opacity: 0, scale: 1.14 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          )}
        </AnimatePresence>
        <motion.button type="button" onClick={() => onEdit('banner')} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} whileTap={{ scale: 0.93 }} className="absolute right-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/60">
          <Camera className="size-3.5" /> Edit banner
        </motion.button>
      </div>

      <div className="flex items-end gap-4 px-5 pb-5 sm:px-8">
        <motion.div initial={{ scale: 0.3, rotate: -24, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 15, delay: 0.2 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="relative -mt-14 mb-2 ml-2 shrink-0 sm:-mt-16">
          <Avatar size={112} src={me.avatar} frame={me.frame} name={me.name} animateFrame className="relative rounded-full ring-4 ring-card" />
          <button type="button" onClick={() => onEdit('avatar')} aria-label="Edit profile picture" className="absolute -bottom-1 -right-1 z-10 grid size-9 place-items-center rounded-full border-2 border-card bg-accent text-accent-fg shadow-lg transition hover:scale-110 active:scale-90">
            <Pencil className="size-4" />
          </button>
        </motion.div>
        <div className="min-w-0 pb-2">
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.35 }} className="truncate font-display text-2xl font-bold">
            {me.name || 'Guest'}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-0.5 text-sm">
            <span className="text-muted">Saved on this device only. No account needed.</span>
          </motion.p>
          <AnimatePresence mode="popLayout">
            {frame && (
              <motion.span key={frame.id} layout initial={{ opacity: 0, scale: 0.7, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7 }} transition={spring} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card-2 px-3 py-1 text-xs font-semibold text-foreground">
                <Sparkles className="size-3" /> {frame.name}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  )
}

/* ------------------------------------------------------------- accordion */

function Section({ id, icon: Icon, title, summary, open, onToggle, children }: { id: SectionKey; icon: LucideIcon; title: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <SpotlightCard className={cn('transition-colors', open ? 'border-accent/50' : '')}>
      <div id={`pc-${id}`} className="scroll-mt-24">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`pc-${id}-panel`} className="flex w-full items-center gap-3.5 p-4 text-left sm:p-5">
          <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl transition-colors', open ? 'bg-accent text-accent-fg' : 'bg-card-2 text-foreground')}>
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold">{title}</span>
            <span className="block truncate text-xs text-muted">{summary}</span>
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="grid size-9 shrink-0 place-items-center rounded-full border border-border">
            <ChevronDown className="size-4" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div id={`pc-${id}-panel`} role="region" aria-label={title} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
              <div className="border-t border-border p-4 sm:p-5">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SpotlightCard>
  )
}

/* --------------------------------------------------------------- gallery */

interface Pick {
  url: string
  group: string
}

/** Preset avatars / banners (lists from github.com/Nyyrox/avatar-banner-, loaded only when the section opens). */
function Gallery({ kind, current, onPick }: { kind: CropKind; current: string | null; onPick: (url: string) => void }) {
  const [all, setAll] = useState<Pick[] | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [shown, setShown] = useState(24)
  useEffect(() => {
    let dead = false
    const load =
      kind === 'avatar'
        ? import('../data/avatars.json').then((m) => m.default.map((a) => ({ url: a.url, group: a.tags.join(', ') })))
        : import('../data/banners.json').then((m) => m.default.map((b) => ({ url: b.url, group: b.category })))
    load.then((l) => !dead && setAll(l))
    return () => {
      dead = true
    }
  }, [kind])

  const groups = useMemo(() => [...new Set((all ?? []).flatMap((p) => p.group.split(', ')))].sort(), [all])
  const list = (all ?? []).filter((p) => (!group || p.group.split(', ').includes(group)) && p.group.toLowerCase().includes(q.trim().toLowerCase()))
  const noun = kind === 'avatar' ? 'Series' : 'Anime'

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-40">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => (setQ(e.target.value), setShown(24))} placeholder={`Search ${kind}s…`} aria-label={`Search ${kind}s`} className="h-10 w-full rounded-full border border-border bg-card/60 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </div>
        <CustomSelect label={`${noun} filter`} value={group} onChange={(v) => (setGroup(v), setShown(24))} placeholder={`All ${noun.toLowerCase()}`} options={[{ value: '', label: `All ${noun.toLowerCase()}` }, ...groups.map((g) => ({ value: g, label: g }))]} />
      </div>
      {!all ? (
        <p className="p-6 text-center text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">Nothing matches. Try another {noun.toLowerCase()}.</p>
      ) : (
        <>
          <ul className={cn('mt-3 grid gap-2', kind === 'avatar' ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3')}>
            {list.slice(0, shown).map((p, i) => (
              <motion.li key={p.url} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 16) * 0.02 }}>
                <button type="button" onClick={() => onPick(p.url)} title={p.group} aria-pressed={current === p.url} className={cn('relative block w-full overflow-hidden rounded-xl border transition hover:ring-2 hover:ring-accent active:scale-95', current === p.url ? 'border-accent ring-2 ring-accent' : 'border-border')}>
                  <img src={p.url} alt={p.group} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={cn('w-full object-cover', kind === 'avatar' ? 'aspect-square' : 'aspect-[3/1]')} />
                  {current === p.url && <Check className="absolute right-1 top-1 size-4 rounded-full bg-accent p-0.5 text-accent-fg" />}
                </button>
              </motion.li>
            ))}
          </ul>
          {shown < list.length && (
            <button type="button" onClick={() => setShown((n) => n + 24)} className={cn(pill, 'mx-auto mt-3')}>
              Show more ({list.length - shown})
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ customizer */

export function ProfileCustomizer({ me, open, setOpen }: { me: Profile; open: Set<SectionKey>; setOpen: (s: Set<SectionKey>) => void }) {
  const [crop, setCrop] = useState<{ src: string; kind: CropKind; revoke?: boolean } | null>(null)
  const [gallery, setGallery] = useState<CropKind | null>(null)
  const [err, setErr] = useState('')
  const [group, setGroup] = useState('')
  const [framesShown, setFramesShown] = useState(18)
  const files = { avatar: useRef<HTMLInputElement>(null), banner: useRef<HTMLInputElement>(null) }

  const toggle = (k: SectionKey) => {
    const n = new Set(open)
    if (!n.delete(k)) n.add(k)
    setOpen(n)
  }

  function choose(file: File | undefined, kind: CropKind) {
    if (!file) return
    setErr('')
    if (!file.type.startsWith('image/')) return (setErr('That file is not an image.'), toast('That file is not an image', 'error'))
    if (file.size > 20 * 1048576) return (setErr('Image is too large (20 MB max).'), toast('Image is too large (20 MB max)', 'error'))
    setCrop({ src: URL.createObjectURL(file), kind, revoke: true })
  }
  function closeCrop() {
    if (crop?.revoke) URL.revokeObjectURL(crop.src)
    setCrop(null)
  }

  const frame = frameById(me.frame)
  const kindSummary = (v: string | null) => (!v ? 'Not set' : v.startsWith('data:') ? 'Your photo' : 'Preset')
  const frames = FRAMES.filter((f) => !group || frameGroup(f) === group)
  const shownFrames = frames.slice(0, framesShown)

  return (
    <section aria-label="Customize profile" className="space-y-4">
      <div className="px-1">
        <BlurText text="Customize your profile" className="font-display text-2xl font-bold" />
        <p className="mt-1 text-sm text-muted">Changes show in the preview above straight away.</p>
      </div>

      <Section id="name" icon={UserRound} title="Display name" summary={me.name || 'Guest'} open={open.has('name')} onToggle={() => toggle('name')}>
        <label className="block">
          <span className="sr-only">Display name</span>
          <input value={me.name} maxLength={24} onChange={(e) => saveProfile({ name: e.target.value })} onBlur={() => me.name.trim() && toast('Name updated')} placeholder="What should we call you?" className="h-11 w-full rounded-full border border-border bg-card/60 px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
        <p className="mt-2 text-right text-xs tabular-nums text-muted">{me.name.length}/24</p>
      </Section>

      <Section id="avatar" icon={ImagePlus} title="Profile picture" summary={kindSummary(me.avatar)} open={open.has('avatar')} onToggle={() => toggle('avatar')}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" className={solid} onClick={() => files.avatar.current?.click()}>
            <ImagePlus className="size-4" /> Upload photo
          </button>
          <button type="button" className={cn(pill, gallery === 'avatar' && 'border-accent text-accent')} onClick={() => setGallery(gallery === 'avatar' ? null : 'avatar')}>
            <Images className="size-4" /> Browse presets
          </button>
          {me.avatar?.startsWith('data:') && (
            <button type="button" className={pill} onClick={() => setCrop({ src: me.avatar!, kind: 'avatar' })}>
              <Crop className="size-4" /> Adjust
            </button>
          )}
          {me.avatar && (
            <button type="button" className={pill} onClick={() => (saveProfile({ avatar: null }), toast('Profile picture removed', 'info'))}>
              <Trash2 className="size-4" /> Remove
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {gallery === 'avatar' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <Gallery kind="avatar" current={me.avatar} onPick={(u) => (saveProfile({ avatar: u }), setGallery(null), toast('Profile picture updated'))} />
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Section id="overlay" icon={Frame} title="Avatar overlay" summary={frame ? `${frame.name} · ${frameGroup(frame)}` : 'None'} open={open.has('overlay')} onToggle={() => toggle('overlay')}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Animated. Plays everywhere your avatar appears.</p>
          <CustomSelect label="Overlay category" value={group} onChange={(v) => (setGroup(v), setFramesShown(18))} placeholder="All overlays" options={[{ value: '', label: 'All overlays' }, ...Object.values(FRAME_GROUPS).map((g) => ({ value: g, label: g }))]} />
        </div>
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6" role="radiogroup" aria-label="Avatar overlay">
          <li>
            <button type="button" role="radio" aria-checked={!me.frame} onClick={() => (saveProfile({ frame: null }), toast('Overlay removed', 'info'))} className={cn('grid aspect-square w-full place-items-center rounded-2xl border text-xs font-semibold transition active:scale-95', !me.frame ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:border-accent/50')}>
              None
            </button>
          </li>
          {shownFrames.map((f, i) => {
            const on = me.frame === f.id
            return (
              <motion.li key={f.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 14) * 0.018 }}>
                <motion.button type="button" role="radio" aria-checked={on} aria-label={f.name} title={f.name} whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.93 }} onClick={() => (saveProfile({ frame: f.id }), toast(`Overlay: ${f.name}`))} className={cn('relative block aspect-square w-full overflow-hidden rounded-2xl border bg-card-2/60 transition-colors', on ? 'border-accent ring-2 ring-accent' : 'border-border hover:border-accent/50')}>
                  <span className="absolute left-1/2 top-1/2 size-[83%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-card ring-1 ring-border">
                    {me.avatar && <img src={me.avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />}
                  </span>
                  <img src={frameUrl(f)} alt="" loading="lazy" decoding="async" draggable={false} className="relative size-full object-contain" />
                  {on && <Check className="absolute right-1 top-1 size-4 rounded-full bg-accent p-0.5 text-accent-fg" />}
                </motion.button>
              </motion.li>
            )
          })}
        </ul>
        {framesShown < frames.length && (
          <button type="button" onClick={() => setFramesShown((n) => n + 18)} className={cn(pill, 'mx-auto mt-3')}>
            Show more ({frames.length - framesShown})
          </button>
        )}
        <p className="mt-3 text-xs text-muted">{frame ? <>Selected: <span className="font-semibold text-foreground">{frame.name}</span></> : 'No overlay selected.'}</p>
      </Section>

      <Section id="banner" icon={Images} title="Profile banner" summary={kindSummary(me.banner)} open={open.has('banner')} onToggle={() => toggle('banner')}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" className={solid} onClick={() => files.banner.current?.click()}>
            <ImagePlus className="size-4" /> Upload banner
          </button>
          <button type="button" className={cn(pill, gallery === 'banner' && 'border-accent text-accent')} onClick={() => setGallery(gallery === 'banner' ? null : 'banner')}>
            <Images className="size-4" /> Browse presets
          </button>
          {me.banner?.startsWith('data:') && (
            <button type="button" className={pill} onClick={() => setCrop({ src: me.banner!, kind: 'banner' })}>
              <Crop className="size-4" /> Adjust
            </button>
          )}
          {me.banner && (
            <button type="button" className={pill} onClick={() => (saveProfile({ banner: null }), toast('Banner removed', 'info'))}>
              <Trash2 className="size-4" /> Remove
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {gallery === 'banner' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <Gallery kind="banner" current={me.banner} onPick={(u) => (saveProfile({ banner: u }), setGallery(null), toast('Banner updated'))} />
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <input ref={files.avatar} type="file" accept="image/*" hidden onChange={(e) => (choose(e.target.files?.[0], 'avatar'), (e.target.value = ''))} />
      <input ref={files.banner} type="file" accept="image/*" hidden onChange={(e) => (choose(e.target.files?.[0], 'banner'), (e.target.value = ''))} />
      {err && (
        <p role="alert" className="flex items-center gap-2 px-1 text-sm text-red-400">
          <X className="size-4" /> {err}
        </p>
      )}

      <AnimatePresence>
        {crop && (
          <ImageCropper
            key={crop.src}
            src={crop.src}
            kind={crop.kind}
            onClose={closeCrop}
            onApply={(url) => {
              saveProfile(crop.kind === 'avatar' ? { avatar: url } : { banner: url })
              toast(crop.kind === 'avatar' ? 'Profile picture updated' : 'Banner updated')
              closeCrop()
            }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
