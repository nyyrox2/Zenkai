/**
 * Zenkai Universal Streaming Proxy for Lovable (TanStack Start / Full-Stack Node / Edge)
 * Target route: /api/public/proxy
 * 
 * - Allowed origin: https://zenkaii.pages.dev (and local development)
 * - Supported Providers: MegaPlay, FlixCloud, ACDN, AnimeSalt, Vidstreaming, RapidCloud, RabbitStream, etc.
 * - Rewrites HLS m3u8 playlists and AES-128 encryption keys back through this proxy
 * - Streams video chunks (.ts, .m4s) directly with Range request support
 */

import { createFileRoute } from '@tanstack/react-router';

// Allowed origins - locked to zenkaii.pages.dev + dev environments
const ALLOWED_ORIGIN_PATTERNS = [
  'https://zenkaii.pages.dev',
  /^https:\/\/[a-z0-9-]+\.pages\.dev$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function getCorsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin') || '';
  let allowedOrigin = 'https://zenkaii.pages.dev';

  for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
    if (typeof pattern === 'string' ? pattern === origin : pattern.test(origin)) {
      allowedOrigin = origin;
      break;
    }
  }

  const h = new Headers();
  h.set('Access-Control-Allow-Origin', allowedOrigin);
  h.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, X-Requested-With, Origin, Accept');
  h.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges');
  h.set('Access-Control-Max-Age', '86400');
  h.set('Vary', 'Origin');
  return h;
}

const FORBIDDEN_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
  'instance-data',
]);

const ALLOWED_STREAM_DOMAINS = [
  'megaplay.buzz',
  'nexabloom.top',
  'stellarfrontier.world',
  'phantomharbor.top',
  'shadowharbor.top',
  'hiddenvertex.top',
  'emeralddrift.top',
  'eclipseharbor.space',
  'broforgotsave.online',
  'imgnex.top',
  'akirax.top',
  'shiora.top',
  'krussdomi.com',
  'advancedairesearchlab.top',
  'animeapps.top',
  'nukitashi.top',
  'playeng.animeapps.top',
  'novelfire.net',
  'novelfull.com',
  'anikototv.to',
  'animegg.org',
  'anineko.to',
  'anizone.to',
  'aniwave.to',
  'animesalt.cx',
  'animesalt.ac',
  'animesalt.ro',
  'animesalt.cc',
  'ravok.buzz',
  'acdn.top',
  'abyssplayer.com',
  'playhydrax.com',
  'flixcloud.cc',
  'enc-dec.app',
  'reanime.to',
  'atomic4cdn.com',
  'rundowncdn.com',
  'rundowncdn.top',
  'vividcdn.com',
  'vividcdn.top',
  'fallencdn.com',
  'fallencdn.top',
  'akamaized.net',
  'cloudflare.com',
  'workers.dev',
  'opensubtitles.org',
  'opensubtitles-v3.strem.io',
  'strem.io',
  'tmdb.org',
  'themoviedb.org',
  'image.tmdb.org',
  'megacloud.tv',
  'rapid-cloud.ru',
  'rapid-cloud.co',
  'vidstreaming.io',
  'rabbitstream.net',
  'streamtape.com',
  'mp4upload.com',
  'streamwish.to',
  'streamwish.com',
  'filemoon.sx',
  'vidplay.online',
  'mycloud.to',
  'mcloud.to',
  'vizcloud.info',
  'vizcloud.digital',
  'vizcloud.co',
  'dokicloud.one',
];

function isAllowedTarget(parsed: URL): { valid: boolean; error?: string } {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols permitted' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (FORBIDDEN_HOSTS.has(hostname)) {
    return { valid: false, error: 'Access to private/local network address is blocked' };
  }

  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/.test(hostname)) {
    return { valid: false, error: 'Private IP addresses prohibited' };
  }

  if (hostname.endsWith('.internal') || hostname.endsWith('.local') || hostname.endsWith('.lan')) {
    return { valid: false, error: 'Internal network targets prohibited' };
  }

  const isMediaPattern =
    /\.(m3u8|ts|m4s|m3u|mp4|vtt|srt|key|bin|jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(parsed.pathname) ||
    /cdn|stream|video|m3u8|hls|media|chunk|segment|seg-|sub|caption|fetch|anime|harbor|drift|frontier|vertex|space/i.test(hostname) ||
    /stream|anime|subtitles/i.test(parsed.pathname) ||
    /^as-cdn\d*\.top$/i.test(hostname);

  const inDomainList = ALLOWED_STREAM_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));

  if (!inDomainList && !isMediaPattern) {
    return { valid: false, error: `Domain not whitelisted for proxying: ${hostname}` };
  }

  return { valid: true };
}

