import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Shield,
  Zap,
  Lock,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  Layers,
  CircleHelp,
  Smartphone,
  RefreshCw,
} from 'lucide-react'
import { useCompanion, LATEST_EXTENSION_VERSION } from '../lib/useCompanion'
import {
  HELPER_APK_DOWNLOAD_URL,
  HELPER_BASE_URL,
  getCustomHelperUrl,
  launchHelperApp,
  probeHelperApk,
  setCustomHelperUrl,
} from '../lib/helperClient'
import { toast } from '../lib/toast'

export default function ExtensionPage() {
  const companion = useCompanion()
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [lanInput, setLanInput] = useState(() => getCustomHelperUrl() || '')

  const copyExtensionsUrl = () => {
    navigator.clipboard.writeText('chrome://extensions')
    setCopied(true)
    toast('Copied "chrome://extensions" to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const checkHelperNow = async () => {
    setChecking(true)
    const ok = await probeHelperApk(true)
    setChecking(false)
    toast(
      ok
        ? 'Zenkai Helper APK connected!'
        : 'Helper APK not reachable on 127.0.0.1:48912. Open Zenkai Helper and start server.',
      ok ? 'success' : 'info',
    )
  }

  return (
    <div className="relative min-h-screen bg-[#08090d] text-foreground">
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/4 -z-10 h-[400px] w-[500px] rounded-full bg-emerald-500/10 blur-[130px]" />

      <main className="mx-auto max-w-4xl px-4 pb-28 pt-24 sm:px-6 sm:pt-28">
        <Link
          to="/movies"
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Movies &amp; TV
        </Link>

        {/* Hero */}
        <div className="text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-black/40 ring-1 ring-white/10 shadow-xl">
            <img src="/logo.png" alt="Zenkai" className="size-12 object-contain drop-shadow" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-bold text-accent">
            <Sparkles className="size-3.5" /> Local Helper APK + Extension Bridge
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Zenkai Stream Bridge
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Stream MovieBox, HDHub4u, MoviesDrive, Bollyflix, RogMovies, and direct anime servers on Android &amp; Desktop without Cloudflare IP blocks or proxy buffering. Use the standalone <strong>Zenkai Helper APK</strong> on Android browsers, or the Manifest V3 Extension on Desktop.
          </p>

          {/* Live status banner */}
          <div className="mx-auto mt-8 max-w-lg">
            {companion.apkConnected ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left shadow-lg shadow-emerald-950/20">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-400">
                    Zenkai Helper APK Connected (v{companion.apkVersion || '1.0.3'})
                  </h3>
                  <p className="text-xs text-emerald-300/80">
                    Bridge active at <code className="font-mono">{companion.helperUrl || HELPER_BASE_URL}</code>
                    {companion.lanUrl ? (
                      <> · Wi-Fi LAN: <code className="font-mono">{companion.lanUrl}</code></>
                    ) : null}
                    . MovieBox, HDHub4u, MoviesDrive, Bollyflix &amp; RogMovies are live!
                  </p>
                </div>
              </div>
            ) : companion.installed ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left shadow-lg shadow-emerald-950/20">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-400">Browser Extension Active (v{companion.version || LATEST_EXTENSION_VERSION})</h3>
                  <p className="text-xs text-emerald-300/80">
                    Direct residential CDN connection operational. Install Zenkai Helper APK on Android for full local HDHub4u, MoviesDrive, Bollyflix &amp; MovieBox token fetching.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left shadow-lg shadow-black/40">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent">
                  <AlertCircle className="size-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">No Local Bridge Connected</h3>
                  <p className="text-xs text-muted">
                    Download and launch <strong>Zenkai Helper APK</strong> on Android (works in Chrome/Brave — no Kiwi needed) or load the Desktop Extension below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Primary Helper APK Controls */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={HELPER_APK_DOWNLOAD_URL}
              download="ZenkaiHelper.apk"
              className="inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-accent-fg shadow-xl shadow-accent/25 transition hover:brightness-110 active:scale-95"
            >
              <Smartphone className="size-4" /> Download Helper APK
            </a>
            <button
              type="button"
              onClick={() => launchHelperApp()}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-5 py-3.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95"
            >
              <Zap className="size-4" /> Launch Helper App
            </button>
            <button
              type="button"
              onClick={() => void checkHelperNow()}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-3.5 text-xs font-semibold text-muted backdrop-blur transition hover:text-foreground active:scale-95"
            >
              <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking…' : 'Test 127.0.0.1:48912'}
            </button>
          </div>
          <span className="mt-2.5 block text-[11px] text-muted">
            Zenkai Helper APK v1.0.3 · Runs on Android 8+ · Localhost &amp; Same-Wi-Fi LAN bridge on port 48912
          </span>

          {/* Same Wi-Fi / LAN Pairing for PC, Laptop, Smart TV or 2nd Phone */}
          <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Use Over Same Wi-Fi (PC / TV / Another Phone)
            </h3>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              1) Open <strong>Zenkai Helper APK</strong> on your Android phone and copy its exact <strong>Wi-Fi URL</strong>.<br/>
              2) On your PC / TV / second phone on the <strong>same Wi-Fi</strong>, open <code className="font-mono text-emerald-300">http://&lt;phone-wifi-ip&gt;:48912</code> directly in your browser and tap <strong>Open Zenkai Movies</strong> (zero HTTPS blocks), or paste the exact Wi-Fi URL below.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={lanInput}
                onChange={(e) => setLanInput(e.target.value)}
                placeholder="Paste exact Wi-Fi URL from Helper app (e.g. http://<phone-ip>:48912)"
                className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  const saved = setCustomHelperUrl(lanInput)
                  if (!saved && lanInput.trim()) {
                    toast('Enter the exact Wi-Fi URL shown in your Helper app', 'error')
                    return
                  }
                  setChecking(true)
                  const ok = await probeHelperApk(true)
                  setChecking(false)
                  toast(
                    ok ? `Connected to Helper at ${saved || HELPER_BASE_URL}!` : 'Could not reach Helper over HTTPS. Open the Wi-Fi URL directly in your browser (http://<phone-ip>:48912/movies) or allow Insecure Content in Site Settings.',
                    ok ? 'success' : 'info',
                  )
                }}
                className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition active:scale-95"
              >
                Connect
              </button>
              {lanInput && (
                <button
                  type="button"
                  onClick={() => {
                    setLanInput('')
                    setCustomHelperUrl(null)
                    toast('Cleared custom Wi-Fi URL (using localhost)', 'info')
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 transition hover:text-white"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Android Helper Steps */}
        <div className="mt-14">
          <h2 className="text-center font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Android Browser Setup (No Extension Needed)
          </h2>
          <p className="mt-1 text-center text-xs text-muted">
            Works in Chrome, Brave, Samsung Internet &amp; Edge on Android.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="relative rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
              <span className="inline-block text-xs font-black uppercase tracking-wider text-accent">Step 01</span>
              <h3 className="mt-2 text-base font-bold text-foreground">Install Helper APK</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Tap <strong>Download Helper APK</strong> above and install <code className="rounded bg-white/10 px-1 py-0.5 text-accent">ZenkaiHelper.apk</code> on your Android device.
              </p>
            </div>

            <div className="relative rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
              <span className="inline-block text-xs font-black uppercase tracking-wider text-accent">Step 02</span>
              <h3 className="mt-2 text-base font-bold text-foreground">Start Local Bridge</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Open <strong>Zenkai Helper</strong> (or tap Launch Helper App) so the notification confirms <code className="rounded bg-white/10 px-1 py-0.5 text-emerald-400">127.0.0.1:48912</code> is running.
              </p>
            </div>

            <div className="relative rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
              <span className="inline-block text-xs font-black uppercase tracking-wider text-accent">Step 03</span>
              <h3 className="mt-2 text-base font-bold text-foreground">Play Any Server</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Return here — Zenkai Web auto-detects the Helper APK and routes MovieBox, HDHub4u, MoviesDrive, Bollyflix &amp; RogMovies straight through your phone!
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Extension Fallback */}
        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Desktop Chrome / Brave Extension</h2>
              <p className="mt-1 text-xs text-muted">
                On Windows/Mac/Linux desktop browsers, load the Manifest V3 zip in <code className="text-accent">chrome://extensions</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="/zenkai-companion.zip"
                download="zenkai-companion.zip"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
              >
                <Download className="size-3.5" /> Extension (.ZIP) v{LATEST_EXTENSION_VERSION}
              </a>
              <button
                onClick={copyExtensionsUrl}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-semibold text-muted transition hover:text-foreground"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                Copy chrome://extensions
              </button>
              <Link to="/extension/how-to" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-semibold text-muted transition hover:text-foreground">
                <CircleHelp className="size-3.5" /> Guide
              </Link>
            </div>
          </div>
        </div>

        {/* Technical Highlights */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Zap className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Direct Phone Resolution</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Bootstraps MovieBox auth tokens and resolves HDHub4u, MoviesDrive, Bollyflix &amp; RogMovies links right on your phone so Cloudflare Worker IP bans can&rsquo;t touch your playback.
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Layers className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">In-App Local Header &amp; HLS Proxy</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Serves HTTP 206 byte ranges, injects CDN Referer &amp; ExoPlayer User-Agent headers, and rewrites HLS playlists locally on <code className="text-accent">127.0.0.1:48912</code>.
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Shield className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Zero Shield / Rate-Limit Waiting</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Movie &amp; TV playback starts directly from the Helper APK without waiting on remote Worker quota or cloud midman latency.
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Lock className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Loopback Only (127.0.0.1)</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Binds strictly to local device loopback with zero telemetry, external tracking, or LAN exposure.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
