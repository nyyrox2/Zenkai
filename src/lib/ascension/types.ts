// ============================================================================
// ZENKAI // ASCENSION — Progression System Types & Constants
// ============================================================================

export type HunterRankTier = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS'

export interface RankInfo {
  tier: HunterRankTier
  name: string
  title: string
  minLevel: number
  maxLevel: number
  color: string
  glowColor: string
  gradient: string
  bgGradient: string
  borderColor: string
  badgeIcon: string
  badgeUrl: string
  description: string
}

export const HUNTER_RANKS: Record<HunterRankTier, RankInfo> = {
  E: {
    tier: 'E',
    name: 'E-Rank',
    title: 'Otaku',
    minLevel: 1,
    maxLevel: 4,
    color: '#94a3b8',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    gradient: 'from-slate-400 to-slate-600',
    bgGradient: 'from-slate-900/60 to-slate-950/80',
    borderColor: '#475569',
    badgeIcon: '🗡️',
    badgeUrl: '/ranks/rank-e.png',
    description: 'Awakened with latent energy. Embarking on the Hunter journey.',
  },
  D: {
    tier: 'D',
    name: 'D-Rank',
    title: 'Novice Otaku',
    minLevel: 5,
    maxLevel: 9,
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.5)',
    gradient: 'from-sky-400 to-blue-600',
    bgGradient: 'from-sky-950/60 to-slate-950/80',
    borderColor: '#0284c7',
    badgeIcon: '⚡',
    badgeUrl: '/ranks/rank-d.png',
    description: 'Surpassed basic human limits. Capable of clearing low-rank dungeons.',
  },
  C: {
    tier: 'C',
    name: 'C-Rank',
    title: 'Experienced Hunter',
    minLevel: 10,
    maxLevel: 19,
    color: '#4ade80',
    glowColor: 'rgba(74, 222, 128, 0.5)',
    gradient: 'from-emerald-400 to-green-600',
    bgGradient: 'from-emerald-950/60 to-slate-950/80',
    borderColor: '#16a34a',
    badgeIcon: '⚔️',
    badgeUrl: '/ranks/rank-c.png',
    description: 'Battlefield seasoned. Trusted with hazardous raid operations.',
  },
  B: {
    tier: 'B',
    name: 'B-Rank',
    title: 'Elite Hunter',
    minLevel: 20,
    maxLevel: 29,
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    gradient: 'from-purple-400 to-indigo-600',
    bgGradient: 'from-purple-950/60 to-slate-950/80',
    borderColor: '#7e22ce',
    badgeIcon: '🔮',
    badgeUrl: '/ranks/rank-b.png',
    description: 'Formidable strike squad commander with immense mana density.',
  },
  A: {
    tier: 'A',
    name: 'A-Rank',
    title: 'Advanced Hunter',
    minLevel: 30,
    maxLevel: 39,
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    gradient: 'from-amber-400 to-orange-600',
    bgGradient: 'from-amber-950/60 to-slate-950/80',
    borderColor: '#d97706',
    badgeIcon: '🔥',
    badgeUrl: '/ranks/rank-a.png',
    description: 'National-level talent. Capable of soloing Red Gates.',
  },
  S: {
    tier: 'S',
    name: 'S-Rank',
    title: 'Master Hunter',
    minLevel: 40,
    maxLevel: 49,
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.7)',
    gradient: 'from-rose-500 to-red-700',
    bgGradient: 'from-red-950/70 to-slate-950/90',
    borderColor: '#b91c1c',
    badgeIcon: '👑',
    badgeUrl: '/ranks/rank-s.png',
    description: 'Living natural calamity. Supreme guild leader status.',
  },
  SS: {
    tier: 'SS',
    name: 'SS-Rank',
    title: 'Shadow Monarch',
    minLevel: 50,
    maxLevel: 999,
    color: '#00f0ff',
    glowColor: 'rgba(0, 240, 255, 0.85)',
    gradient: 'from-cyan-400 via-teal-300 to-blue-600',
    bgGradient: 'from-cyan-950/80 via-slate-950/90 to-black',
    borderColor: '#0891b2',
    badgeIcon: '🌌',
    badgeUrl: '/ranks/rank-ss.png',
    description: 'Transcended mortality. Ruler of the Shadow Realm and Sovereign of Souls.',
  },
}

// ----------------------------------------------------------------------------
// Leveling Mathematics
// Formula: XP_next = 100 + 50 * (Level - 1)
// ----------------------------------------------------------------------------

