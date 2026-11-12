import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowUpRight, Bug, Check, Copy, Heart, Play, Server, Share2, ShieldCheck, Smartphone, Sparkles, Wallet, Wifi } from 'lucide-react'
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

const COINS = [
  { id: 'btc', name: 'Bitcoin', ticker: 'BTCB', network: 'BNB Smart Chain (BEP20)', note: 'Send BTCB on BSC. Contract ends in ead9c. Native Bitcoin will not arrive.' },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', network: 'Ethereum (ERC20)', note: 'Send ETH on the Ethereum mainnet only.' },
  { id: 'usdt', name: 'Tether', ticker: 'USDT', network: 'BNB Smart Chain (BEP20)', note: 'Send USDT on BSC. Contract ends in 97955.' },
]

const STEPS = [
  { n: '01', t: 'Pick coin & network', d: 'Choose BTC, ETH, or USDT and double-check network' },
  { n: '02', t: 'Copy address or QR', d: 'Scan the QR code with your wallet or copy the address' },
  { n: '03', t: 'Send any amount', d: 'Every bit directly powers our servers and proxies' },
]

const GOES = [
  { icon: Server, t: 'Servers & bandwidth', d: 'High-speed CDN nodes and master streams' },
  { icon: Wifi, t: 'Proxies & uptime', d: 'Zero-proxy mirrors and instant stream unblocking' },
  { icon: Smartphone, t: 'Android app updates', d: 'Continuous bug fixes, APK releases and features' },
  { icon: Sparkles, t: 'New features', d: '4K MovieBox, manga readers, subtitles and sync' },
]

const FREE: { icon: React.ReactNode; t: string; d: string; run?: () => void; href?: string }[] = [
  { icon: <Share2 className="size-4" />, t: 'Share Zenkai', d: 'Send it to a friend or group', run: () => shareLink(window.location.origin, 'Zenkai') },
  { icon: <DiscordIcon className="size-4" />, t: 'Join Discord', d: 'Voice chats, community & support', href: DISCORD_URL },
  { icon: <TelegramIcon className="size-4" />, t: 'Join Telegram', d: 'Instant updates & releases', href: TELEGRAM_URL },
  { icon: <Bug className="size-4" />, t: 'Report a bug', d: 'Help us fix issues and broken links', href: ISSUES_URL },
]

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.4 } }