function refererFor(hostname: string, customReferer?: string | null): string {
  if (customReferer) return customReferer;
  const h = hostname.toLowerCase();
  if (h.includes('flixcloud') || h.includes('reanime') || h.includes('enc-dec')) return 'https://flixcloud.cc/';
  if (h.includes('animesalt') || h.includes('acdn') || /^as-cdn\d*\.top$/.test(h)) return 'https://animesalt.cx/';
  if (h.includes('megaplay') || h.includes('rabbitstream') || h.includes('megacloud') || h.includes('rapid-cloud') || h.includes('vidstreaming')) return 'https://megaplay.buzz/';
  return `https://${hostname}/`;
}

export async function handleProxyRequest(request: Request): Promise<Response> {
  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url');
  const corsHeaders = getCorsHeaders(request);

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing required ?url= parameter' }), {
      status: 400,
      headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
    });
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
      status: 400,
      headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
    });
  }

  const check = isAllowedTarget(parsedTarget);
  if (!check.valid) {
    return new Response(JSON.stringify({ error: check.error }), {
      status: 403,
      headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
    });
  }

  const referer = refererFor(parsedTarget.hostname, reqUrl.searchParams.get('referer'));
  const fetchHeaders = new Headers({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Referer: referer,
    Origin: referer.replace(/\/+$/, ''),
    Accept: '*/*',
  });

  const range = request.headers.get('Range');
  if (range) fetchHeaders.set('Range', range);

  let up: Response;
  try {
    up = await fetch(parsedTarget.href, { headers: fetchHeaders, redirect: 'follow' });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed: ' + (err?.message || err) }), {
      status: 502,
      headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
    });
  }

  const outHeaders = new Headers(corsHeaders);
  const contentType = up.headers.get('Content-Type') || '';
  const isPlaylist =
    /mpegurl/i.test(contentType) ||
    /\.m3u8?$/i.test(parsedTarget.pathname) ||
    parsedTarget.pathname.includes('parse-flixcloud') ||
    (parsedTarget.searchParams.get('url') || '').includes('.m3u8');

  // HLS Playlist rewriting
  if (up.ok && isPlaylist) {
    const text = await up.text();
    if (/^\s*</.test(text)) {
      return new Response(text, { status: up.status, headers: outHeaders });
    }

    const direct = reqUrl.searchParams.get('seg') === '1';
    const proxyBase = `${reqUrl.origin}${reqUrl.pathname}`;
    const base = parsedTarget.hostname.includes('enc-dec.app') && parsedTarget.searchParams.get('url')
      ? new URL(parsedTarget.searchParams.get('url')!)
      : parsedTarget;

    const wrap = (u: string, keep: boolean) => {
      try {
        const abs = new URL(u, base);
        if (!abs.search && base.search && !u.includes('?')) abs.search = base.search;
        if (direct && keep && !/rundowncdn|flixcloud|vividcdn|fallencdn/.test(abs.hostname)) return abs.href;
        return `${proxyBase}?url=${encodeURIComponent(abs.href)}&referer=${encodeURIComponent(referer)}${direct ? '&seg=1' : ''}`;
      } catch {
        return u;
      }
    };

    let variant = false;
    const body = text
      .split(/\r?\n/)
      .map((l) => {
        const s = l.trim();
        if (!s) return l;
        if (s.startsWith('#')) {
          variant = s.startsWith('#EXT-X-STREAM-INF');
          return s.replace(/URI=["']([^"']+)["']/g, (_, u) => `URI="${wrap(u, s.startsWith('#EXT-X-MAP'))}"`);
        }
        const plist = variant || /\.m3u8?(\?|$)/i.test(s) || s.includes('parse-flixcloud');
        variant = false;
        return wrap(s, !plist);
      })
      .join('\n');

    outHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    outHeaders.set('Cache-Control', 'no-store');
    return new Response(body, { status: up.status, headers: outHeaders });
  }

  if (contentType) outHeaders.set('Content-Type', contentType);
  if (/\.(bin|key)$/i.test(parsedTarget.pathname)) outHeaders.set('Content-Type', 'application/octet-stream');
  for (const h of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const v = up.headers.get(h);
    if (v) outHeaders.set(h, v);
  }
  if (up.ok && /\.(ts|m4s|mp4|aac|key|bin|png|webp|vtt|srt)$/i.test(parsedTarget.pathname)) {
    outHeaders.set('Cache-Control', 'public, max-age=3600');
  }

  return new Response(up.body, { status: up.status, headers: outHeaders });
}

export function handleOptionsRequest(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

// 1. TanStack Start Route definition (default in Lovable TanStack template)
export const Route = createFileRoute('/api/public/proxy')({
  server: {
    handlers: {
      GET: ({ request }) => handleProxyRequest(request),
      HEAD: ({ request }) => handleProxyRequest(request),
      OPTIONS: ({ request }) => handleOptionsRequest(request),
    },
  },
});

// 2. Direct HTTP handler exports (for Nitro / Node / Edge functions)
export const GET = ({ request }: { request: Request }) => handleProxyRequest(request);
export const HEAD = ({ request }: { request: Request }) => handleProxyRequest(request);
export const OPTIONS = ({ request }: { request: Request }) => handleOptionsRequest(request);

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') return handleOptionsRequest(request);
    return handleProxyRequest(request);
  },
};