export function xpNeededForNextLevel(level: number): number {
  if (level <= 0) return 100
  return 100 + 50 * (level - 1)
}

/** Total XP required to reach a specific level starting from Level 1 (0 XP) */
export function totalXpForLevel(targetLevel: number): number {
  if (targetLevel <= 1) return 0
  let total = 0
  for (let l = 1; l < targetLevel; l++) {
    total += xpNeededForNextLevel(l)
  }
  return total
}

/** Calculate current level given cumulative total XP */
export function calculateLevelFromXp(totalXp: number): number {
  if (totalXp <= 0) return 1
  let level = 1
  let accumulated = 0
  while (true) {
    const needed = xpNeededForNextLevel(level)
    if (accumulated + needed > totalXp) break
    accumulated += needed
    level++
  }
  return level
}

/** Get level progress breakdown: current level, progress in current level, needed for next, percentage */
export function getLevelProgress(totalXp: number) {
  const level = calculateLevelFromXp(totalXp)
  const currentLevelBaseXp = totalXpForLevel(level)
  const nextLevelBaseXp = totalXpForLevel(level + 1)
  const xpIntoCurrentLevel = Math.max(0, totalXp - currentLevelBaseXp)
  const xpNeededForThisLevel = nextLevelBaseXp - currentLevelBaseXp
  const percent = Math.min(100, Math.max(0, Math.round((xpIntoCurrentLevel / xpNeededForThisLevel) * 100)))
  const xpRemaining = Math.max(0, xpNeededForThisLevel - xpIntoCurrentLevel)

  return {
    level,
    totalXp,
    currentLevelBaseXp,
    nextLevelBaseXp,
    xpIntoCurrentLevel,
    currentLevelXp: xpIntoCurrentLevel,
    xpNeededForThisLevel,
    neededForNextLevel: xpNeededForThisLevel,
    xpRemaining,
    remainingXp: xpRemaining,
    percent,
  }
}

/** Get hunter rank details for a given level */
export function getHunterRank(level: number): RankInfo {
  if (level >= 50) return HUNTER_RANKS.SS
  if (level >= 40) return HUNTER_RANKS.S
  if (level >= 30) return HUNTER_RANKS.A
  if (level >= 20) return HUNTER_RANKS.B
  if (level >= 10) return HUNTER_RANKS.C
  if (level >= 5) return HUNTER_RANKS.D
  return HUNTER_RANKS.E
}

// ----------------------------------------------------------------------------
// Unlock Perk Thresholds
// ----------------------------------------------------------------------------

export interface PerkUnlock {
  level: number
  title: string
  description: string
  category: 'pfp' | 'banner' | 'overlay' | 'effect' | 'title'
  badge: string
}

export const PERK_UNLOCKS: PerkUnlock[] = [
  { level: 1, title: 'Hunter Initiation', description: 'Unlock standard preset avatars and basic emote overlays', category: 'overlay', badge: '🗡️' },
  { level: 5, title: 'Custom Avatar Upload', description: 'Unlock custom static image PFP uploading from your device', category: 'pfp', badge: '🖼️' },
  { level: 5, title: 'Sakura Petals & D-Rank Tag', description: 'Fluttering cherry blossom text effect + D-Rank Novice Hunter identity badge', category: 'effect', badge: '🌸' },
  { level: 8, title: 'Mystic Ghost Fog', description: 'Ethereal rolling atmospheric smoke & fog text effect', category: 'effect', badge: '🌫️' },
  { level: 10, title: 'Custom Banner Upload', description: 'Unlock custom static banner image uploading for your profile', category: 'banner', badge: '🎨' },
  { level: 10, title: 'Diamond Shimmer Effect', description: 'Kinetic sparkling crystalline username text effect', category: 'effect', badge: '💎' },
  { level: 15, title: 'Kinetic Bounce & Chunin', description: 'Rhythmic spring-wave text effect + Chunin Shinobi title', category: 'effect', badge: '🌀' },
  { level: 20, title: 'Animated GIF & APNG Avatar', description: 'Unlock animated 60fps GIF/APNG avatars on your profile!', category: 'pfp', badge: '✨' },
  { level: 20, title: 'Super Saiyan & Ki Flames', description: 'Legendary Ki Energy overlay + Super Saiyan anime title', category: 'title', badge: '🔥' },
  { level: 22, title: 'Electric Ki Sparks', description: 'Surging lightning spark arcs text animation', category: 'effect', badge: '⚡' },
  { level: 25, title: 'Neon Prism Shader', description: 'Vibrant multi-chromatic synthwave neon text effect', category: 'effect', badge: '🌈' },
  { level: 30, title: 'Animated GIF & APNG Banner', description: 'Unlock full animated motion banners on your profile!', category: 'banner', badge: '🎬' },
  { level: 30, title: 'Molten Blaze Effect', description: 'Roaring volcanic fire aura typography', category: 'effect', badge: '🌋' },
  { level: 35, title: 'Frostbite Text Effect', description: 'Icy crystalline glacial frost typography aura', category: 'effect', badge: '❄️' },
  { level: 40, title: 'Straw Hat & Master Aura', description: 'S-Rank Master status + Legendary Straw Hat title', category: 'title', badge: '👒' },
  { level: 45, title: 'RGB Glitch (Zenkai Max)', description: 'Chromatic aberration cyber matrix text effect', category: 'effect', badge: '⚡' },
  { level: 50, title: 'Shadow Monarch & Black Hole', description: 'SS-Rank Sovereign of Souls + Cosmic Black Hole avatar overlay', category: 'title', badge: '🌌' },
]

