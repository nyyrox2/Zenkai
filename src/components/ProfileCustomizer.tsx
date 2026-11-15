import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Save,
  Search,
  Trash2,
  UserRound,
  X,
  ChevronsUp,
  Lock,
  Calendar,
  Users,
  Flame,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from './Avatar'
import { CustomSelect } from './CustomSelect'
import { ImageCropper, type CropKind } from './ImageCropper'
import { sniffBlob } from '../lib/animatedImage'
import { FRAMES, FRAME_GROUPS, frameGroup, frameUrl } from '../lib/frames'
import { saveProfile, type Profile } from '../lib/profile'
import { useList } from '../lib/library'
import { useAuth } from '../context/AuthContext'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import {
  canUploadCustomAvatar,
  canUploadCustomBanner,
  canUploadAnimatedAvatar,
  canUploadAnimatedBanner,
  isFrameUnlocked,
  FRAME_LEVEL_REQUIREMENTS,
  TEXT_EFFECTS,
  FONT_STYLES,
  HUNTER_TITLES,
  NAME_COLORS,
  getLevelProgress,
  getHunterRank,
  isEffectUnlocked,
  isFontUnlocked,
  isTitleUnlocked,
  isNameColorUnlocked,
} from '../lib/ascension/types'
import {
  getAscensionState,
  ascensionCell,
  equipCosmetic,
  pushAscensionToCloud,
} from '../lib/ascension/ascensionStore'
import { HunterRankBadge } from './ascension/HunterRankBadge'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'

