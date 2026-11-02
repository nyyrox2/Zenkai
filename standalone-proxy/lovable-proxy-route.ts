/**
 * Zenkai Universal Streaming Proxy for Lovable (TanStack Start / Full-Stack Edge)
 * Target route: /api/public/proxy (also supports /proxy and /api/proxy)
 * 
 * - Full CORS support for https://zenkaii.pages.dev, *.pages.dev, custom domains, and localhost
 * - Proxies all HLS playlists (.m3u8), video segments (.ts, .m4s), and AES-128 encryption keys (.key)
 * - Spoofs appropriate Referer headers for all anime CDNs (MegaPlay, FlixCloud, AnimeSalt, ACDN, etc.)
 * - Full HTTP Range request and 206 Partial Content streaming support
 */

import { createFileRoute } from '@tanstack/react-router';

function getCorsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin') || '*';
  const h = new Headers();
  // Allow all web origins for media playback
  h.set('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin);
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

  // HLS Playlist rewriting: ensures sub-playlists, video segments, and AES keys all route through this proxy
  if (up.ok && isPlaylist) {
    const text = await up.text();
    if (/^\s*</.test(text)) {
      return new Response(text, { status: up.status, headers: outHeaders });
    }

    const proxyBase = `${reqUrl.origin}${reqUrl.pathname}`;
    const base = parsedTarget.hostname.includes('enc-dec.app') && parsedTarget.searchParams.get('url')
      ? new URL(parsedTarget.searchParams.get('url')!)
      : parsedTarget;

    const wrap = (u: string) => {
      try {
        const abs = new URL(u, base);
        if (!abs.search && base.search && !u.includes('?')) abs.search = base.search;
        // Always route segments, playlists, and keys through the proxy to prevent CORS blocks
        return `${proxyBase}?url=${encodeURIComponent(abs.href)}&referer=${encodeURIComponent(referer)}`;
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
          return s.replace(/URI=["']([^"']+)["']/g, (_, u) => `URI="${wrap(u)}"`);
        }
        variant = false;
        return wrap(s);
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

// 1. TanStack Start Route definition
export const Route = createFileRoute('/api/public/proxy')({
  server: {
    handlers: {
      GET: ({ request }) => handleProxyRequest(request),
      HEAD: ({ request }) => handleProxyRequest(request),
      OPTIONS: ({ request }) => handleOptionsRequest(request),
    },
  },
});

// 2. Direct HTTP handler exports
export const GET = ({ request }: { request: Request }) => handleProxyRequest(request);
export const HEAD = ({ request }: { request: Request }) => handleProxyRequest(request);
export const OPTIONS = ({ request }: { request: Request }) => handleOptionsRequest(request);

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') return handleOptionsRequest(request);
    return handleProxyRequest(request);
  },
};