export function getUnlockedPerks(level: number): PerkUnlock[] {
  return PERK_UNLOCKS.filter((p) => level >= p.level)
}

export function getNextPerk(level: number): PerkUnlock | null {
  return PERK_UNLOCKS.find((p) => p.level > level) || null
}

/** Development override: when false, progression, perks, cosmetics, and uploads strictly enforce server-side level requirements */
export const DEV_UNLOCK_ALL = false

// Check feature permissions based on level
export function canUploadCustomAvatar(level: number): boolean {
  return DEV_UNLOCK_ALL || level >= 5
}

export function canUploadAnimatedAvatar(level: number): boolean {
  return DEV_UNLOCK_ALL || level >= 20
}

export function canUploadCustomBanner(level: number): boolean {
  return DEV_UNLOCK_ALL || level >= 10
}

export function canUploadAnimatedBanner(level: number): boolean {
  return DEV_UNLOCK_ALL || level >= 30
}

// ----------------------------------------------------------------------------
// Overlay / Frame Level Requirements
// ----------------------------------------------------------------------------

export const FRAME_LEVEL_REQUIREMENTS: Record<string, number> = {
  // Common / Level 1
  '1-angry': 1,
  '1-dismay': 1,
  '1-sweat-drops': 1,
  '1-shocked': 1,
  '1-in-tears': 1,
  '1-starry-eyed': 1,

  // Rare / Level 5
  '1-cat-ears': 5,
  '1-heartbloom': 5,
  '1-in-love': 5,
  '1-soul-leaving-body': 5,
  '6-air': 5,
  '6-water': 5,
  '6-earth': 5,
  '7-cozy-cat': 5,
  '7-cozy-headphones': 5,
  '9-butterflies': 5,

  // Epic / Level 10
  '1-rage': 10,
  '1-radiating-energy': 10,
  '2-cybernetic': 10,
  '2-glitch': 10,
  '2-implant': 10,
  '4-defensive-shield': 10,
  '4-magical-potion': 10,
  '4-glowing-runes': 10,
  '5-koi-pond': 10,
  '5-firecrackers': 10,
  '5-lunar-lanterns': 10,
  '6-fire': 10,
  '7-chromawave': 10,
  '7-rainy-mood': 10,
  '9-the-petal-pack': 10,

  // Legendary / Level 20
  '1-ki-energy': 20,
  '2-digital-sunrise': 20,
  '3-disxcore-headset': 20,
  '3-futuristic-ui': 20,
  '3-smoke': 20,
  '4-flaming-sword': 20,
  '4-wizard-s-staff': 20,
  '4-skull-medallion': 20,
  '4-treasure-and-key': 20,
  '6-lightning': 20,
  '8-blade-storm': 20,
  '8-omens-cowl': 20,
  '10-astronaut-helmet': 20,
  '10-constellations': 20,
  '10-stardust': 20,

  // Mythic / Level 35
  '5-dragon-s-smile': 35,
  '6-balance': 35,
  '8-reynas-leer': 35,
  '10-solar-orbit': 35,
  '10-ufo': 35,

  // Cosmic Singularity / Level 50
  '10-black-hole': 50,
}