export type SectionKey = 'identity' | 'avatar' | 'overlay' | 'banner' | 'ascension'

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
  const [ascensionState, setAscensionState] = useState(getAscensionState())
  const list = useList()

  useEffect(() => {
    return ascensionCell.subscribe(() => {
      setAscensionState(getAscensionState())
    })
  }, [])

  const progress = getLevelProgress(ascensionState.totalXp)
  const rank = getHunterRank(ascensionState.level)

  const completedCount = list.filter((i) => i.status === 'completed').length
  const watchingCount = list.filter((i) => i.status === 'watching').length
  const planningCount = list.filter((i) => i.status === 'planning').length

  const displayName = me.name || authUsername || 'Otaku'
  const handle = authUsername || (me.name ? me.name.toLowerCase().replace(/\s+/g, '_') : 'otaku')

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className={`relative pb-8 border-b border-[#242730]/60 ${me.banner ? 'pt-24 sm:pt-32' : 'pt-2 sm:pt-4'}`}
      aria-label="Profile showcase"
    >
      {/* Banner: sharp and visible, fading into the page so the avatar/text stay readable */}
      {me.banner ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 sm:h-60 overflow-hidden rounded-3xl">
          <img src={me.banner} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent via-40% to-background" />
        </div>
      ) : null}

      {/* Main Content Layout matching clean luxury Zenkai identity */}
      <div className="relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          {/* Left Group: Avatar + Identity + Level Progress */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 min-w-0 flex-1">
            {/* Avatar with Overlapping Level Badge */}
            <div className="relative shrink-0">
              <Avatar
                size={96}
                src={me.avatar}
                frame={me.frame}
                name={displayName}
                animateFrame
                className="relative rounded-full ring-4 ring-[#111318] bg-[#111318] shadow-2xl"
              />
              {/* Overlapping Hex/Pill Level Badge centered at bottom edge */}
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center justify-center min-w-[38px] px-2 py-0.5 rounded-lg bg-[#0B0C0F] border border-[#242730] shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                <span className="text-[8px] font-mono font-bold leading-none text-[#9298A4] tracking-widest uppercase">
                  LV
                </span>
                <span className="text-xs font-display font-black leading-tight text-[#F4F4F5]">
                  {ascensionState.level}
                </span>
              </div>

              {/* Edit Avatar Pencil Button */}
              <button
                type="button"
                onClick={() => onEdit('avatar')}
                aria-label="Edit avatar"
                title="Change profile picture"
                className="absolute top-0 right-0 z-10 grid size-6 place-items-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur-md shadow-lg transition hover:scale-110 active:scale-95"
              >
                <Pencil className="size-3" />
              </button>
            </div>

            {/* Identity Info */}
            <div className="min-w-0 flex-1 pt-1">
              {/* Name */}
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-[#F4F4F5] truncate max-w-full">
                <TextEffectRenderer
                  text={displayName}
                  effectId={ascensionState.equippedTextEffect}
                  fontId={ascensionState.equippedFontStyle}
                  colorId={me.nameColor || ascensionState.equippedNameColor}
                  fallbackClass="text-foreground"
                />
              </h1>

              {/* Handle */}
              <p className="text-xs font-mono font-medium text-[#9298A4] mt-0.5">
                @{handle}
              </p>

              {/* Bio / Tagline */}
              {me.bio?.trim() ? (
                <p className="text-xs sm:text-sm text-[#F4F4F5]/85 leading-relaxed mt-1.5 line-clamp-2">
                  {me.bio}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => onEdit('identity')}
                  className="text-xs text-accent/80 hover:text-accent italic mt-1.5 transition text-left"
                >
                  + Add your anime quote or bio...
                </button>
              )}

              {/* Metadata Row: Joined date + Streak + Hunter/Otaku */}
              <div className="flex flex-wrap items-center gap-3.5 text-xs font-mono text-[#9298A4] mt-2">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-[#9298A4]/70" />
                  <span>Joined October 3, 2026</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-500 font-bold">
                  <Flame className="size-3.5 text-amber-500" />
                  <span>{ascensionState.streak}d streak</span>
                </span>
                <span className="text-muted/60">•</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5 text-[#9298A4]/70" />
                  <span>{rank.name} (Otaku)</span>
                </span>
              </div>

              {/* LEVEL Progress Bar HUD */}
              <div className="mt-3.5 space-y-1.5 max-w-sm">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#F4F4F5] tracking-wider uppercase text-[11px]">
                    LEVEL {ascensionState.level}
                  </span>
                  <span className="text-[#9298A4] text-[11px]">
                    <strong className="text-[#F4F4F5] font-semibold">
                      {progress.xpIntoCurrentLevel.toLocaleString()}
                    </strong>{' '}
                    / {progress.xpNeededForThisLevel.toLocaleString()} XP
                  </span>
                </div>

                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10 border border-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-accent via-rose-500 to-amber-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Group: Large Stat Numbers + Action Buttons down below */}
          <div className="flex flex-col items-center sm:items-end justify-center gap-4 shrink-0 border-t border-[#242730]/60 pt-5 lg:border-t-0 lg:pt-0">
            {/* The 3 stat numbers */}
            <div className="flex items-center justify-around sm:justify-end gap-6 sm:gap-8 w-full sm:w-auto">
              <div className="text-center sm:text-right">
                <div className="font-display text-3xl sm:text-4xl font-black text-[#F4F4F5] tracking-tight">
                  {completedCount}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-[#9298A4] uppercase mt-0.5">
                  COMPLETED
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="font-display text-3xl sm:text-4xl font-black text-[#F4F4F5] tracking-tight">
                  {watchingCount}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-[#9298A4] uppercase mt-0.5">
                  WATCHING
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="font-display text-3xl sm:text-4xl font-black text-[#F4F4F5] tracking-tight">
                  {planningCount}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-[#9298A4] uppercase mt-0.5">
                  PLANNING
                </div>
              </div>
            </div>

            {/* Action Buttons down below the completed, watching and planning row */}
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => onEdit()}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
              >
                <Palette className="size-3.5" />
                <span>Customize</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit('banner')}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white active:scale-95"
              >
                <Camera className="size-3.5" />
                <span>Edit banner</span>
              </button>
            </div>
          </div>
        </div>
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
  me: liveMe,
  initialTab = 'identity',
  onClose,
}: {
  me: Profile
  initialTab?: SectionKey
  onClose: () => void
}) {
  const { user, username: authUsername, updateUsername } = useAuth()

  // Edits are staged here and only applied to the app (header, profile, cloud) when the editor is closed.
  type Cos = Partial<Record<'title' | 'effect' | 'font' | 'frame' | 'color', string | null>>
  const [draft, setDraft] = useState<Partial<Profile>>({})
  const [draftCos, setDraftCos] = useState<Cos>({})
  const draftRef = useRef<Partial<Profile>>({})
  const cosRef = useRef<Cos>({})
  const stage = (p: Partial<Profile>) => {
    draftRef.current = { ...draftRef.current, ...p }
    setDraft(draftRef.current)
  }
  const stageCosmetic = (type: keyof Cos, value: string | null) => {
    cosRef.current = { ...cosRef.current, [type]: value }
    setDraftCos(cosRef.current)
  }
  const commit = useCallback(() => {
    const d = draftRef.current
    const c = cosRef.current
    draftRef.current = {}
    cosRef.current = {}
    if (Object.keys(d).length) saveProfile(d)
    const equips = Object.entries(c)
    for (const [t, v] of equips) equipCosmetic(t as keyof Cos, v as string | null, false)
    if (equips.length) void pushAscensionToCloud()
  }, [])
  // Leaving the page by any route (Done, Back, nav bar) applies the staged changes.
  useEffect(() => () => commit(), [commit])
  const finish = () => {
    commit()
    onClose()
  }
  const me = useMemo<Profile>(() => ({ ...liveMe, ...draft }), [liveMe, draft])
  const hasDraft = Object.keys(draft).length + Object.keys(draftCos).length > 0
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

  const [liveAscension, setAscensionState] = useState(getAscensionState())
  useEffect(() => {
    return ascensionCell.subscribe(() => {
      setAscensionState(getAscensionState())
    })
  }, [])
  const ascensionState = useMemo(() => {
    const a = { ...liveAscension }
    if ('title' in draftCos) a.equippedTitle = draftCos.title || 'Otaku'
    if ('effect' in draftCos) a.equippedTextEffect = draftCos.effect || 'none'
    if ('font' in draftCos) a.equippedFontStyle = draftCos.font || 'default'
    if ('frame' in draftCos) a.equippedFrame = draftCos.frame ?? null
    if ('color' in draftCos) a.equippedNameColor = draftCos.color || 'default'
    return a
  }, [liveAscension, draftCos])
  const ascensionLevel = ascensionState.level

  const files = {
    avatar: useRef<HTMLInputElement>(null),
    banner: useRef<HTMLInputElement>(null),
  }

  async function choose(file: File | undefined, kind: CropKind) {
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

    // Sniff the bytes: APNGs usually arrive as plain .png, so the name / MIME type can't be trusted.
    const isAnimated = (await sniffBlob(file).catch(() => null)) !== null ||
      file.type === 'image/gif' ||
      file.name.toLowerCase().endsWith('.gif') ||
      file.name.toLowerCase().endsWith('.apng')

    if (kind === 'avatar') {
      if (isAnimated && !canUploadAnimatedAvatar(ascensionLevel)) {
        toast('🔒 Animated GIF/APNG avatars unlock at Level 20 (B-Rank Hunter)!', 'error')
        return
      }
      if (!canUploadCustomAvatar(ascensionLevel)) {
        toast('🔒 Custom Avatar upload unlocks at Level 5 (D-Rank Hunter)!', 'error')
        return
      }
    } else if (kind === 'banner') {
      if (isAnimated && !canUploadAnimatedBanner(ascensionLevel)) {
        toast('🔒 Animated GIF/APNG banners unlock at Level 30 (A-Rank Hunter)!', 'error')
        return
      }
      if (!canUploadCustomBanner(ascensionLevel)) {
        toast('🔒 Custom Banner upload unlocks at Level 10 (C-Rank Hunter)!', 'error')
        return
      }
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
    { id: 'ascension', label: 'Ascension Armory', icon: ChevronsUp },
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
          onClick={finish}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent active:scale-95"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Profile</span>
        </button>

        <div className="text-center sm:text-left">
          <h1 className="font-display text-lg font-bold">Customize Profile</h1>
          {hasDraft && <p className="text-[11px] text-muted">Applies when you tap Done</p>}
        </div>

        <button
          type="button"
          onClick={finish}
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
                <TextEffectRenderer
                  text={name || me.name || 'Otaku'}
                  effectId={ascensionState.equippedTextEffect}
                  fontId={ascensionState.equippedFontStyle}
                  colorId={me.nameColor || ascensionState.equippedNameColor}
                  fallbackClass="text-foreground"
                />
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <HunterRankBadge levelOrTier={ascensionLevel} size="xs" />
                {authUsername && (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent">
                    @{authUsername}
                  </span>
                )}
              </div>
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
                      stage({ name: e.target.value })
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
                    stage({ bio: bio.trim() })
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
                      stage({ bio: e.target.value })
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
                          stage({ bio: preset })
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
                className={cn(
                  solid,
                  !canUploadCustomAvatar(ascensionLevel) && 'opacity-75 bg-muted text-foreground'
                )}
                onClick={() => {
                  if (!canUploadCustomAvatar(ascensionLevel)) {
                    toast('🔒 Custom Avatar upload unlocks at Level 5! Complete daily quests to level up.', 'error')
                    return
                  }
                  files.avatar.current?.click()
                }}
              >
                {!canUploadCustomAvatar(ascensionLevel) ? (
                  <>
                    <Lock className="size-4 text-amber-500" />
                    <span>Upload photo (🔒 Level 5)</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" />
                    <span>Upload custom photo</span>
                  </>
                )}
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
                    stage({ avatar: null })
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
                      stage({ avatar: u })
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
                    stage({ frame: null })
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
                const isUnlocked = isFrameUnlocked(f.id, ascensionLevel)
                const reqLvl = FRAME_LEVEL_REQUIREMENTS[f.id] || 1

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
                      title={isUnlocked ? f.name : `${f.name} (Requires Level ${reqLvl})`}
                      whileHover={{ scale: isUnlocked ? 1.05 : 1, y: isUnlocked ? -2 : 0 }}
                      whileTap={{ scale: isUnlocked ? 0.94 : 1 }}
                      onClick={() => {
                        if (!isUnlocked) {
                          toast(`🔒 Requires Hunter Level ${reqLvl} to unlock!`, 'error')
                          return
                        }
                        stage({ frame: f.id })
                        stageCosmetic('frame', f.id)
                        toast(`Frame: ${f.name}`)
                      }}
                      className={cn(
                        'relative block aspect-square w-full overflow-hidden rounded-2xl border bg-card-2/60 transition-colors',
                        on ? 'border-accent ring-2 ring-accent' : 'border-border hover:border-accent/50',
                        !isUnlocked && 'opacity-60 cursor-not-allowed'
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
                        className={cn('relative size-full object-contain pointer-events-none', !isUnlocked && 'grayscale-[40%]')}
                      />
                      {on && (
                        <div className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-accent-fg shadow">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center p-1 text-center">
                          <Lock className="size-3.5 text-amber-400 mb-0.5" />
                          <span className="text-[9px] font-mono font-bold text-amber-300">
                            Lv {reqLvl}
                          </span>
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
                className={cn(
                  solid,
                  !canUploadCustomBanner(ascensionLevel) && 'opacity-75 bg-muted text-foreground'
                )}
                onClick={() => {
                  if (!canUploadCustomBanner(ascensionLevel)) {
                    toast('🔒 Custom Banner upload unlocks at Level 10! Complete missions to level up.', 'error')
                    return
                  }
                  files.banner.current?.click()
                }}
              >
                {!canUploadCustomBanner(ascensionLevel) ? (
                  <>
                    <Lock className="size-4 text-amber-500" />
                    <span>Upload banner (🔒 Level 10)</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" />
                    <span>Upload banner</span>
                  </>
                )}
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
                    stage({ banner: null })
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
                  exit={{ height: 0, opacity: 1 }}
                  className="overflow-hidden pt-2"
                >
                  <Gallery
                    kind="banner"
                    current={me.banner}
                    onPick={(u) => {
                      stage({ banner: u })
                      setGallery(null)
                      toast('Banner updated')
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 5. Ascension Armory (Text Effects & Titles) */}
        {activeTab === 'ascension' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <ChevronsUp className="size-5 text-accent" />
                  <span>Ascension Armory // Level {ascensionLevel}</span>
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Equip animated text aura effects, titles, and name colors unlocked by leveling up.
                </p>
              </div>

              <Link
                to="/ascension"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card-2/60 px-4 py-1.5 text-xs font-mono font-bold text-foreground hover:border-accent hover:text-accent transition"
              >
                <span>Full Hunter System ➔</span>
              </Link>
            </div>

            {/* Name Colors & Gradients Section */}
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted mb-3 flex items-center justify-between">
                <span>NAME COLOURS & GRADIENTS</span>
                <span className="text-[10px] font-normal text-muted">Choose your signature hunter color</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {NAME_COLORS.map((col) => {
                  const unlocked = isNameColorUnlocked(col.id, ascensionLevel)
                  const isEquipped = (me.nameColor || ascensionState.equippedNameColor || 'default') === col.id

                  return (
                    <div
                      key={col.id}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${col.minLevel}!`, 'error')
                          return
                        }
                        const val = col.id === 'default' ? null : col.id
                        stage({ nameColor: val })
                        stageCosmetic('color', val)
                        toast(val ? `Equipped colour: ${col.name}` : 'Reset to default colour')
                      }}
                      className={cn(
                        'rounded-2xl border p-3 transition-all flex flex-col justify-between cursor-pointer select-none',
                        isEquipped
                          ? 'border-accent bg-accent/15 ring-2 ring-accent/30 shadow-md'
                          : unlocked
                          ? 'border-border/60 bg-card-2/40 hover:border-accent/40 hover:bg-card-2'
                          : 'border-border/30 bg-card-2/20 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="size-4 rounded-full shrink-0 border border-white/20 shadow-sm"
                          style={{
                            background: col.isGradient
                              ? 'linear-gradient(135deg, var(--accent), #f59e0b, #a855f7)'
                              : col.colorHex,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold font-mono truncate text-foreground">{col.name}</p>
                          <span className="text-[10px] font-mono text-muted">
                            {col.minLevel > 1 ? `Lv ${col.minLevel}` : 'Free'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono">
                        <span className={cn('font-bold truncate max-w-[80px]', col.cssClass)}>
                          {name || me.name || 'Sample'}
                        </span>
                        {isEquipped ? (
                          <span className="text-accent font-bold text-[10px]">ACTIVE</span>
                        ) : !unlocked ? (
                          <span className="text-amber-500 text-[10px]">🔒 Lv {col.minLevel}</span>
                        ) : (
                          <span className="text-muted text-[10px]">Pick</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Typography Font Styles Section */}
            <div className="border-t border-border/50 pt-5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted mb-3 flex items-center justify-between">
                <span>TYPOGRAPHY FONT STYLES</span>
                <span className="text-[10px] text-accent">Active: {FONT_STYLES.find(f => f.id === ascensionState.equippedFontStyle)?.name || 'Modern Obsidian'}</span>
              </h3>
              <div className="divide-y divide-[#242730]/60 rounded-2xl border border-[#242730]/70 bg-[#0B0C0F]/90 overflow-hidden">
                {FONT_STYLES.map((f) => {
                  const unlocked = isFontUnlocked(f.id, ascensionLevel)
                  const isEquipped = (ascensionState.equippedFontStyle || 'default') === f.id
                  const cleanName = f.name.split(' (')[0]
                  const subTag = f.name.includes('(') ? f.name.split('(')[1].replace(')', '') : ''

                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${f.minLevel}!`, 'error')
                          return
                        }
                        stageCosmetic('font', isEquipped ? 'default' : f.id)
                        toast(isEquipped ? 'Font reset to Modern Obsidian' : `Equipped font: ${cleanName}`)
                      }}
                      className={cn(
                        'group flex items-center justify-between py-3.5 px-4 sm:px-5 transition-all duration-150 cursor-pointer select-none',
                        isEquipped
                          ? 'bg-accent/10'
                          : unlocked
                          ? 'hover:bg-white/[0.03]'
                          : 'opacity-40 hover:opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-baseline gap-3 min-w-0 flex-1 pr-3">
                        <span
                          className={cn(
                            'text-xl sm:text-2xl tracking-wide transition-colors leading-none',
                            isEquipped ? 'text-accent font-bold' : 'text-[#F4F4F5] group-hover:text-white'
                          )}
                          style={{ fontFamily: f.fontFamily, letterSpacing: f.letterSpacing }}
                        >
                          {cleanName}
                        </span>
                        {subTag && (
                          <span className="hidden sm:inline text-[11px] font-mono text-[#9298A4] opacity-70">
                            {subTag}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono">
                        {isEquipped ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-accent text-xs">
                            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                            <span>ACTIVE</span>
                          </span>
                        ) : unlocked ? (
                          <span className="text-[#9298A4] group-hover:text-white transition-colors text-xs">
                            {f.minLevel > 1 ? `Lv ${f.minLevel}` : 'Free'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#9298A4]/60 text-xs">
                            <Lock className="size-3" />
                            <span>Lv {f.minLevel}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Text Effects Section */}
            <div className="border-t border-border/50 pt-5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted mb-3">
                NAME TEXT EFFECTS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TEXT_EFFECTS.map((eff) => {
                  const unlocked = isEffectUnlocked(eff.id, ascensionLevel)
                  const isEquipped = ascensionState.equippedTextEffect === eff.id

                  return (
                    <div
                      key={eff.id}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${eff.minLevel}!`, 'error')
                          return
                        }
                        stageCosmetic('effect', isEquipped ? 'none' : eff.id)
                        toast(isEquipped ? 'Text effect removed' : `Equipped: ${eff.name}`)
                      }}
                      className={cn(
                        'rounded-2xl border p-4 transition-all flex flex-col justify-between cursor-pointer',
                        isEquipped
                          ? 'border-accent bg-card-2/40 ring-1 ring-accent shadow-sm'
                          : unlocked
                          ? 'border-border/60 bg-card-2/40 hover:border-accent/40'
                          : 'border-border/30 bg-card-2/20 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div>
                        {/* Header: Shader Name & Level Requirement */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: eff.glowColor && eff.glowColor !== 'transparent' ? eff.glowColor : 'var(--accent)' }}
                            />
                            <h4 className="text-sm font-bold text-foreground truncate font-display">
                              {eff.name}
                            </h4>
                          </div>
                          <span className="rounded-full border border-border/80 bg-card px-2 py-0.5 text-[10px] font-mono text-muted shrink-0">
                            {eff.minLevel > 1 ? `Lv ${eff.minLevel}` : 'Free'}
                          </span>
                        </div>

                        {/* Live Shader Preview on Clean Card Surface */}
                        <div className="py-3.5 my-0.5 flex items-center justify-center text-center">
                          <div className="text-lg sm:text-xl font-black tracking-wide text-center truncate max-w-full">
                            <TextEffectRenderer
                              text={name || me.name || authUsername || 'Otaku'}
                              effectId={eff.id}
                              fontId={ascensionState.equippedFontStyle}
                              fallbackClass="text-foreground"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-muted leading-tight line-clamp-2 mt-1">{eff.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs font-mono">
                        <span className="text-[10px] text-muted">Surface Shader</span>
                        <span className={cn('font-bold', isEquipped ? 'text-accent' : unlocked ? 'text-accent' : 'text-amber-500')}>
                          {isEquipped ? '✓ EQUIPPED' : unlocked ? 'EQUIP' : `🔒 Lv ${eff.minLevel}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hunter Titles Section */}
            <div className="border-t border-border/50 pt-5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted mb-3">
                HUNTER TITLES
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {HUNTER_TITLES.map((t) => {
                  const unlocked = isTitleUnlocked(t.title, ascensionLevel)
                  const isEquipped = ascensionState.equippedTitle === t.title

                  return (
                    <div
                      key={t.title}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${t.minLevel}!`, 'error')
                          return
                        }
                        stageCosmetic('title', t.title)
                        toast(`Equipped title: ${t.title}`)
                      }}
                      className={cn(
                        'rounded-2xl border p-4 transition-all flex flex-col justify-between cursor-pointer',
                        isEquipped
                          ? 'border-accent bg-accent/15 ring-2 ring-accent/30'
                          : unlocked
                          ? 'border-border/60 bg-card-2/40 hover:border-accent/40'
                          : 'border-border/30 bg-card-2/20 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-semibold text-muted">
                            LEVEL {t.minLevel}
                          </span>
                          {isEquipped ? (
                            <span className="text-[10px] font-mono font-bold text-accent">ACTIVE</span>
                          ) : !unlocked ? (
                            <span className="text-[10px] font-mono text-amber-500">🔒 LOCKED</span>
                          ) : null}
                        </div>

                        <p className="font-mono text-sm font-bold text-foreground">{t.title}</p>
                        <p className="text-xs text-muted leading-tight mt-0.5">{t.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/50 text-right">
                        <span className="text-xs font-bold text-accent">
                          {isEquipped ? 'Currently Equipped' : unlocked ? 'Equip Title' : `Unlocks at Lv ${t.minLevel}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={files.avatar}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/apng,image/avif,.gif,.apng"
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0], 'avatar')
          e.target.value = ''
        }}
      />
      <input
        ref={files.banner}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/apng,image/avif,.gif,.apng"
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
              stage(crop.kind === 'avatar' ? { avatar: url } : { banner: url })
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