export default function SupportPage() {
  const [selectedCoin, setSelectedCoin] = useState<string>('btc')
  const [copied, setCopied] = useState(false)

  const activeCoin = COINS.find((c) => c.id === selectedCoin) || COINS[0]

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(ADDRESS)
      setCopied(true)
      toast(`${activeCoin.ticker} address copied`, 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Copy failed. Select the address manually.', 'error')
    }
  }

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      {/* Ambient decorative glow */}
      <div className="pointer-events-none absolute -top-12 left-1/2 h-72 w-96 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />

      {/* Hero Header */}
      <motion.header initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="relative text-center">
        <motion.span
          animate={{ scale: [1, 1.15, 1, 1.15, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.8 }}
          className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-lg shadow-accent/20"
        >
          <Heart className="size-6 fill-current" />
        </motion.span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Fund Zenkai
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Zenkai is 100% free with zero paywalls. Donations pay directly for high-speed servers, proxies, and ongoing development.
        </p>
      </motion.header>

      {/* Main 2-Column Desktop Layout */}
      <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
        
        {/* Left Column: Crypto Donation Card & Steps (7 Cols on desktop) */}
        <div className="space-y-6 lg:col-span-7">
          
          {/* Interactive Crypto Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.45 }} className="rounded-3xl border border-border/80 bg-card/70 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
            <div className="flex items-center justify-between border-b border-border/60 pb-5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
                  <Wallet className="size-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold sm:text-lg">Crypto Transfer</h2>
                  <p className="text-xs text-muted">Instant & secure EVM address</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="size-3.5" /> Direct to Wallets
              </span>
            </div>

            {/* Coin Picker Tabs */}
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {COINS.map((c) => {
                const isSelected = c.id === selectedCoin
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCoin(c.id)}
                    className={cn(
                      'group relative flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center transition-all sm:flex-row sm:items-center sm:text-left',
                      isSelected
                        ? 'border-accent bg-accent/10 shadow-md shadow-accent/10 ring-1 ring-accent/30'
                        : 'border-border/60 bg-white/[0.02] hover:border-border hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="size-8 shrink-0 transition-transform group-hover:scale-105">
                      <svg viewBox="0 0 32 32" className="size-full">
                        {ICONS[c.id]}
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold leading-tight sm:text-sm text-foreground">
                        {c.name}
                      </span>
                      <span className="block text-[11px] font-semibold text-muted">
                        {c.ticker}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Active Coin QR & Address View */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-black/30 p-5 sm:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCoin.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-6 sm:flex-row sm:items-start"
                >
                  {/* QR Code Container */}
                  <div className="relative shrink-0 rounded-2xl bg-white p-3 shadow-xl">
                    <QRCodeSVG value={ADDRESS} size={138} level="M" />
                  </div>

                  {/* Coin Info & Copy */}
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span className="font-display text-base font-bold text-foreground">
                        {activeCoin.name} ({activeCoin.ticker})
                      </span>
                      <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                        {activeCoin.network}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      {activeCoin.note}
                    </p>

                    {/* Address Field */}
                    <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-black/50 p-2 sm:p-2.5">
                      <code className="min-w-0 flex-1 select-all break-all font-mono text-[11px] leading-snug sm:text-xs text-foreground/90">
                        {ADDRESS}
                      </code>
                      <button
                        type="button"
                        onClick={copyAddress}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-95',
                          copied
                            ? 'bg-emerald-500 text-white'
                            : 'bg-accent text-accent-fg hover:bg-accent/90 shadow-md shadow-accent/20'
                        )}
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] text-amber-400/80">
                      ⚠ Double-check the network before sending. Crypto transfers cannot be reversed.
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* 3 Step Instruction Guide */}
          <motion.div {...fade} className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                <span className="font-display text-2xl font-black text-accent">{s.n}</span>
                <h3 className="mt-2 text-sm font-bold text-foreground">{s.t}</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">{s.d}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Column: Where It Goes & Free Ways to Help (5 Cols on desktop) */}
        <div className="space-y-6 lg:col-span-5">
          
          {/* Where It Goes Card */}
          <motion.section {...fade} className="rounded-3xl border border-border/80 bg-card/70 p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
            <h2 className="font-display text-base font-extrabold tracking-tight sm:text-lg">
              Where Your Support Goes
            </h2>
            <p className="mt-1 text-xs text-muted">
              Everything donated directly covers infrastructure and maintenance:
            </p>

            <ul className="mt-5 space-y-3.5">
              {GOES.map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex items-start gap-3 rounded-xl border border-border/40 bg-white/[0.02] p-3 transition hover:border-border">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold sm:text-sm text-foreground">{t}</span>
                    <span className="block text-[11px] text-muted sm:text-xs leading-snug">{d}</span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.section>

          {/* Free Ways to Support Card */}
          <motion.section {...fade} className="rounded-3xl border border-border/80 bg-card/70 p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
            <h2 className="font-display text-base font-extrabold tracking-tight sm:text-lg">
              No Funds? Support for $0
            </h2>
            <p className="mt-1 text-xs text-muted">
              Watching a short ad opens in a new tab and generates revenue that keeps Zenkai servers online.
            </p>

            <ShimmerButton
              className="mt-4 w-full justify-center py-2.5 text-sm"
              icon={<Play className="size-4 fill-current" />}
              onClick={() => {
                openAd()
                toast('Thank you for supporting Zenkai ❤', 'success')
              }}
            >
              Watch a Short Ad
            </ShimmerButton>

            <div className="mt-6 border-t border-border/60 pt-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted">
                Join our communities & share
              </span>
              <ul className="mt-3 divide-y divide-border/40">
                {FREE.map((f) => {
                  const body = (
                    <>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.06] text-foreground">
                        {f.icon}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-xs font-bold sm:text-sm text-foreground">{f.t}</span>
                        <span className="block text-[11px] text-muted">{f.d}</span>
                      </span>
                      <ArrowUpRight className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </>
                  )
                  const cls = 'group flex w-full items-center gap-3 py-2.5 transition active:scale-[0.99] hover:bg-white/[0.03] rounded-xl px-2'
                  return (
                    <li key={f.t}>
                      {f.href ? (
                        <a href={f.href} target="_blank" rel="noreferrer noopener" className={cls}>
                          {body}
                        </a>
                      ) : (
                        <button type="button" onClick={f.run} className={cls}>
                          {body}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </motion.section>

          {/* Footer note */}
          <motion.p {...fade} className="text-center text-xs text-muted">
            Thank you for being part of Zenkai. <Heart className="inline size-3.5 fill-accent text-accent" />
          </motion.p>
        </div>
      </div>
    </main>
  )
}