export function getRequiredLevelForFrame(frameId: string): number {
  return FRAME_LEVEL_REQUIREMENTS[frameId] || 1
}

export function isFrameUnlocked(frameId: string, level: number): boolean {
  return DEV_UNLOCK_ALL || level >= getRequiredLevelForFrame(frameId)
}

// ----------------------------------------------------------------------------
// Font Typography Styles (Real Anime & Gaming Google Fonts)
// ----------------------------------------------------------------------------

export interface FontStyleDef {
  id: string
  name: string
  minLevel: number
  description: string
  fontFamily: string
  previewText: string
  letterSpacing?: string
}

export const FONT_STYLES: FontStyleDef[] = [
  {
    id: 'default',
    name: 'Outfit (Modern Zenkai)',
    minLevel: 1,
    description: 'Crisp contemporary sans-serif with ultra-clean obsidian geometry',
    fontFamily: "'Outfit', sans-serif",
    previewText: 'Zenkai',
    letterSpacing: '0.01em',
  },
  {
    id: 'bebas',
    name: 'Bebas Neue (Anime Shonen)',
    minLevel: 3,
    description: 'Tall, condensed, all-caps anime title card typography',
    fontFamily: "'Bebas Neue', sans-serif",
    previewText: 'SHONEN',
    letterSpacing: '0.08em',
  },
  {
    id: 'chakra',
    name: 'Chakra Petch (Mecha Tactical)',
    minLevel: 7,
    description: 'Squared-off mecha combat HUD interface and tactical squad typography',
    fontFamily: "'Chakra Petch', sans-serif",
    previewText: 'TACTICAL',
    letterSpacing: '0.04em',
  },
  {
    id: 'nosifer',
    name: 'Nosifer (Dripping Meltdown)',
    minLevel: 12,
    description: 'Authentic dripping liquid and bleeding typography with organic melting stalactites',
    fontFamily: "'Nosifer', display, cursive",
    previewText: 'DRIP',
    letterSpacing: '0.05em',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono (Cyber Matrix)',
    minLevel: 10,
    description: 'High-tech developer monospaced font with cyber matrix feel',
    fontFamily: "'JetBrains Mono', monospace",
    previewText: '[01_CYBER]',
    letterSpacing: '-0.02em',
  },
  {
    id: 'orbitron',
    name: 'Orbitron (Cyberpunk 2077 HUD)',
    minLevel: 14,
    description: 'Angular sci-fi spaceframe HUD typography with futuristic neon cuts',
    fontFamily: "'Orbitron', sans-serif",
    previewText: 'CYBERPUNK',
    letterSpacing: '0.06em',
  },
  {
    id: 'silkscreen',
    name: 'Silkscreen (Arcade 8-Bit Pixel)',
    minLevel: 18,
    description: 'Crisp retro 8-bit / 16-bit JRPG arcade pixel gamer typography',
    fontFamily: "'Silkscreen', monospace",
    previewText: 'ARCADE',
    letterSpacing: '0.02em',
  },
  {
    id: 'marker',
    name: 'Permanent Marker (Raw Manga Ink)',
    minLevel: 22,
    description: 'Dynamic raw ink street brush strokes with explosive action energy',
    fontFamily: "'Permanent Marker', cursive",
    previewText: 'SLASH!',
    letterSpacing: '0.03em',
  },
  {
    id: 'lacquer',
    name: 'Lacquer (Wet Enamel Drip)',
    minLevel: 24,
    description: 'Raw wet paint-pen display font with organic dripping enamel accents',
    fontFamily: "'Lacquer', cursive",
    previewText: 'LIQUID',
    letterSpacing: '0.04em',
  },
  {
    id: 'reggae',
    name: 'Reggae One (Shonen Jump Slash)',
    minLevel: 26,
    description: 'Sharpened dynamic blade terminals inspired by Japanese boys manga',
    fontFamily: "'Reggae One', cursive, sans-serif",
    previewText: 'ZENKAI',
    letterSpacing: '0.03em',
  },
  {
    id: 'syne',
    name: 'Syne (Avant-Garde Cyber)',
    minLevel: 30,
    description: 'Ultra-wide dramatic high-fashion futuristic anime branding font',
    fontFamily: "'Syne', sans-serif",
    previewText: 'AVANT',
    letterSpacing: '0.06em',
  },
  {
    id: 'cinzel',
    name: 'Cinzel Sovereign (Shadow Monarch)',
    minLevel: 35,
    description: 'Imperial regal fantasy serif with sharp sovereign flourishes',
    fontFamily: "'Cinzel Decorative', serif",
    previewText: 'SOVEREIGN',
    letterSpacing: '0.04em',
  },
  {
    id: 'rampart',
    name: 'Rampart One (3D Anime Pop)',
    minLevel: 40,
    description: 'Playful 3D stacked block outline font with high-energy pop rhythm',
    fontFamily: "'Rampart One', display, cursive",
    previewText: 'LEVELING',
    letterSpacing: '0.05em',
  },
  {
    id: 'shojumaru',
    name: 'Shojumaru (Demon Slayer Folklore)',
    minLevel: 44,
    description: 'Martial arts demon hunter brush typography with feudal mystique',
    fontFamily: "'Shojumaru', cursive, display",
    previewText: 'DEMON',
    letterSpacing: '0.03em',
  },
  {
    id: 'glitch_font',
    name: 'Rubik Glitch (Signal Breach)',
    minLevel: 47,
    description: 'Raw signal disruption and corrupted broadcast digital glitch typeface',
    fontFamily: "'Rubik Glitch', display",
    previewText: 'CORRUPTED',
    letterSpacing: '0.02em',
  },
  {
    id: 'dela',
    name: 'Dela Gothic (Manga Titan)',
    minLevel: 50,
    description: 'Legendary ultra-heavy Japanese anime/manga poster block gothic',
    fontFamily: "'Dela Gothic One', sans-serif",
    previewText: 'TITAN',
    letterSpacing: '0.04em',
  },
]

