import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  AtSign,
  Camera,
  Check,
  Crop,
  FileText,
  Frame,
  ImagePlus,
  Images,
  Palette,
  Pencil,
  Quote,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Avatar } from './Avatar'
import { CustomSelect } from './CustomSelect'
import { ImageCropper, type CropKind } from './ImageCropper'
import { FRAMES, FRAME_GROUPS, frameGroup, frameUrl } from '../lib/frames'
import { saveProfile, type Profile } from '../lib/profile'
import { useAuth } from '../context/AuthContext'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

export type SectionKey = 'identity' | 'avatar' | 'overlay' | 'banner'

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const
const solid =
  'inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background transition hover:opacity-90 active:scale-95'
const pill =
  'inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/60 px-4 text-sm font-semibold transition hover:border-accent hover:text-accent active:scale-95'

/* ------------------------------------------------------------------ Profile Hero */

export function ProfileHero({
  me,
  onEdit,
}: {
  me: Profile
  onEdit: (tab?: SectionKey) => void
}) {
  const { username: authUsername } = useAuth()

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card/60 shadow-xl"
      aria-label="Profile preview"
    >
      {/* Banner */}
      <div className="relative h-44 overflow-hidden bg-card-2 sm:h-60">
        <AnimatePresence>
          {me.banner ? (
            <motion.img
              key={me.banner}
              src={me.banner}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0, scale: 1.12 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-card-2 to-card" />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-black/30" />

        {/* Quick Edit Banner Button */}
        <motion.button
          type="button"
          onClick={() => onEdit('banner')}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.94 }}
          className="absolute right-3.5 top-3.5 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/75"
        >
          <Camera className="size-3.5" />
          <span>Edit banner</span>
        </motion.button>
      </div>

      {/* Profile Bar */}
      <div className="relative flex flex-col gap-4 px-5 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div className="flex items-end gap-4 sm:gap-5">
          {/* Avatar with Animated Frame */}
          <motion.div
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.15 }}
            className="relative -mt-16 ml-1 shrink-0 sm:-mt-20"
          >
            <Avatar
              size={112}
              src={me.avatar}
              frame={me.frame}
              name={me.name}
              animateFrame
              className="relative rounded-full ring-4 ring-card shadow-2xl"
            />
            <button
              type="button"
              onClick={() => onEdit('avatar')}
              aria-label="Edit profile picture"
              className="absolute -bottom-1 -right-1 z-10 grid size-9 place-items-center rounded-full border-2 border-card bg-accent text-accent-fg shadow-lg transition hover:scale-110 active:scale-90"
            >
              <Pencil className="size-4" />
            </button>
          </motion.div>

          {/* Name & Handle */}
          <div className="min-w-0 pb-1 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.25 }}
                className="truncate font-display text-2xl font-black tracking-tight sm:text-3xl"
              >
                {me.name || 'Otaku'}
              </motion.h1>
              {authUsername && (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                  @{authUsername}
                </span>
              )}
            </div>

            
          </div>
        </div>

        {/* Action Button: Edit Profile */}
        <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
          <motion.button
            type="button"
            onClick={() => onEdit()}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent/80 px-5 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition"
          >
            <Palette className="size-4" />
            <span>Customize Profile</span>
          </motion.button>
        </div>
      </div>

      {/* Bio Section down in hero card */}
      <div className="border-t border-border/60 bg-card-2/40 px-5 py-3.5 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Quote className="size-3 text-accent" /> Bio / About
          </span>
          <button
            type="button"
            onClick={() => onEdit('identity')}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {me.bio ? 'Edit bio' : '+ Add bio'}
          </button>
        </div>
        {me.bio ? (
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 whitespace-pre-line font-medium">
            “{me.bio}”
          </p>
        ) : (
          <p className="mt-1.5 text-xs italic text-muted">
            No bio yet. Tap <button type="button" onClick={() => onEdit('identity')} className="text-accent underline font-semibold">Edit Profile</button> to introduce yourself!
          </p>
        )}
      </div>
    </motion.section>
  )
}

/* ------------------------------------------------------------- Preset Gallery */

interface Pick {
  url: string
  group: string
}

