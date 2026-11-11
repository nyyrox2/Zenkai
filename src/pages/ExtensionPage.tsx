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
  Layers
} from 'lucide-react'
import { useCompanion, LATEST_EXTENSION_VERSION } from '../lib/useCompanion'
import { toast } from '../lib/toast'

export default function ExtensionPage() {
  const companion = useCompanion()
  const [copied, setCopied] = useState(false)

  const copyExtensionsUrl = () => {
    navigator.clipboard.writeText('chrome://extensions')
    setCopied(true)
    toast('Copied "chrome://extensions" to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative min-h-screen bg-[#08090d] text-foreground">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/4 -z-10 h-[400px] w-[500px] rounded-full bg-emerald-500/10 blur-[130px]" />

      <main className="mx-auto max-w-4xl px-4 pb-28 pt-24 sm:px-6 sm:pt-28">
        {/* Navigation */}
        <Link
          to="/movies"
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Movies & TV
        </Link>

        {/* Hero */}
        <div className="text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-black/40 ring-1 ring-white/10 shadow-xl">
            <img src="/logo.png" alt="Zenkai" className="size-12 object-contain drop-shadow" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-bold text-accent">
            <Sparkles className="size-3.5" /> Manifest V3 • Zero Proxy P2P Engine
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Zenkai Stream Companion
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Unlock authentic 4K and 1080p high-bitrate streaming with zero proxy latency. Stream directly from the original MovieBox, Hakunaymatata, and BCDNXW CDNs from your residential IP.
          </p>

          {/* Live status banner */}
          <div className="mx-auto mt-8 max-w-lg">
            {companion.installed ? (
              companion.isOutdated ? (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left shadow-lg shadow-amber-950/20">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
                    <AlertCircle className="size-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-300">
                      Update Available (v{companion.version || '1.0.0'} → v{LATEST_EXTENSION_VERSION})
                    </h3>
                    <p className="text-xs text-amber-200/80">
                      A newer version of the companion is ready with updated CDN rules and streaming fixes. Download the new zip below and click reload in chrome://extensions.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left shadow-lg shadow-emerald-950/20">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400">Extension Active & Up to Date (v{companion.version || LATEST_EXTENSION_VERSION})</h3>
                    <p className="text-xs text-emerald-300/80">
                      Direct residential CDN connection is fully operational. Streams run directly from original CDNs with zero proxy delay.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left shadow-lg shadow-black/40">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent">
                  <AlertCircle className="size-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Companion Extension Not Detected</h3>
                  <p className="text-xs text-muted">
                    Download and load the extension below to eliminate buffering and unlock TV series and multi-audio dubs.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Download Button */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/zenkai-companion.zip"
              download="zenkai-companion.zip"
              className="inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-accent/25 transition hover:brightness-110 active:scale-95"
            >
              <Download className="size-4" /> Download Extension (.ZIP)
            </a>
            <button
              onClick={copyExtensionsUrl}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-3.5 text-xs font-semibold text-muted backdrop-blur transition hover:text-foreground active:scale-95"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              Copy chrome://extensions
            </button>
          </div>
          <span className="mt-2.5 block text-[11px] text-muted">
            Version {LATEST_EXTENSION_VERSION} • Size ~43 KB • Compatible with Chrome, Edge, Brave, Opera & Vivaldi
          </span>
        </div>

        {/* 3-Step Installation Guide */}
        <div className="mt-16">
          <h2 className="text-center font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Quick 30-Second Setup
          </h2>
          <p className="mt-1 text-center text-xs text-muted">
            No Chrome Web Store account needed. Unpacked Manifest V3 developer extension.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="relative rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
              <span className="inline-block text-xs font-black uppercase tracking-wider text-accent">Step 01</span>
              <h3 className="mt-2 text-base font-bold text-foreground">Download & Extract</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Click the download button above to get <code className="rounded bg-white/10 px-1 py-0.5 text-accent">zenkai-companion.zip</code>. Extract it to any folder on your computer.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
              <span className="inline-block text-xs font-black uppercase tracking-wider text-accent">Step 02</span>
              <h3 className="mt-2 text-base font-bold text-foreground">Open Extensions</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Navigate to <code className="rounded bg-white/10 px-1 py-0.5 text-accent">chrome://extensions</code> in your browser and enable the <strong className="text-foreground">Developer mode</strong> toggle in the top-right corner.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
              <span className="inline-block text-xs font-black uppercase tracking-wider text-accent">Step 03</span>
              <h3 className="mt-2 text-base font-bold text-foreground">Load Unpacked</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Click <strong className="text-foreground">"Load unpacked"</strong> and select the extracted folder. Return to Zenkai Web and enjoy instant direct streaming!
              </p>
            </div>
          </div>
        </div>

        {/* Technical Highlights */}
        <div className="mt-16">
          <h2 className="text-center font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Why Use Zenkai Companion?
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Zap className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Zero Proxy Latency</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Connects directly from your home network to the video CDN edge servers without routing through overseas cloud midman servers.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Layers className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Unlocks BCDNXW TV Series & Dubs</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Automatically rewrites the Referer header to <code className="text-accent">https://123moviesfree.club/</code>, allowing seamless playback of multi-audio dubs and full TV series.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Shield className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Bypasses HTTP 428 / 429 Blocks</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Injects the trusted ExoPlayer media headers and strips tracking headers so CDNs deliver continuous, unthrottled video segments.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-border bg-card/30 p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Lock className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">100% Private & Open Source</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  No tracking, telemetry, or external API calls. All declarativeNetRequest rules execute locally inside your browser engine.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