export function isFontUnlocked(fontId: string, level: number): boolean {
  if (DEV_UNLOCK_ALL) return true
  const f = FONT_STYLES.find((item) => item.id === fontId)
  if (!f) return true
  return level >= f.minLevel
}

// ----------------------------------------------------------------------------
// Text Effect Level Requirements (High-End Typographic Surface Shaders)
// ----------------------------------------------------------------------------

export interface TextEffectDef {
  id: string
  name: string
  minLevel: number
  description: string
  className: string
  glowColor: string
}

export const TEXT_EFFECTS: TextEffectDef[] = [
  {
    id: 'none',
    name: 'Clean Solid',
    minLevel: 1,
    description: 'Crisp, unadorned obsidian typography without active animated shaders',
    className: '',
    glowColor: 'transparent',
  },
  {
    id: 'pulse',
    name: 'Astral Monarch Domain',
    minLevel: 3,
    description: 'Solo Leveling Sovereign dark-matter plasma aura with undulating violet-cyan coronal flares',
    className: 'effect-pulse',
    glowColor: '#00f0ff',
  },
  {
    id: 'chrome',
    name: 'Liquid Mercury Chrome',
    minLevel: 5,
    description: 'Mirror-finish molten liquid chrome with high-contrast horizon reflection and moving specular glints',
    className: 'effect-chrome',
    glowColor: '#e2e8f0',
  },
  {
    id: 'gold',
    name: 'Imperial 24K Sovereign Gold',
    minLevel: 8,
    description: '24-karat solid bullion gold luster with high-velocity diagonal light gleam and ambient golden bloom',
    className: 'effect-gold-foil',
    glowColor: '#f59e0b',
  },
  {
    id: 'melt',
    name: 'Viscous Blood Meltdown',
    minLevel: 10,
    description: 'Organic liquefied enamel displacement wave with viscous fluid gravity sag and liquid gloss',
    className: 'effect-melt',
    glowColor: '#e11d48',
  },
  {
    id: 'acid',
    name: 'Biohazard Toxic Slime',
    minLevel: 12,
    description: 'High-luminance radioactive lime acid melt with undulating chemical ooze and toxic vapor glow',
    className: 'effect-acid',
    glowColor: '#84cc16',
  },
  {
    id: 'holographic',
    name: 'Prismatic Secret Rare Foil',
    minLevel: 15,
    description: 'Continuous diffraction grating rainbow pastel spectrum with metallic iridescent refraction',
    className: 'effect-holographic',
    glowColor: '#c084fc',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Cyberpunk 2077 Neon',
    minLevel: 18,
    description: 'Authentic dual-gas glass discharge tube: white-hot core filament with intense magenta/cyan ambient glow',
    className: 'effect-tokyo-neon',
    glowColor: '#ff007f',
  },
  {
    id: 'inferno',
    name: 'Combustion Flame Inferno',
    minLevel: 21,
    description: 'Multi-stage fire combustion with incandescent core, licking crimson flames, and rising heat haze',
    className: 'effect-inferno',
    glowColor: '#ff3f00',
  },
  {
    id: 'electric',
    name: '100,000V High-Voltage Surge',
    minLevel: 24,
    description: 'Blinding electric blue-white plasma discharge with erratic sub-millisecond voltage arcing',
    className: 'effect-electric',
    glowColor: '#00f0ff',
  },
  {
    id: 'frostbite',
    name: 'Absolute Zero Glacial Cryo',
    minLevel: 27,
    description: 'Sub-zero crystalline ice diamond gradient with frost specular bloom and sub-zero blue mist',
    className: 'effect-frostbite',
    glowColor: '#38bdf8',
  },
  {
    id: 'shimmer',
    name: 'Diamond Haute Horlogerie',
    minLevel: 30,
    description: 'Pure platinum surface crossed by a razor-sharp 110° diagonal beam of blinding white diamond light',
    className: 'effect-shimmer',
    glowColor: '#ffffff',
  },
  {
    id: 'matrix',
    name: 'Matrix Overclock CRT',
    minLevel: 33,
    description: 'Green phosphor cathode-ray tube terminal glow with data stream beam pulses and phosphor burn',
    className: 'effect-matrix',
    glowColor: '#22c55e',
  },
  {
    id: 'synthwave',
    name: '80s Miami Outrun Synthwave',
    minLevel: 36,
    description: 'Heavy italicized chrome reflection with Miami pink and electric cyan sunset horizon gradient',
    className: 'effect-synthwave',
    glowColor: '#ff1177',
  },
  {
    id: 'sakura',
    name: 'Imperial Kyoto Sakura Sheen',
    minLevel: 40,
    description: 'Soft blooming cherry blossom silk with pearlescent rose luster and gentle breathing blush',
    className: 'effect-sakura',
    glowColor: '#f472b6',
  },
  {
    id: 'fog',
    name: 'Spectral Phantom Mist',
    minLevel: 43,
    description: 'Haunting cursed domain mist rolling through ghost-silver typography with depth occlusion',
    className: 'effect-ghost-mist',
    glowColor: '#94a3b8',
  },
  {
    id: 'glitch',
    name: 'RGB Cyber Glitch (APK Max)',
    minLevel: 46,
    description: 'Direct APK port: real red/cyan chromatic aberration channel jitter, scanline slice, and digital character scrambler',
    className: 'effect-glitch',
    glowColor: '#ff0055',
  },
  {
    id: 'supernova',
    name: 'Cosmic God Supernova',
    minLevel: 50,
    description: 'Celestial galaxy singularity: shifting ultraviolet, solar gold, and cyan stellar plasma with stardust flare',
    className: 'effect-supernova',
    glowColor: '#ffd700',
  },
]

