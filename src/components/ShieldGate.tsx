import { AnimatePresence, motion } from 'framer-motion'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { submitCaptcha, useShield } from '../lib/shield'
import { cn } from '../lib/utils'
import { BorderBeam } from './BorderBeam'
import { DotPattern } from './DotPattern'
import { ShinyText } from './ShinyText'

function Card({ icon, title, tone = 'accent', children }: { icon: ReactNode; title: string; tone?: 'accent' | 'danger'; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-2xl shadow-black/40"
    >
      <BorderBeam />
      <div className="relative mx-auto mb-5 grid size-[4.5rem] place-items-center">
        <motion.span
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 12, ease: 'linear', repeat: Infinity }}
          className={cn('absolute -inset-2 rounded-full border-2 border-dashed', tone === 'danger' ? 'border-red-500/40' : 'border-accent/40')}
        />
        <span className={cn('grid size-full place-items-center rounded-full shadow-lg', tone === 'danger' ? 'bg-red-500/15 text-red-500' : 'bg-accent text-accent-fg shadow-[0_0_32px_var(--glow)]')}>
          {icon}
        </span>
      </div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
      {children}
    </motion.div>
  )
}

function Backdrop({ children, z }: { children: ReactNode; z: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ zIndex: z }}
      className="fixed inset-0 grid place-items-center bg-background/85 p-5 backdrop-blur-2xl"
    >
      <DotPattern className="[mask-image:radial-gradient(600px_circle_at_center,white,transparent)]" />
      {children}
    </motion.div>
  )
}

function CaptchaForm({ svg, error }: { svg: string; error: boolean }) {
  const [text, setText] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) submitCaptcha(text)
  }
  return (
    <>
      <p className="mt-1.5 text-sm">
        <ShinyText>Quick check: type the characters you see.</ShinyText>
      </p>
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="Captcha" width={180} height={60} className="mx-auto mt-5 rounded-xl border border-border" />
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value.toUpperCase())}
          maxLength={5}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Captcha text"
          className="min-w-0 flex-1 rounded-xl border border-border bg-card-2 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] outline-none focus:border-accent"
        />
        <button type="submit" className="rounded-xl bg-accent px-5 text-sm font-bold text-accent-fg transition-transform active:scale-95">
          Verify
        </button>
      </form>
      {error && <p className="mt-3 text-xs font-bold text-red-500">That didn't match. Here's a new one.</p>}
    </>
  )
}

/** Mounted once in App. Renders nothing until DevTools / a bot is detected, or the server asks for a captcha. */
export function ShieldGate() {
  const { devtools, bot, captcha } = useShield()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  // DevTools open: send them to the roast page (it sends them back once they close); it remembers where they were.
  useEffect(() => {
    if (devtools && !bot && pathname !== '/busted') navigate('/busted', { state: { from: pathname + search } })
  }, [devtools, bot, pathname, search, navigate])

  return (
    <AnimatePresence>
      {bot ? (
        <Backdrop key="bot" z={400}>
          <Card icon={<ShieldAlert className="size-8" />} title="Automated Access Denied" tone="danger">
            <p className="mt-2 text-sm leading-relaxed text-muted">Headless bots and scrapers can't use Zenkai.</p>
          </Card>
        </Backdrop>
      ) : captcha ? (
        <Backdrop key="captcha" z={200}>
          <Card icon={<ShieldCheck className="size-8" />} title="Zenkai Shield">
            <CaptchaForm svg={captcha.svg} error={captcha.error} />
          </Card>
        </Backdrop>
      ) : null}
    </AnimatePresence>
  )
}