function Gallery({
  kind,
  current,
  onPick,
}: {
  kind: CropKind
  current: string | null
  onPick: (url: string) => void
}) {
  const [all, setAll] = useState<Pick[] | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [shown, setShown] = useState(24)

  useEffect(() => {
    let dead = false
    const load =
      kind === 'avatar'
        ? import('../data/avatars.json').then((m) =>
            m.default.map((a) => ({ url: a.url, group: a.tags.join(', ') }))
          )
        : import('../data/banners.json').then((m) =>
            m.default.map((b) => ({ url: b.url, group: b.category }))
          )
    load.then((l) => !dead && setAll(l))
    return () => {
      dead = true
    }
  }, [kind])

  const groups = useMemo(
    () => [...new Set((all ?? []).flatMap((p) => p.group.split(', ')))].sort(),
    [all]
  )
  const list = (all ?? []).filter(
    (p) =>
      (!group || p.group.split(', ').includes(group)) &&
      p.group.toLowerCase().includes(q.trim().toLowerCase())
  )
  const noun = kind === 'avatar' ? 'Series' : 'Anime'

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-40">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setShown(24)
            }}
            placeholder={`Search ${kind}s by title…`}
            aria-label={`Search ${kind}s`}
            className="h-10 w-full rounded-full border border-border bg-card/80 pl-10 pr-4 text-sm outline-none transition focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
          />
        </div>
        <CustomSelect
          label={`${noun} filter`}
          value={group}
          onChange={(v) => {
            setGroup(v)
            setShown(24)
          }}
          placeholder={`All ${noun.toLowerCase()}`}
          options={[
            { value: '', label: `All ${noun.toLowerCase()}` },
            ...groups.map((g) => ({ value: g, label: g })),
          ]}
        />
      </div>

      {!all ? (
        <div className="flex items-center justify-center p-8 text-sm text-muted">
          <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent mr-2" />
          Loading presets…
        </div>
      ) : list.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">
          Nothing matches. Try another {noun.toLowerCase()}.
        </p>
      ) : (
        <>
          <ul
            className={cn(
              'mt-3.5 grid gap-2.5',
              kind === 'avatar'
                ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8'
                : 'grid-cols-2 sm:grid-cols-3'
            )}
          >
            {list.slice(0, shown).map((p, i) => (
              <motion.li
                key={p.url}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i, 16) * 0.02 }}
              >
                <button
                  type="button"
                  onClick={() => onPick(p.url)}
                  title={p.group}
                  aria-pressed={current === p.url}
                  className={cn(
                    'relative block w-full overflow-hidden rounded-2xl border transition duration-200 hover:ring-2 hover:ring-accent active:scale-95',
                    current === p.url
                      ? 'border-accent ring-2 ring-accent'
                      : 'border-border bg-card'
                  )}
                >
                  <img
                    src={p.url}
                    alt={p.group}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className={cn(
                      'w-full object-cover transition-transform duration-300 hover:scale-105',
                      kind === 'avatar' ? 'aspect-square' : 'aspect-[3/1]'
                    )}
                  />
                  {current === p.url && (
                    <div className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-fg shadow">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              </motion.li>
            ))}
          </ul>
          {shown < list.length && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + 24)}
                className={pill}
              >
                Show more ({list.length - shown} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- Dedicated Profile Editor */

export function ProfileEditor({
  me,
  initialTab = 'identity',
  onClose,
}: {
  me: Profile
  initialTab?: SectionKey
  onClose: () => void
}) {
  const { user, username: authUsername, updateUsername } = useAuth()
  const [activeTab, setActiveTab] = useState<SectionKey>(initialTab)

  // Local editable state
  const [name, setName] = useState(me.name)
  const [bio, setBio] = useState(me.bio || '')
  const [usernameInput, setUsernameInput] = useState(authUsername || '')
  const [savingUsername, setSavingUsername] = useState(false)

  useEffect(() => {
    setName(me.name)
    setBio(me.bio || '')
  }, [me.name, me.bio])

  // Modals & Cropper
  const [crop, setCrop] = useState<{ src: string; kind: CropKind; revoke?: boolean } | null>(null)
  const [gallery, setGallery] = useState<CropKind | null>(null)
  const [err, setErr] = useState('')
  const [frameFilter, setFrameFilter] = useState('')
  const [framesShown, setFramesShown] = useState(18)

  const files = {
    avatar: useRef<HTMLInputElement>(null),
    banner: useRef<HTMLInputElement>(null),
  }

  function choose(file: File | undefined, kind: CropKind) {
    if (!file) return
    setErr('')
    if (!file.type.startsWith('image/')) {
      setErr('That file is not an image.')
      toast('That file is not an image', 'error')
      return
    }
    if (file.size > 20 * 1048576) {
      setErr('Image is too large (20 MB max).')
      toast('Image is too large (20 MB max)', 'error')
      return
    }
    setCrop({ src: URL.createObjectURL(file), kind, revoke: true })
  }

  function closeCrop() {
    if (crop?.revoke) URL.revokeObjectURL(crop.src)
    setCrop(null)
  }

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault()
    const clean = usernameInput.trim()
    if (!clean) return
    if (clean.length < 3) {
      toast('Username must be at least 3 characters', 'error')
      return
    }
    setSavingUsername(true)
    const { error } = await updateUsername(clean)
    setSavingUsername(false)
    if (!error) {
      toast(`Username set to @${clean}!`)
    }
  }

  const frames = FRAMES.filter((f) => !frameFilter || frameGroup(f) === frameFilter)
  const shownFrames = frames.slice(0, framesShown)

  const TABS: { id: SectionKey; label: string; icon: LucideIcon }[] = [
    { id: 'identity', label: 'Identity', icon: UserRound },
    { id: 'avatar', label: 'Avatar (PFP)', icon: ImagePlus },
    { id: 'overlay', label: 'Frame', icon: Frame },
    { id: 'banner', label: 'Banner', icon: Images },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Top Header / Back Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur-md sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent active:scale-95"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Profile</span>
        </button>

        <div className="text-center sm:text-left">
          <h1 className="font-display text-lg font-bold">Customize Profile</h1>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
        >
          <Check className="size-4" />
          <span>Done</span>
        </button>
      </div>

      {/* Live Profile Card Preview */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card/60 shadow-xl">
        <div className="relative h-36 sm:h-48 overflow-hidden bg-card-2">
          {me.banner ? (
            <img
              src={me.banner}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full bg-gradient-to-br from-accent/20 via-card-2 to-card" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-black/30" />
          
          <div className="absolute left-4 bottom-3 sm:left-6 sm:bottom-4 flex items-end gap-3.5">
            <Avatar
              size={72}
              src={me.avatar}
              frame={me.frame}
              name={name || me.name}
              className="ring-4 ring-card shadow-2xl"
            />
            <div className="pb-1">
              <h2 className="font-display text-lg sm:text-xl font-black text-foreground">
                {name || me.name || 'Otaku'}
              </h2>
              {authUsername && (
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent">
                  @{authUsername}
                </span>
              )}
            </div>
          </div>
          <span className="absolute right-3.5 top-3.5 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/10">
            Live Preview
          </span>
        </div>
        {bio ? (
          <div className="border-t border-border/60 bg-card-2/40 px-5 py-3 sm:px-6">
            <p className="text-xs sm:text-sm italic text-foreground/90 leading-relaxed">
              “{bio}”
            </p>
          </div>
        ) : (
          <div className="border-t border-border/60 bg-card-2/20 px-5 py-2.5 sm:px-6">
            <p className="text-xs italic text-muted">No bio yet. Add your personal quote or introduction below!</p>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition active:scale-95',
                on
                  ? 'border-accent bg-accent/15 text-accent shadow-sm'
                  : 'border-border bg-card/60 text-muted hover:border-border/80 hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div className="rounded-3xl border border-border bg-card/60 p-5 sm:p-7 shadow-lg">
        {/* 1. Identity & Username */}
        {activeTab === 'identity' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <UserRound className="size-5 text-accent" />
                <span>Display Name</span>
              </h2>
              <p className="mt-1 text-xs text-muted">
                Your visible display name across the app and community.
              </p>
              <div className="mt-3 max-w-md">
                <div className="relative">
                  <input
                    value={name}
                    maxLength={24}
                    onChange={(e) => {
                      setName(e.target.value)
                      saveProfile({ name: e.target.value })
                    }}
                    placeholder="e.g. Shadow Otaku"
                    className="h-11 w-full rounded-2xl border border-border bg-card/80 px-4 text-sm font-medium outline-none transition focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted">
                    {name.length}/24
                  </span>
                </div>
              </div>
            </div>

            {/* Bio Editor */}
            <div className="border-t border-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <FileText className="size-5 text-accent" />
                    <span>Bio / About Me</span>
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Your personal anime quote or introduction, visible on your profile and community lounge.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    saveProfile({ bio: bio.trim() })
                    toast('Bio saved successfully!', 'success')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-md shadow-accent/20 transition hover:brightness-110 active:scale-95"
                >
                  <Save className="size-3.5" />
                  <span>Save Bio</span>
                </button>
              </div>

              <div className="mt-3.5 max-w-xl space-y-3">
                <div className="relative">
                  <textarea
                    value={bio}
                    maxLength={180}
                    rows={3}
                    onChange={(e) => {
                      setBio(e.target.value)
                      saveProfile({ bio: e.target.value })
                    }}
                    placeholder="Tell other otakus what you're watching or your all-time favorite anime quote..."
                    className="w-full rounded-2xl border border-border bg-card/80 p-3.5 text-sm font-medium outline-none transition resize-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                  />
                  <div className="flex justify-between items-center mt-1 px-1">
                    <span className="text-[11px] text-muted">Auto-saves as you type • or click Save Bio</span>
                    <span className="text-xs font-semibold text-muted">{bio.length}/180</span>
                  </div>
                </div>

                {/* Preset Suggestions */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                    Quick quote ideas (tap to use):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Watching the best seasonal anime 🍿',
                      'Shonen fan forever ⚔️',
                      'Binge watching is my cardio ⚡',
                      'Living in my own anime universe 🌸',
                      'Top tier anime lists & chill 🎌',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setBio(preset)
                          saveProfile({ bio: preset })
                          toast('Preset bio applied and saved!')
                        }}
                        className="rounded-full border border-border bg-card-2/60 px-3 py-1 text-xs font-medium text-foreground/85 transition hover:border-accent hover:text-accent active:scale-95"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <AtSign className="size-5 text-accent" />
                <span>Backend Cloud Username</span>
              </h2>
              <p className="mt-1 text-xs text-muted">
                Unique handle stored in the Supabase backend for cloud sync and profile identification.
              </p>

              {user ? (
                <form onSubmit={handleSaveUsername} className="mt-3.5 max-w-md space-y-3">
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="e.g. shadow_ninja"
                      maxLength={20}
                      className="h-11 w-full rounded-2xl border border-border bg-card/80 pl-10 pr-4 text-sm font-medium outline-none transition focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingUsername || !usernameInput.trim()}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-bold text-accent-fg shadow-md shadow-accent/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="size-4" />
                    <span>{savingUsername ? 'Saving…' : 'Save Username'}</span>
                  </button>
                </form>
              ) : (
                <div className="mt-3.5 rounded-2xl border border-border bg-card-2/60 p-4">
                  <p className="text-sm font-medium text-foreground">Cloud sync not active</p>
                  <p className="mt-1 text-xs text-muted">
                    Sign in or create an account from the profile page to link a unique @username and sync your history to the cloud.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Avatar (PFP) */}
        {activeTab === 'avatar' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <ImagePlus className="size-5 text-accent" />
                <span>Profile Picture</span>
              </h2>
              <p className="mt-1 text-xs text-muted">
                Upload your own photo or pick from popular anime series presets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className={solid}
                onClick={() => files.avatar.current?.click()}
              >
                <ImagePlus className="size-4" />
                <span>Upload custom photo</span>
              </button>

              <button
                type="button"
                className={cn(pill, gallery === 'avatar' && 'border-accent text-accent')}
                onClick={() => setGallery(gallery === 'avatar' ? null : 'avatar')}
              >
                <Images className="size-4" />
                <span>Browse presets gallery</span>
              </button>

              {me.avatar?.startsWith('data:') && (
                <button
                  type="button"
                  className={pill}
                  onClick={() => setCrop({ src: me.avatar!, kind: 'avatar' })}
                >
                  <Crop className="size-4" />
                  <span>Adjust crop</span>
                </button>
              )}

              {me.avatar && (
                <button
                  type="button"
                  className={pill}
                  onClick={() => {
                    saveProfile({ avatar: null })
                    toast('Profile picture removed', 'info')
                  }}
                >
                  <Trash2 className="size-4 text-red-400" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {gallery === 'avatar' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-2"
                >
                  <Gallery
                    kind="avatar"
                    current={me.avatar}
                    onPick={(u) => {
                      saveProfile({ avatar: u })
                      setGallery(null)
                      toast('Profile picture updated')
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 3. Avatar Frame (Overlay) */}
        {activeTab === 'overlay' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Frame className="size-5 text-accent" />
                  <span>Animated Avatar Frame</span>
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Smooth animations rendered around your avatar everywhere on Zenkai.
                </p>
              </div>

              <CustomSelect
                label="Frame category"
                value={frameFilter}
                onChange={(v) => {
                  setFrameFilter(v)
                  setFramesShown(18)
                }}
                placeholder="All categories"
                options={[
                  { value: '', label: 'All categories' },
                  ...Object.values(FRAME_GROUPS).map((g) => ({ value: g, label: g })),
                ]}
              />
            </div>

            <ul
              className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6"
              role="radiogroup"
              aria-label="Avatar frame options"
            >
              <li>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!me.frame}
                  onClick={() => {
                    saveProfile({ frame: null })
                    toast('Frame removed', 'info')
                  }}
                  className={cn(
                    'grid aspect-square w-full place-items-center rounded-2xl border text-xs font-bold transition active:scale-95',
                    !me.frame
                      ? 'border-accent bg-accent/15 text-accent ring-2 ring-accent'
                      : 'border-border text-muted hover:border-accent/50'
                  )}
                >
                  None
                </button>
              </li>

              {shownFrames.map((f, i) => {
                const on = me.frame === f.id
                return (
                  <motion.li
                    key={f.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i, 14) * 0.018 }}
                  >
                    <motion.button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={f.name}
                      title={f.name}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        saveProfile({ frame: f.id })
                        toast(`Frame: ${f.name}`)
                      }}
                      className={cn(
                        'relative block aspect-square w-full overflow-hidden rounded-2xl border bg-card-2/60 transition-colors',
                        on ? 'border-accent ring-2 ring-accent' : 'border-border hover:border-accent/50'
                      )}
                    >
                      <span className="absolute left-1/2 top-1/2 size-[82%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-card ring-1 ring-border">
                        {me.avatar && (
                          <img
                            src={me.avatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="size-full object-cover"
                          />
                        )}
                      </span>
                      <img
                        key={f.id}
                        src={frameUrl(f)}
                        alt=""
                        draggable={false}
                        decoding="sync"
                        className="relative size-full object-contain pointer-events-none"
                      />
                      {on && (
                        <div className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-accent-fg shadow">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                    </motion.button>
                  </motion.li>
                )
              })}
            </ul>

            {framesShown < frames.length && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setFramesShown((n) => n + 18)}
                  className={pill}
                >
                  Show more frames ({frames.length - framesShown} remaining)
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. Banner */}
        {activeTab === 'banner' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Images className="size-5 text-accent" />
                <span>Profile Banner</span>
              </h2>
              <p className="mt-1 text-xs text-muted">
                Large header image displayed at the top of your profile.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className={solid}
                onClick={() => files.banner.current?.click()}
              >
                <ImagePlus className="size-4" />
                <span>Upload banner</span>
              </button>

              <button
                type="button"
                className={cn(pill, gallery === 'banner' && 'border-accent text-accent')}
                onClick={() => setGallery(gallery === 'banner' ? null : 'banner')}
              >
                <Images className="size-4" />
                <span>Browse anime banners</span>
              </button>

              {me.banner?.startsWith('data:') && (
                <button
                  type="button"
                  className={pill}
                  onClick={() => setCrop({ src: me.banner!, kind: 'banner' })}
                >
                  <Crop className="size-4" />
                  <span>Adjust crop</span>
                </button>
              )}

              {me.banner && (
                <button
                  type="button"
                  className={pill}
                  onClick={() => {
                    saveProfile({ banner: null })
                    toast('Banner removed', 'info')
                  }}
                >
                  <Trash2 className="size-4 text-red-400" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {gallery === 'banner' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-2"
                >
                  <Gallery
                    kind="banner"
                    current={me.banner}
                    onPick={(u) => {
                      saveProfile({ banner: u })
                      setGallery(null)
                      toast('Banner updated')
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={files.avatar}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0], 'avatar')
          e.target.value = ''
        }}
      />
      <input
        ref={files.banner}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0], 'banner')
          e.target.value = ''
        }}
      />

      {err && (
        <p role="alert" className="flex items-center gap-2 px-1 text-sm text-red-400">
          <X className="size-4" /> {err}
        </p>
      )}

      {/* Image Cropper Modal */}
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
    </motion.div>
  )
}

/** Legacy wrapper alias for backwards compatibility */
export function ProfileCustomizer({
  me,
  open: _open,
  setOpen: _setOpen,
}: {
  me: Profile
  open: Set<SectionKey>
  setOpen: (s: Set<SectionKey>) => void
}) {
  return <ProfileEditor me={me} onClose={() => {}} />
}