export function isEffectUnlocked(effectId: string, level: number): boolean {
  if (DEV_UNLOCK_ALL) return true
  const eff = TEXT_EFFECTS.find((e) => e.id === effectId)
  if (!eff) return true
  return level >= eff.minLevel
}

// ----------------------------------------------------------------------------
// Name Color & Gradient Palettes
// ----------------------------------------------------------------------------

export interface NameColorDef {
  id: string
  name: string
  minLevel: number
  colorHex: string
  cssClass: string
  description: string
  isGradient?: boolean
}

export const NAME_COLORS: NameColorDef[] = [
  { id: 'default', name: 'Default', minLevel: 1, colorHex: '#ffffff', cssClass: '', description: 'Default system text color' },
  { id: 'crimson', name: 'Crimson Monarch', minLevel: 5, colorHex: '#ef4444', cssClass: 'text-red-500 dark:text-red-400 font-bold', description: 'Fierce crimson warrior red' },
  { id: 'cyan', name: 'Cyber Cyan', minLevel: 8, colorHex: '#00f0ff', cssClass: 'text-cyan-500 dark:text-cyan-400 font-bold', description: 'Electric high-tech neon cyan' },
  { id: 'emerald', name: 'Emerald Jade', minLevel: 12, colorHex: '#10b981', cssClass: 'text-emerald-500 dark:text-emerald-400 font-bold', description: 'Verdant radiant spirit jade' },
  { id: 'amber', name: 'Solar Amber', minLevel: 15, colorHex: '#f59e0b', cssClass: 'text-amber-500 dark:text-amber-400 font-bold', description: 'Radiant celestial gold' },
  { id: 'purple', name: 'Astral Violet', minLevel: 18, colorHex: '#a855f7', cssClass: 'text-purple-500 dark:text-purple-400 font-bold', description: 'Deep ethereal mana violet' },
  { id: 'rose', name: 'Sakura Rose', minLevel: 22, colorHex: '#f43f5e', cssClass: 'text-rose-500 dark:text-rose-400 font-bold', description: 'Soft blooming cherry blossom' },
  { id: 'glacial', name: 'Glacial Sky', minLevel: 25, colorHex: '#38bdf8', cssClass: 'text-sky-500 dark:text-sky-400 font-bold', description: 'Crystalline arctic glacier' },
  { id: 'grad_cyber', name: 'Gradient: Cyberpunk', minLevel: 30, colorHex: '#00f0ff', cssClass: 'bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent font-bold', description: 'Dual-tone cyber neon blend', isGradient: true },
  { id: 'grad_blaze', name: 'Gradient: Blood Blaze', minLevel: 35, colorHex: '#ef4444', cssClass: 'bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent font-bold', description: 'Flaming embers gradient', isGradient: true },
  { id: 'grad_galaxy', name: 'Gradient: Cosmic Void', minLevel: 40, colorHex: '#a855f7', cssClass: 'bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent font-bold', description: 'Tri-color cosmic starlight', isGradient: true },
  { id: 'grad_sovereign', name: 'Gradient: Sovereign Monarch', minLevel: 50, colorHex: '#ffd700', cssClass: 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 bg-clip-text text-transparent font-black', description: 'Supreme imperial sovereign gold', isGradient: true },
]

export function isNameColorUnlocked(colorId: string, level: number): boolean {
  if (DEV_UNLOCK_ALL) return true
  const col = NAME_COLORS.find((c) => c.id === colorId)
  if (!col) return true
  return level >= col.minLevel
}

// ----------------------------------------------------------------------------
// Quests & Missions
// ----------------------------------------------------------------------------

export interface Quest {
  id: string
  type: 'daily' | 'weekly'
  title: string
  description: string
  target: number
  xpReward: number
  category: 'watch' | 'manga' | 'novel' | 'social' | 'login'
  icon: string
}

export const DAILY_QUEST_TEMPLATES: Quest[] = [
  { id: 'daily_watch', type: 'daily', title: 'Daily Screening', description: 'Watch at least 1 anime episode (80%+)', target: 1, xpReward: 25, category: 'watch', icon: '🎬' },
  { id: 'daily_manga', type: 'daily', title: 'Chapter Sprint', description: 'Read 1 complete manga chapter', target: 1, xpReward: 15, category: 'manga', icon: '📖' },
  { id: 'daily_novel', type: 'daily', title: 'Literary Voyage', description: 'Read 2 light novel chapters', target: 2, xpReward: 30, category: 'novel', icon: '📜' },
  { id: 'daily_login', type: 'daily', title: 'Hunter Check-in', description: 'Visit Zenkai today to maintain your streak', target: 1, xpReward: 20, category: 'login', icon: '🔥' },
]

export const WEEKLY_QUEST_TEMPLATES: Quest[] = [
  { id: 'weekly_watch_10', type: 'weekly', title: 'Binge Marauder', description: 'Watch 10 anime episodes throughout the week', target: 10, xpReward: 150, category: 'watch', icon: '📺' },
  { id: 'weekly_manga_10', type: 'weekly', title: 'Manga Marathon', description: 'Read 10 manga chapters', target: 10, xpReward: 100, category: 'manga', icon: '📚' },
  { id: 'weekly_novel_5', type: 'weekly', title: 'Archivist', description: 'Read 5 novel chapters', target: 5, xpReward: 75, category: 'novel', icon: '🖋️' },
  { id: 'weekly_quests_10', type: 'weekly', title: 'Mission Vanguard', description: 'Complete 10 daily quest missions', target: 10, xpReward: 200, category: 'social', icon: '⭐' },
]

// ----------------------------------------------------------------------------
// Permanent Achievements
// ----------------------------------------------------------------------------

export interface Achievement {
  id: string
  title: string
  description: string
  xpReward: number
  category: 'watch' | 'read' | 'streak' | 'rank'
  badgeIcon: string
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic'
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'ach_first_watch', title: 'First Blood', description: 'Watch your very first anime episode on Zenkai', xpReward: 50, category: 'watch', badgeIcon: '🗡️', rarity: 'Common' },
  { id: 'ach_first_manga', title: 'First Page', description: 'Complete your first manga chapter', xpReward: 50, category: 'read', badgeIcon: '📖', rarity: 'Common' },
  { id: 'ach_first_novel', title: 'Prologue Reader', description: 'Finish reading your first novel chapter', xpReward: 50, category: 'read', badgeIcon: '📜', rarity: 'Common' },
  { id: 'ach_episodes_25', title: 'Season Veteran', description: 'Complete 25 total anime episodes', xpReward: 100, category: 'watch', badgeIcon: '⚔️', rarity: 'Rare' },
  { id: 'ach_episodes_100', title: 'Centurion of Anime', description: 'Watch 100 anime episodes', xpReward: 250, category: 'watch', badgeIcon: '🛡️', rarity: 'Epic' },
  { id: 'ach_episodes_500', title: 'Immortal Otaku', description: 'Watch 500 anime episodes across all titles', xpReward: 500, category: 'watch', badgeIcon: '👑', rarity: 'Legendary' },
  { id: 'ach_manga_100', title: 'Century Reader', description: 'Read 100 manga chapters', xpReward: 250, category: 'read', badgeIcon: '📚', rarity: 'Epic' },
  { id: 'ach_streak_7', title: 'Week of Resolve', description: 'Maintain a continuous 7-day watch streak', xpReward: 100, category: 'streak', badgeIcon: '🔥', rarity: 'Rare' },
  { id: 'ach_streak_30', title: 'Iron Will', description: 'Maintain an unstoppable 30-day streak', xpReward: 500, category: 'streak', badgeIcon: '⚡', rarity: 'Legendary' },
  { id: 'ach_rank_c', title: 'C-Rank Awakening', description: 'Reach Level 10 and enter C-Rank Hunter status', xpReward: 150, category: 'rank', badgeIcon: '💎', rarity: 'Epic' },
  { id: 'ach_rank_a', title: 'A-Rank Elite', description: 'Ascend to Level 30 and claim A-Rank prestige', xpReward: 350, category: 'rank', badgeIcon: '🌟', rarity: 'Legendary' },
  { id: 'ach_rank_ss', title: 'Monarch Ascension', description: 'Break through to Level 50 and become a Shadow Sovereign', xpReward: 1000, category: 'rank', badgeIcon: '🌌', rarity: 'Mythic' },
]

