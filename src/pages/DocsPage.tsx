import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Tv,
  Copy,
  Check,
  Play,
  ExternalLink,
  Sparkles,
  Server,
  Activity,
  Info,
  ArrowLeft,
  Globe,
  Palette,
  Cpu,
  BookOpen,
} from 'lucide-react'
import { AuroraBackground } from '../components/AuroraBackground'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { cn } from '../lib/utils'

export default function DocsPage() {
  // Live Embed Configurator state
  const [embedId, setEmbedId] = useState('195604')
  const [embedEp, setEmbedEp] = useState(1)
  const [embedServer, setEmbedServer] = useState('megaplay')
  const [embedAudio, setEmbedAudio] = useState<'sub' | 'dub'>('sub')
  const [embedPreview, setEmbedPreview] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedIframe, setCopiedIframe] = useState(false)

  const DOCS_ORIGIN = 'https://zenkaii.pages.dev'
  const embedUrl = `${DOCS_ORIGIN}/embed?id=${embedId}&ep=${embedEp}&server=${embedServer}&audio=${embedAudio}`
  const localPreviewUrl = `/embed?id=${embedId}&ep=${embedEp}&server=${embedServer}&audio=${embedAudio}&preview=1`
  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="100%"\n  frameborder="0"\n  scrolling="no"\n  allowfullscreen\n  allow="autoplay; fullscreen; encrypted-media; picture-in-picture">\n</iframe>`

  const copyEmbedUrl = () => {
    navigator.clipboard.writeText(embedUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const copyIframe = () => {
    navigator.clipboard.writeText(iframeCode)
    setCopiedIframe(true)
    setTimeout(() => setCopiedIframe(false), 2000)
  }

  return (
    <main className="relative isolate min-h-screen bg-background text-foreground">
      <AuroraBackground />

      {/* Sleek minimal header for Docs without site navbar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6 lg:px-8">
        <Logo size={36} to="/" />
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-foreground/5 px-3.5 py-1.5 text-xs font-semibold text-foreground/80 transition hover:bg-foreground/10 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Zenkai</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Header Container */}
      <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col items-start gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="size-3.5" />
            <span>Developer Documentation &amp; Player Embed</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Zenkai Player Embed
          </h1>
          <p className="max-w-3xl text-sm sm:text-base leading-relaxed text-muted">
            High-performance, zero-configuration video player embed for anime platforms, mobile web, and streaming apps. Featuring real-time Anime4K AI upscaling, multi-source failover, and regional language support direct via AniList IDs.
          </p>
        </div>

        {/* 1. Embed Configurator Card */}
        <div className="rounded-2xl border border-border bg-card/90 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Tv className="size-5 text-rose-500" />
                <span>Live Embed Generator</span>
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted">
                Don't add a <code>sandbox</code> attribute: the player refuses to run in sandboxed frames. Configure your anime ID, episode, server, and audio preference to generate ready-to-use embed snippets.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEmbedPreview(!embedPreview)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition',
                  embedPreview
                    ? 'border-rose-500 bg-rose-500/20 text-accent'
                    : 'border-border bg-foreground/5 text-foreground/80 hover:bg-foreground/10 hover:text-foreground'
                )}
              >
                <Play className="size-3.5" />
                <span>{embedPreview ? 'Hide Preview' : 'Preview Player'}</span>
              </button>

              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-foreground/5 px-3.5 py-2 text-xs font-semibold text-foreground/80 transition hover:bg-foreground/10 hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
                <span>Open Standalone</span>
              </a>
            </div>
          </div>

          {/* Form Controls */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                AniList Media ID
              </label>
              <input
                type="text"
                value={embedId}
                onChange={(e) => setEmbedId(e.target.value)}
                placeholder="e.g. 195604"
                className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-rose-500 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-muted">Canonical AniList anime ID (e.g. 195604)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Episode Number
              </label>
              <input
                type="number"
                min={1}
                value={embedEp}
                onChange={(e) => setEmbedEp(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-rose-500 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-muted">Episode number to stream</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Stream Server
              </label>
              <select
                value={embedServer}
                onChange={(e) => setEmbedServer(e.target.value)}
                className="w-full rounded-xl border border-border bg-card-2 px-3 py-2 text-sm text-foreground focus:border-rose-500 focus:outline-none"
              >
                <option value="megaplay">MegaPlay (HD-1 · Default)</option>
                <option value="vidstream">VidStream (HD-2)</option>
                <option value="flixcloud">FlixCloud (Re:Anime Decrypted)</option>
                <option value="acdn">ACDN (Multi-Audio HLS)</option>
              </select>
              <span className="mt-1 block text-[11px] text-muted">Automatic fallback if unavailable</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Audio Language
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEmbedAudio('sub')}
                  className={cn(
                    'rounded-xl border py-2 text-xs font-bold transition',
                    embedAudio === 'sub'
                      ? 'border-rose-500 bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                      : 'border-border bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground'
                  )}
                >
                  SUB (Subbed)
                </button>
                <button
                  type="button"
                  onClick={() => setEmbedAudio('dub')}
                  className={cn(
                    'rounded-xl border py-2 text-xs font-bold transition',
                    embedAudio === 'dub'
                      ? 'border-rose-500 bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                      : 'border-border bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground'
                  )}
                >
                  DUB (Dubbed)
                </button>
              </div>
              <span className="mt-1 block text-[11px] text-muted">Pruned if show lacks dub</span>
            </div>
          </div>

          {/* Generated Code Snippets */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                <span className="font-semibold">Direct Embed URL</span>
                <button
                  onClick={copyEmbedUrl}
                  className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground"
                >
                  {copiedUrl ? <Check className="size-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-card-2 px-3.5 py-2.5 font-mono text-xs text-accent">
                {embedUrl}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                <span className="font-semibold">HTML Iframe Embed Snippet</span>
                <button
                  onClick={copyIframe}
                  className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground"
                >
                  {copiedIframe ? <Check className="size-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3" />}
                  <span>{copiedIframe ? 'Copied' : 'Copy Iframe'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-card-2 p-3.5 font-mono text-xs text-foreground">
                <code>{iframeCode}</code>
              </pre>
            </div>
          </div>

          {/* Live Iframe Preview */}
          {embedPreview && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
              <div className="flex items-center justify-between border-b border-border bg-foreground/5 px-4 py-2 text-xs text-muted">
                <span className="font-semibold">Live Zenkai Player Preview</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">● Active</span>
              </div>
              <div className="relative aspect-video w-full">
                <iframe
                  src={localPreviewUrl}
                  title="Zenkai Player Live Preview"
                  className="h-full w-full border-0"
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Embed URL Query Parameters */}
        <div className="rounded-2xl border border-border bg-card/90 p-5 sm:p-7 shadow-xl">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
            <Info className="size-5 text-rose-500" />
            <span>Embed URL Query Parameters</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-border text-muted uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Parameter</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Default</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground/80">
                <tr>
                  <td className="py-3 px-4 font-mono font-semibold text-accent">id</td>
                  <td className="py-3 px-4 text-muted">number</td>
                  <td className="py-3 px-4 font-mono text-muted">195604</td>
                  <td className="py-3 px-4">The AniList anime media ID. Can also be passed as path param <code className="text-foreground">/embed/:id</code>.</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono font-semibold text-accent">ep</td>
                  <td className="py-3 px-4 text-muted">number</td>
                  <td className="py-3 px-4 font-mono text-muted">1</td>
                  <td className="py-3 px-4">Episode number to play (1-indexed).</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono font-semibold text-accent">server</td>
                  <td className="py-3 px-4 text-muted">string</td>
                  <td className="py-3 px-4 font-mono text-muted">megaplay</td>
                  <td className="py-3 px-4">Target stream server: <code className="text-foreground">megaplay</code>, <code className="text-foreground">vidstream</code>, <code className="text-foreground">flixcloud</code>, or <code className="text-foreground">acdn</code>. Automatically falls back if unavailable.</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono font-semibold text-accent">audio</td>
                  <td className="py-3 px-4 text-muted">string</td>
                  <td className="py-3 px-4 font-mono text-muted">sub</td>
                  <td className="py-3 px-4">Audio stream: <code className="text-foreground">sub</code> (original with subtitles) or <code className="text-foreground">dub</code> (English voiceover).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Unique Zenkai Player Features */}
        <div>
          <div className="mb-6 flex flex-col items-start gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles className="size-3.5" />
              <span>Next-Gen Playback</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Unique Zenkai Player Features
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-2xl">
              Engineered from the ground up for superior playback quality, zero buffering latency, and an unmatched viewer experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Good UI */}
            <div className="rounded-2xl border border-border bg-card/80 p-6 transition hover:border-foreground/20 hover:bg-card-2">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-accent">
                <Palette className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Modern Minimalist UI</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Clean, distraction-free player interface with intuitive touch gestures, full keyboard controls, dynamic aspect ratios, and ambient backdrop lighting.
              </p>
            </div>

            {/* 2. Multiple Sources */}
            <div className="rounded-2xl border border-border bg-card/80 p-6 transition hover:border-foreground/20 hover:bg-card-2">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-accent">
                <Server className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Multiple Stream Sources</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Instant multi-server failover across MegaPlay, VidStream, FlixCloud, and ACDN. The player automatically prunes non-functional sources so viewers never see a dead stream.
              </p>
            </div>

            {/* 3. Regional Language Support */}
            <div className="rounded-2xl border border-border bg-card/80 p-6 transition hover:border-foreground/20 hover:bg-card-2">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-accent">
                <Globe className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Regional Language &amp; Audio</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Native one-click SUB and DUB switching, multi-audio HLS rendition selector, and synchronized WebVTT subtitles in 15+ regional languages.
              </p>
            </div>

            {/* 4. Direct via AniList */}
            <div className="rounded-2xl border border-border bg-card/80 p-6 transition hover:border-foreground/20 hover:bg-card-2">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-accent">
                <BookOpen className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Direct via AniList ID</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Embed any episode immediately using standard AniList media IDs. Zero manual scraping, zero external database mapping, and zero maintenance required.
              </p>
            </div>

            {/* 5. Real-Time AI Upscaler */}
            <div className="rounded-2xl border border-border bg-card/80 p-6 transition hover:border-foreground/20 hover:bg-card-2">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-accent">
                <Cpu className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Anime4K Real-time AI Upscaler</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Built-in GPU-accelerated WebGL / WebGPU Anime4K shader engine. Automatically enhances line art and details for cinema-grade 4K-like sharpness directly in the browser.
              </p>
            </div>

            {/* 6. Device Resume Cache */}
            <div className="rounded-2xl border border-border bg-card/80 p-6 transition hover:border-foreground/20 hover:bg-card-2">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-accent">
                <Activity className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Zero-Config Resume Cache</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Playback progress is saved client-side directly in local storage. When a viewer refreshes or returns later, playback resumes seamlessly right where they paused.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
