/**
 * Small UI sounds made with the Web Audio API (no audio files to ship):
 * mic on / off, someone joined / left, call ringtone and ringback.
 * Browsers only allow audio after the person has interacted with the page; until then calls are silently skipped.
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.55
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

// Unlock audio on the first tap / key so later sounds (a ringing call) are allowed to play
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

/** One soft bell-like note: sine + a quiet octave overtone, fast attack, smooth fade. */
function note(freq: number, at: number, dur = 0.28, vol = 0.22, type: OscillatorType = 'sine') {
  const c = audio()
  if (!c || !master) return
  const t0 = c.currentTime + at
  for (const [mult, v] of [[1, vol], [2, vol * 0.18]] as const) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq * mult
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g)
    g.connect(master)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }
}

// Note frequencies (Hz)
const E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5, E6 = 1318.5
const A4 = 440

/** Microphone switched on: two quick rising notes. */
export const playMicOn = () => {
  note(G5, 0, 0.16, 0.2)
  note(C6, 0.09, 0.26, 0.22)
}
/** Microphone switched off: two falling notes. */
export const playMicOff = () => {
  note(C6, 0, 0.16, 0.18)
  note(G5, 0.09, 0.26, 0.18)
}
/** Someone joined: warm rising triad. */
export const playJoin = () => {
  note(E5, 0, 0.22, 0.2)
  note(G5, 0.11, 0.22, 0.2)
  note(B5, 0.22, 0.4, 0.2)
}
/** Someone left: soft falling pair. */
export const playLeave = () => {
  note(B5, 0, 0.2, 0.17)
  note(E5, 0.13, 0.4, 0.17)
}
/** Call connected / ended. */
export const playConnected = () => {
  note(E5, 0, 0.18, 0.2)
  note(A5, 0.1, 0.18, 0.2)
  note(E6, 0.2, 0.4, 0.18)
}
export const playHangup = () => {
  note(A5, 0, 0.18, 0.17)
  note(E5, 0.12, 0.18, 0.17)
  note(A4, 0.24, 0.45, 0.17)
}

let ringTimer: number | null = null
let ringKind: 'incoming' | 'outgoing' | null = null

function ringOnce(kind: 'incoming' | 'outgoing') {
  if (kind === 'incoming') {
    // cheerful little melody, repeated
    ;[E5, G5, B5, G5, C6, B5, G5, E5].forEach((f, i) => note(f, i * 0.16, 0.34, 0.2, 'triangle'))
  } else {
    // calm double blip while waiting for the other side
    note(A4, 0, 0.35, 0.13)
    note(E5, 0.0, 0.35, 0.09)
    note(A4, 0.5, 0.35, 0.13)
    note(E5, 0.5, 0.35, 0.09)
  }
}

/** Loop the ringtone (incoming call) or ringback (we are calling) until stopRinging(). */
export function startRinging(kind: 'incoming' | 'outgoing') {
  if (ringKind === kind) return
  stopRinging()
  ringKind = kind
  ringOnce(kind)
  ringTimer = window.setInterval(() => ringOnce(kind), kind === 'incoming' ? 2400 : 3200)
}

export function stopRinging() {
  if (ringTimer !== null) window.clearInterval(ringTimer)
  ringTimer = null
  ringKind = null
}