// ----------------------------------------------------------------------------
// Hunter Titles Catalog
// ----------------------------------------------------------------------------

export interface HunterTitleDef {
  title: string
  minLevel: number
  description: string
  badgeIcon: string
}

export const HUNTER_TITLES: HunterTitleDef[] = [
  { title: 'Otaku', minLevel: 1, description: 'Awakened with latent energy.', badgeIcon: '🗡️' },
  { title: 'Dungeon Scout', minLevel: 5, description: 'Cleared low-level dungeon anomalies.', badgeIcon: '⚡' },
  { title: 'Gate Raider', minLevel: 10, description: 'Seasoned battlefield operative.', badgeIcon: '⚔️' },
  { title: 'Anime Veteran', minLevel: 15, description: 'Watched dozens of worlds unfold.', badgeIcon: '📺' },
  { title: 'Elite Vanguard', minLevel: 20, description: 'Strike squad commander status.', badgeIcon: '🔮' },
  { title: 'Manga Connoisseur', minLevel: 25, description: 'Devourer of scrolls and pages.', badgeIcon: '📖' },
  { title: 'Red Gate Survivor', minLevel: 30, description: 'Soloed dangerous closed dimension gates.', badgeIcon: '🔥' },
  { title: 'Supreme Raid Master', minLevel: 40, description: 'Living national-level calamity.', badgeIcon: '👑' },
  { title: 'Shadow Monarch', minLevel: 50, description: 'Ruler of the Shadow Realm and Sovereign of Souls.', badgeIcon: '🌌' },
]

export function isTitleUnlocked(title: string, level: number): boolean {
  if (DEV_UNLOCK_ALL) return true
  const item = HUNTER_TITLES.find((t) => t.title.toLowerCase() === title.toLowerCase())
  if (!item) return true
  return level >= item.minLevel
}
