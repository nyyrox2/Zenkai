import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowUpRight, Bug, Check, ChevronDown, Copy, Heart, Play, Server, Share2, Smartphone, Sparkles, Wifi } from 'lucide-react'
import { openAd } from '../lib/ads'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { ShimmerButton } from '../components/ShimmerButton'
import { DiscordIcon, TelegramIcon } from '../components/BrandIcons'
import { DISCORD_URL, ISSUES_URL, TELEGRAM_URL } from '../lib/app'
import { shareLink } from '../lib/share'

const ADDRESS = '0x11bbc61685f5c462cad77acb5098d87ff39dc9c0'

const ICONS: Record<string, React.ReactNode> = {
  btc: (
    <>
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path fill="#fff" d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.689 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z" />
    </>
  ),
  eth: (
    <>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <g fill="#fff">
        <path fillOpacity=".6" d="M16.498 4v8.87l7.497 3.35z" />
        <path d="M16.498 4L9 16.22l7.498-3.35z" />
        <path fillOpacity=".6" d="M16.498 21.968v6.027L24 17.616z" />
        <path d="M16.498 27.995v-6.028L9 17.616z" />
        <path fillOpacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
        <path fillOpacity=".6" d="M9 16.22l7.498 4.353v-7.701z" />
      </g>
    </>
  ),
  usdt: (
    <>
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path fill="#fff" d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117" />
    </>
  ),
}

// BTC here is BTCB (BEP20): the address is an EVM address, so it only receives tokens on EVM chains.
const COINS = [
  { id: 'btc', name: 'Bitcoin', ticker: 'BTCB', network: 'BNB Smart Chain (BEP20)', note: 'Send BTCB on BSC. Contract ends in ead9c. Native Bitcoin will not arrive.' },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', network: 'Ethereum (ERC20)', note: 'Send ETH on the Ethereum mainnet only.' },
  { id: 'usdt', name: 'Tether', ticker: 'USDT', network: 'BNB Smart Chain (BEP20)', note: 'Send USDT on BSC. Contract ends in 97955.' },
]

const STEPS = ['Pick a coin and its network', 'Copy the address or scan the QR', 'Send. Every bit helps']
const GOES = [
  { icon: Server, t: 'Servers & bandwidth', d: 'Keeping streams fast and online' },
  { icon: Wifi, t: 'Proxies & uptime', d: 'Fewer dead links, quicker fixes' },
  { icon: Smartphone, t: 'Android app', d: 'Updates and new releases' },
  { icon: Sparkles, t: 'New features', d: 'More of what you ask for' },
]
const FREE: { icon: React.ReactNode; t: string; d: string; run?: () => void; href?: string }[] = [
  { icon: <Share2 className="size-4" />, t: 'Share Zenkai', d: 'Send it to a friend', run: () => shareLink(window.location.origin, 'Zenkai') },
  { icon: <DiscordIcon className="size-4" />, t: 'Join Discord', d: 'Hang out, give feedback', href: DISCORD_URL },
  { icon: <TelegramIcon className="size-4" />, t: 'Join Telegram', d: 'Updates and announcements', href: TELEGRAM_URL },
  { icon: <Bug className="size-4" />, t: 'Report a bug', d: 'Help us fix things faster', href: ISSUES_URL },
]
const fade = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.45 } }

function Row({ c, open, onToggle }: { c: (typeof COINS)[number]; open: boolean; onToggle: () => void }) {
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
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="group flex w-full items-center gap-4 py-4 text-left">
        <motion.svg viewBox="0 0 32 32" className="size-10 shrink-0" whileHover={{ rotate: 12, scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          {ICONS[c.id]}
        </motion.svg>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold leading-tight">{c.name}</span>
          <span className="block truncate text-xs text-muted">{c.ticker} · {c.network}</span>
        </span>
        <ChevronDown className={cn('size-4 text-muted transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="overflow-hidden">
            <div className="flex flex-col items-center gap-5 pb-6 pl-0 sm:flex-row sm:pl-14">
              <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="shrink-0 rounded-xl bg-white p-2.5">
                <QRCodeSVG value={ADDRESS} size={132} level="M" />
              </motion.div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <code className="block break-all font-mono text-[12px] leading-snug">{ADDRESS}</code>
                <button type="button" onClick={copy} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-accent transition active:scale-95">
                  {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? 'Copied' : 'Copy address'}
                </button>
                <p className="mt-2 text-[11px] leading-snug text-muted">{c.note}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export default function SupportPage() {
  const [open, setOpen] = useState<string | null>('btc')
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-28 pt-12 md:pb-16">
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <motion.span animate={{ scale: [1, 1.15, 1, 1.15, 1] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.6 }} className="inline-block text-accent">
          <Heart className="size-7 fill-current" />
        </motion.span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Fund Zenkai</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">Zenkai is free. Donations pay for the servers and keep it that way.</p>
      </motion.header>

      <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-8 divide-y divide-border border-y border-border">
        {COINS.map((c) => (
          <Row key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />
        ))}
      </motion.ul>
      <p className="mt-3 text-[11px] text-muted">Double-check the network before sending. Crypto transfers can't be reversed.</p>

      <motion.ol {...fade} className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((t, i) => (
          <li key={t} className="flex items-start gap-3 sm:block">
            <span className="font-display text-2xl font-extrabold leading-none text-accent">0{i + 1}</span>
            <span className="block text-sm text-muted sm:mt-2">{t}</span>
          </li>
        ))}
      </motion.ol>

      <motion.section {...fade} className="mt-14">
        <h2 className="font-display text-lg font-extrabold tracking-tight">Where it goes</h2>
        <ul className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {GOES.map(({ icon: Icon, t, d }) => (
            <li key={t} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="block text-xs text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.section {...fade} className="mt-14">
        <h2 className="font-display text-lg font-extrabold tracking-tight">No funds? No worries.</h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">Watch a short ad. It opens in a new tab and helps just as much.</p>
        <ShimmerButton className="mt-4" icon={<Play className="size-4 fill-current" />} onClick={() => (openAd(), toast('Thank you for supporting Zenkai ❤', 'success'))}>
          Watch ad
        </ShimmerButton>
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {FREE.map((f) => {
            const body = (
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/[0.06]">{f.icon}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold">{f.t}</span>
                  <span className="block text-xs text-muted">{f.d}</span>
                </span>
                <ArrowUpRight className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </>
            )
            const cls = 'group flex w-full items-center gap-3 py-3.5 transition active:scale-[0.99]'
            return (
              <li key={f.t}>
                {f.href ? <a href={f.href} target="_blank" rel="noreferrer noopener" className={cls}>{body}</a> : <button type="button" onClick={f.run} className={cls}>{body}</button>}
              </li>
            )
          })}
        </ul>
      </motion.section>

      <motion.p {...fade} className="mt-14 text-center text-sm text-muted">
        Thank you for being here. <Heart className="inline size-3.5 fill-accent text-accent" />
      </motion.p>
    </main>
  )
}
