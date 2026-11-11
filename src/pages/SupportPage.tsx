import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, Heart, Play, QrCode, ShieldCheck } from 'lucide-react'
import { openAd } from '../lib/ads'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { BorderBeam } from '../components/BorderBeam'
import { ShimmerButton } from '../components/ShimmerButton'
import { SpotlightCard } from '../components/SpotlightCard'

const ADDRESS = '0x11bbc61685f5c462cad77acb5098d87ff39dc9c0'

// BTC here is BTCB (BEP20): the address is an EVM address, so it only receives tokens on EVM chains.
const COINS = [
  { id: 'btc', name: 'Bitcoin', ticker: 'BTCB', network: 'BNB Smart Chain (BEP20)', color: '#f7931a', note: 'Send BTCB on BSC. Contract ends in ead9c. Native Bitcoin will not arrive.' },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', network: 'Ethereum (ERC20)', color: '#627eea', note: 'Send ETH on the Ethereum mainnet only.' },
  { id: 'usdt', name: 'Tether', ticker: 'USDT', network: 'BNB Smart Chain (BEP20)', color: '#26a17b', note: 'Send USDT on BSC. Contract ends in 97955.' },
]

function Coin({ c, i }: { c: (typeof COINS)[number]; i: number }) {
  const [qr, setQr] = useState(false)
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ADDRESS)
      setDone(true)
      toast(`${c.ticker} address copied`, 'success')
      setTimeout(() => setDone(false), 1800)
    } catch {
      toast('Copy failed. Select the address manually.', 'error')
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 220, damping: 24, delay: i * 0.08 }}
      whileHover={{ y: -4 }}
    >
      <SpotlightCard className="rounded-3xl bg-card/60 p-5 backdrop-blur">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-25 blur-3xl" style={{ background: c.color }} />
        {qr && <BorderBeam color={c.color} size={120} duration={6} />}
        <div className="relative flex items-center gap-3">
          <motion.span whileHover={{ rotate: -8, scale: 1.08 }} className="grid size-11 place-items-center rounded-2xl text-sm font-extrabold text-white shadow-lg" style={{ background: c.color, boxShadow: `0 8px 24px ${c.color}55` }}>
            {c.ticker[0]}
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight">{c.name}</p>
            <p className="truncate text-xs text-muted">{c.ticker} · {c.network}</p>
          </div>
          <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={() => setQr((v) => !v)} aria-pressed={qr} aria-label="Toggle QR code" className={cn('grid size-10 place-items-center rounded-full border border-border transition-colors', qr ? 'bg-foreground text-background' : 'hover:bg-foreground/[0.06]')}>
            <QrCode className="size-4" />
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {qr && (
            <motion.div key="qr" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="relative overflow-hidden">
              <motion.div initial={{ scale: 0.8, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }} className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 shadow-xl" style={{ boxShadow: `0 12px 40px ${c.color}44` }}>
                <QRCodeSVG value={ADDRESS} size={168} level="M" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={copy} className="relative mt-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04]">
          <code className="min-w-0 flex-1 break-all font-mono text-[12px] leading-snug">{ADDRESS}</code>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={done ? 'ok' : 'cp'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }} className="shrink-0">
              {done ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4 text-muted" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <p className="relative mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-muted">
          <ShieldCheck className="mt-px size-3.5 shrink-0" /> {c.note}
        </p>
      </SpotlightCard>
    </motion.div>
  )
}

export default function SupportPage() {
  return (
    <main className="relative mx-auto w-full max-w-3xl px-4 pb-28 pt-10 sm:px-6 md:pb-16">
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
        <motion.span
          animate={{ scale: [1, 1.12, 1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
          className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent text-accent-fg shadow-[0_0_40px_var(--glow)]"
        >
          <Heart className="size-7 fill-current" />
        </motion.span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Fund Zenkai</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Zenkai is free and ad-light. Donations pay for servers and let us keep building. Every bit helps.
        </p>
      </motion.header>

      <div className="mt-8 grid gap-4">
        {COINS.map((c, i) => (
          <Coin key={c.id} c={c} i={i} />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">Double-check the network before sending. Crypto transfers can't be reversed.</p>

      <motion.section initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 200, damping: 24 }} className="relative mt-10 overflow-hidden rounded-3xl border border-border bg-card/60 p-6 text-center backdrop-blur">
        <BorderBeam size={140} duration={9} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">No funds? No worries</p>
        <h2 className="mt-1.5 font-display text-xl font-extrabold tracking-tight">Watch an ad instead</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          A short ad takes a few seconds and supports us just as much. Opens in a new tab, totally optional.
        </p>
        <ShimmerButton className="mt-5 !bg-accent !text-accent-fg shadow-accent/30" icon={<Play className="size-4 fill-current" />} onClick={() => (openAd(), toast('Thank you for supporting Zenkai ❤', 'success'))}>
          Watch ad
        </ShimmerButton>
      </motion.section>
    </main>
  )
}
