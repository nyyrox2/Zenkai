/** Support / ads: every ad opens only after a tap on "Watch ad". The popup is capped by a long gap and by real browsing activity. */
export const AD_URL = 'https://uplcm.com/4/12242319'

const LAST = 'zk:ad:last'
const GAP = 15 * 60_000 // min time between popups (also after any ad the user opened)
const SNOOZE = 30 * 60_000 // "Maybe later" waits twice as long
const GRACE = 2 * 60_000 // never in the first 2 minutes of a visit
const MIN_VIEWS = 3 // page changes seen before a popup can show
const CHANCE = 0.35 // per eligible page change, so it feels random

const start = Date.now()
let views = 0

const read = () => {
  try {
    return Number(localStorage.getItem(LAST) || 0)
  } catch {
    return 0
  }
}
const write = (t: number) => {
  try {
    localStorage.setItem(LAST, String(t))
  } catch {}
}

export function openAd() {
  write(Date.now())
  window.open(AD_URL, '_blank', 'noopener,noreferrer')
}

/** Call on every browsing page change; true when a popup may show now. */
export function shouldShowPopup(): boolean {
  views++
  return views >= MIN_VIEWS && Date.now() - start > GRACE && Date.now() - read() >= GAP && Math.random() < CHANCE
}

export const popupShown = () => write(Date.now())
export const popupSnoozed = () => write(Date.now() + SNOOZE - GAP)
