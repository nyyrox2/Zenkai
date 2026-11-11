// Web-standard MovieBox resolver: pure JavaScript MD5 + HMAC-MD5 (runs seamlessly across Cloudflare Pages Functions, Vite, and Node)
const SECRET_KEY_DEFAULT_B64 = "NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw==";
const SECRET_KEY_ALT_B64 = "WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ==";
const MODERN_USER_AGENT = "com.community.oneroom/50020042 (Linux; U; Android 12; en_US; Pixel 6; Build/SQ1D.220105.007; Cronet/145.0.7582.0)";
const WEB_USER_AGENT = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";
const NATIVE_API_BASE = "https://api3.aoneroom.com";
const BOOTSTRAP_HOSTS = [
  "https://api3.aoneroom.com",
  "https://apig.inmoviebox.com",
  "https://api6.aoneroom.com"
];
const BOOTSTRAP_URL = `${BOOTSTRAP_HOSTS[0]}/wefeed-mobile-bff/tab/ranking-list?tabId=0&categoryType=4516404531735022304&page=1&perPage=1`;
import { tmdbFetch } from "./tmdb.js";
const TMDB_PROXY_BASE = "https://aniversee.vercel.app/api/tmdb";

const WEB_DOMAINS = [
  "https://123moviesfree.club",
  "https://sflix.film",
  "https://movieboxonline.net",
];

const VALID_DUB_REGEX = /hindi|tamil|telugu|kannada|malayalam|bengali|marathi|punjabi|english|spanish|esla|portuguese|ptbr|french|german|italian|russian|japanese|korean|chinese|mandarin|cantonese|arabic|turkish|thai|indonesian|vietnamese|tagalog|filipino|dub|dual\s*audio|multi\s*audio/i;
const IGNORE_TAG_REGEX = /spoilers?|cameos?|full\s*movie|clips?|trailers?|teasers?|scenes?|review|bts|behind\s*the\s*scenes/i;

// Pure JS RFC 1321 MD5
function md5(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  const n = bytes.length;
  const newLen = (((n + 8) >> 6) + 1) << 4;
  const words = new Uint32Array(newLen);
  for (let i = 0; i < n; i++) words[i >> 2] |= bytes[i] << ((i % 4) << 3);
  words[n >> 2] |= 0x80 << ((n % 4) << 3);
  words[newLen - 2] = (n * 8) >>> 0;
  words[newLen - 1] = Math.floor((n * 8) / 0x100000000);

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const rol = (v, s) => (v << s) | (v >>> (32 - s));

  for (let i = 0; i < newLen; i += 16) {
    const aa = a, bb = b, cc = c, dd = d;

    a = rol(a + ((b & c) | (~b & d)) + words[i + 0] + 0xd76aa478, 7) + b;
    d = rol(d + ((a & b) | (~a & c)) + words[i + 1] + 0xe8c7b756, 12) + a;
    c = rol(c + ((d & a) | (~d & b)) + words[i + 2] + 0x242070db, 17) + d;
    b = rol(b + ((c & d) | (~c & a)) + words[i + 3] + 0xc1bdceee, 22) + c;
    a = rol(a + ((b & c) | (~b & d)) + words[i + 4] + 0xf57c0faf, 7) + b;
    d = rol(d + ((a & b) | (~a & c)) + words[i + 5] + 0x4787c62a, 12) + a;
    c = rol(c + ((d & a) | (~d & b)) + words[i + 6] + 0xa8304613, 17) + d;
    b = rol(b + ((c & d) | (~c & a)) + words[i + 7] + 0xfd469501, 22) + c;
    a = rol(a + ((b & c) | (~b & d)) + words[i + 8] + 0x698098d8, 7) + b;
    d = rol(d + ((a & b) | (~a & c)) + words[i + 9] + 0x8b44f7af, 12) + a;
    c = rol(c + ((d & a) | (~d & b)) + words[i + 10] + 0xffff5bb1, 17) + d;
    b = rol(b + ((c & d) | (~c & a)) + words[i + 11] + 0x895cd7be, 22) + c;
    a = rol(a + ((b & c) | (~b & d)) + words[i + 12] + 0x6b901122, 7) + b;
    d = rol(d + ((a & b) | (~a & c)) + words[i + 13] + 0xfd987193, 12) + a;
    c = rol(c + ((d & a) | (~d & b)) + words[i + 14] + 0xa679438e, 17) + d;
    b = rol(b + ((c & d) | (~c & a)) + words[i + 15] + 0x49b40821, 22) + c;

    a = rol(a + ((b & d) | (c & ~d)) + words[i + 1] + 0xf61e2562, 5) + b;
    d = rol(d + ((a & c) | (b & ~c)) + words[i + 6] + 0xc040b340, 9) + a;
    c = rol(c + ((d & b) | (a & ~b)) + words[i + 11] + 0x265e5a51, 14) + d;
    b = rol(b + ((c & a) | (d & ~a)) + words[i + 0] + 0xe9b6c7aa, 20) + c;
    a = rol(a + ((b & d) | (c & ~d)) + words[i + 5] + 0xd62f105d, 5) + b;
    d = rol(d + ((a & c) | (b & ~c)) + words[i + 10] + 0x02441453, 9) + a;
    c = rol(c + ((d & b) | (a & ~b)) + words[i + 15] + 0xd8a1e681, 14) + d;
    b = rol(b + ((c & a) | (d & ~a)) + words[i + 4] + 0xe7d3fbc8, 20) + c;
    a = rol(a + ((b & d) | (c & ~d)) + words[i + 9] + 0x21e1cde6, 5) + b;
    d = rol(d + ((a & c) | (b & ~c)) + words[i + 14] + 0xc33707d6, 9) + a;
    c = rol(c + ((d & b) | (a & ~b)) + words[i + 3] + 0xf4d50d87, 14) + d;
    b = rol(b + ((c & a) | (d & ~a)) + words[i + 8] + 0x455a14ed, 20) + c;
    a = rol(a + ((b & d) | (c & ~d)) + words[i + 13] + 0xa9e3e905, 5) + b;
    d = rol(d + ((a & c) | (b & ~c)) + words[i + 2] + 0xfcefa3f8, 9) + a;
    c = rol(c + ((d & b) | (a & ~b)) + words[i + 7] + 0x676f02d9, 14) + d;
    b = rol(b + ((c & a) | (d & ~a)) + words[i + 12] + 0x8d2a4c8a, 20) + c;

    a = rol(a + (b ^ c ^ d) + words[i + 5] + 0xfffa3942, 4) + b;
    d = rol(d + (a ^ b ^ c) + words[i + 8] + 0x8771f681, 11) + a;
    c = rol(c + (d ^ a ^ b) + words[i + 11] + 0x6d9d6122, 16) + d;
    b = rol(b + (c ^ d ^ a) + words[i + 14] + 0xfde5380c, 23) + c;
    a = rol(a + (b ^ c ^ d) + words[i + 1] + 0xa4beea44, 4) + b;
    d = rol(d + (a ^ b ^ c) + words[i + 4] + 0x4bdecfa9, 11) + a;
    c = rol(c + (d ^ a ^ b) + words[i + 7] + 0xf6bb4b60, 16) + d;
    b = rol(b + (c ^ d ^ a) + words[i + 10] + 0xbebfbc70, 23) + c;
    a = rol(a + (b ^ c ^ d) + words[i + 13] + 0x289b7ec6, 4) + b;
    d = rol(d + (a ^ b ^ c) + words[i + 0] + 0xeaa127fa, 11) + a;
    c = rol(c + (d ^ a ^ b) + words[i + 3] + 0xd4ef3085, 16) + d;
    b = rol(b + (c ^ d ^ a) + words[i + 6] + 0x04881d05, 23) + c;
    a = rol(a + (b ^ c ^ d) + words[i + 9] + 0xd9d4d039, 4) + b;
    d = rol(d + (a ^ b ^ c) + words[i + 12] + 0xe6db99e5, 11) + a;
    c = rol(c + (d ^ a ^ b) + words[i + 15] + 0x1fa27cf8, 16) + d;
    b = rol(b + (c ^ d ^ a) + words[i + 2] + 0xc4ac5665, 23) + c;

    a = rol(a + (c ^ (b | ~d)) + words[i + 0] + 0xf4292244, 6) + b;
    d = rol(d + (b ^ (a | ~c)) + words[i + 7] + 0x432aff97, 10) + a;
    c = rol(c + (a ^ (d | ~b)) + words[i + 14] + 0xab9423a7, 15) + d;
    b = rol(b + (d ^ (c | ~a)) + words[i + 5] + 0xfc93a039, 21) + c;
    a = rol(a + (c ^ (b | ~d)) + words[i + 12] + 0x655b59c3, 6) + b;
    d = rol(d + (b ^ (a | ~c)) + words[i + 3] + 0x8f0ccc92, 10) + a;
    c = rol(c + (a ^ (d | ~b)) + words[i + 10] + 0xffeff47d, 15) + d;
    b = rol(b + (d ^ (c | ~a)) + words[i + 1] + 0x85845dd1, 21) + c;
    a = rol(a + (c ^ (b | ~d)) + words[i + 8] + 0x6fa87e4f, 6) + b;
    d = rol(d + (b ^ (a | ~c)) + words[i + 15] + 0xfe2ce6e0, 10) + a;
    c = rol(c + (a ^ (d | ~b)) + words[i + 6] + 0xa3014314, 15) + d;
    b = rol(b + (d ^ (c | ~a)) + words[i + 13] + 0x4e0811a1, 21) + c;
    a = rol(a + (c ^ (b | ~d)) + words[i + 4] + 0xf7537e82, 6) + b;
    d = rol(d + (b ^ (a | ~c)) + words[i + 11] + 0xbd3af235, 10) + a;
    c = rol(c + (a ^ (d | ~b)) + words[i + 2] + 0x2ad7d2bb, 15) + d;
    b = rol(b + (d ^ (c | ~a)) + words[i + 9] + 0xeb86d391, 21) + c;

    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }

  const out = new Uint8Array(16);
  const outWords = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    out[i * 4 + 0] = outWords[i] & 0xff;
    out[i * 4 + 1] = (outWords[i] >>> 8) & 0xff;
    out[i * 4 + 2] = (outWords[i] >>> 16) & 0xff;
    out[i * 4 + 3] = (outWords[i] >>> 24) & 0xff;
  }
  return out;
}

function md5Hex(data) {
  const bytes = md5(data);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hmacMd5(key, data) {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key);
  const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);

  let k = new Uint8Array(64);
  if (keyBytes.length > 64) {
    k.set(md5(keyBytes));
  } else {
    k.set(keyBytes);
  }

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }

  const inner = new Uint8Array(64 + dataBytes.length);
  inner.set(ipad, 0);
  inner.set(dataBytes, 64);
  const innerHash = md5(inner);

  const outer = new Uint8Array(64 + 16);
  outer.set(opad, 0);
  outer.set(innerHash, 64);
  return md5(outer);
}

function hmacMd5Base64(key, data) {
  const bytes = hmacMd5(key, data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64decode(s) {
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  str += '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getSecretBytes(useAlt = false) {
  const outer = useAlt ? SECRET_KEY_ALT_B64 : SECRET_KEY_DEFAULT_B64;
  const innerBytes = b64decode(outer);
  const innerStr = new TextDecoder().decode(innerBytes);
  return b64decode(innerStr);
}

function generateDeviceId() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateXClientToken(ts) {
  const tsStr = String(ts);
  const reversed = tsStr.split('').reverse().join('');
  return `${tsStr},${md5Hex(reversed)}`;
}

function generateClientInfo(deviceId) {
  return JSON.stringify({
    package_name: "com.community.oneroom",
    version_name: "3.0.03.0529.03",
    version_code: 50020042,
    os: "android",
    os_version: "12",
    install_ch: "ps",
    device_id: deviceId,
    install_store: "ps",
    gaid: "1b2212c1-dadf-43c3-a0c8-bd6ce48ae22d",
    brand: "Redmi",
    model: "2201117TG",
    system_language: "en",
    net: "NETWORK_WIFI",
    region: "US",
    timezone: "America/New_York",
    sp_code: "40401",
    "X-Play-Mode": "2",
  });
}

function buildCanonicalString(method, accept, contentType, urlStr, body, ts) {
  const u = new URL(urlStr);
  const path = u.pathname || '/';
  let canonicalUrl = path;
  if (u.search) {
    const pairs = Array.from(u.searchParams.entries())
      .map(([k, v]) => [k, v])
      .sort((a, b) => a[0].localeCompare(b[0]));
    const query = pairs.map(([k, v]) => `${k}=${v}`).join('&');
    canonicalUrl = `${path}?${query}`;
  }

  let bodyLength = '';
  let bodyHash = '';
  if (body) {
    const bodyBuf = new TextEncoder().encode(body);
    bodyLength = String(bodyBuf.length);
    bodyHash = md5Hex(bodyBuf.subarray(0, 102400));
  }

  return [
    method.toUpperCase(),
    accept || '',
    contentType || '',
    bodyLength,
    String(ts),
    bodyHash,
    canonicalUrl,
  ].join('\n');
}

function generateXTrSignature(method, accept, contentType, urlStr, body, ts, useAlt = false) {
  const canonical = buildCanonicalString(method, accept, contentType, urlStr, body, ts);
  const key = getSecretBytes(useAlt);
  const sigB64 = hmacMd5Base64(key, canonical);
  return `${ts}|2|${sigB64}`;
}

function buildAuthHeaders(method, urlStr, body = null, token = null, deviceId = null) {
  const ts = Math.floor(Date.now() / 1000);
  const devId = deviceId || getDeviceId();
  const accept = 'application/json';
  const contentType = body ? 'application/json' : '';

  const headers = {
    'Accept': accept,
    'User-Agent': MODERN_USER_AGENT,
    'x-client-info': generateClientInfo(devId),
    'x-client-status': '0',
    'x-client-token': generateXClientToken(ts),
    'x-device-id': devId,
    'x-request-lang': 'en',
    'x-source': 'moviebox',
    'x-tr-signature': generateXTrSignature(method, accept, contentType, urlStr, body, ts),
  };

  if (contentType) headers['Content-Type'] = contentType;
  if (token) headers['authorization'] = `Bearer ${token}`;

  return headers;
}

let cachedToken = null;
let tokenExpiresAt = 0;
let globalDeviceId = null;

function getDeviceId() {
  if (!globalDeviceId) globalDeviceId = generateDeviceId();
  return globalDeviceId;
}

export async function bootstrapToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  // Method 1: Direct visitor-login API (global, zero geo-restriction)
  for (const host of ['https://api3.aoneroom.com', 'https://api6.aoneroom.com']) {
    try {
      const url = `${host}/wefeed-mobile-bff/user-api/visitor-login`;
      const bodyStr = JSON.stringify({});
      const headers = buildAuthHeaders('POST', url, bodyStr, null, getDeviceId());
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: bodyStr,
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.data?.token) {
          cachedToken = json.data.token;
          tokenExpiresAt = Date.now() + 24 * 3600 * 1000;
          return cachedToken;
        }
      }
    } catch (err) {}
  }

  // Method 2: Tab ranking list fallback (x-user header)
  for (const host of BOOTSTRAP_HOSTS) {
    try {
      const bUrl = `${host}/wefeed-mobile-bff/tab/ranking-list?tabId=0&categoryType=4516404531735022304&page=1&perPage=1`;
      const headers = buildAuthHeaders('GET', bUrl, null, null, getDeviceId());
      const res = await fetch(bUrl, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      const xUser = res.headers.get('x-user');
      if (xUser) {
        const data = JSON.parse(xUser);
        cachedToken = data.token;
        tokenExpiresAt = Date.now() + 2 * 3600 * 1000;
        return cachedToken;
      }
    } catch (err) {}
  }

  throw new Error('Failed to bootstrap MovieBox token');
}

export async function apiRequest(method, pathOrUrl, bodyDict = null) {
  const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${NATIVE_API_BASE}${pathOrUrl}`;
  const token = await bootstrapToken();
  const bodyStr = bodyDict ? JSON.stringify(bodyDict) : null;
  const headers = buildAuthHeaders(method, fullUrl, bodyStr, token, getDeviceId());

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: bodyStr || undefined,
    signal: AbortSignal.timeout(8000),
  });

  if (res.status === 401 || res.status === 441) {
    cachedToken = null;
    return apiRequest(method, pathOrUrl, bodyDict);
  }

  return res.json();
}

export async function searchMovieBox(query) {
  let rawItems = [];
  try {
    const resV2 = await apiRequest('POST', '/wefeed-mobile-bff/subject-api/search/v2', {
      keyword: query,
      page: 1,
      perPage: 15,
    });
    const groups = resV2?.data?.results || [];
    for (const g of groups) {
      if (Array.isArray(g.subjects)) {
        rawItems.push(...g.subjects);
      }
    }
  } catch {}

  if (!rawItems.length) {
    try {
      const resV1 = await apiRequest('POST', '/wefeed-mobile-bff/subject-api/search', {
        keyword: query,
        page: 1,
        perPage: 15,
      });
      rawItems = resV1?.data?.items || resV1?.data?.list || [];
    } catch {}
  }

  return rawItems.map((item) => {
    const sub = item.subject || item;
    const detailUrlStr = sub.detailUrl || item.detailUrl || '';
    const detailPath = detailUrlStr.split('/').pop() || '';
    return {
      subject_id: String(sub.subjectId || sub.subject_id),
      title: sub.title,
      type: sub.subjectType === 1 || sub.type === 'movie' ? 'movie' : 'tv',
      release_date: sub.releaseDate || sub.release_date,
      imdb_rating: sub.imdbRatingValue || sub.imdb_rating,
      genre: sub.genre,
      cover: sub.cover?.url || sub.cover || null,
      language: sub.language,
      detail_path: detailPath,
    };
  });
}

export async function getMovieBoxDetails(subjectId) {
  const res = await apiRequest('GET', `/wefeed-mobile-bff/subject-api/get?subjectId=${subjectId}`);
  const data = res?.data || {};
  const detailUrlStr = data.detailUrl || '';
  const detailPath = detailUrlStr.split('/').pop() || '';

  return {
    subject_id: String(data.subjectId),
    title: data.title,
    detail_path: detailPath,
    resourceDetectors: data.resourceDetectors || [],
    dubs: (data.dubs || []).map((d) => ({
      subject_id: String(d.subjectId),
      lang_name: d.lanName,
      language: d.language,
    })),
  };
}

/**
 * Filter out fake / placeholder promotional videos returned by MovieBox.
 * Known fake videos:
 * - "Update now. Keep watching." promo (hash 80da52722ee7de7a4303290af6783424, ~824KB, 23s)
 * - Old app version promo (hash b164fbfb4347792950bdfbfb563d39d9)
 * - Any video under 60 seconds (unless short clip) or under 5 MB
 */
function isFakeStream(st, minDuration = 60) {
  if (!st || !st.url) return true;
  const url = String(st.url);
  if (
    url.includes('80da52722ee7de7a') ||
    url.includes('b164fbfb4347792950bdfbfb563d39d9') ||
    url.includes('/other/2026/10/10/')
  ) return true;
  const dur = Number(st.duration || 0);
  if (dur > 0 && dur < minDuration) return true;
  const size = Number(st.size || 0);
  if (size > 0 && size < 5 * 1024 * 1024 && dur > 0 && dur < 120) return true;
  return false;
}

export async function getMovieBoxStreams(subjectId, season = 0, episode = 0, explicitDetailPath = '', minDuration = 60, prefetchedDetails = null) {
  const streams = [];
  const seenUrls = new Set();
  const seenQualities = new Set();

  let details = prefetchedDetails;
  if (!details) {
    try {
      details = await getMovieBoxDetails(subjectId);
    } catch {}
  }

  const detailPath = explicitDetailPath || details?.detail_path || '';

  // 1. Direct CDN MP4 streams from resourceDetectors (Provides authentic 4K, 1080p, 720p, 480p, 360p files)
  const detectors = details?.resourceDetectors || [];
  for (const rd of detectors) {
    const resList = rd.resolutionList || [];
    for (const r of resList) {
      if (!r.resourceLink) continue;
      // Season/episode check for TV
      if (season > 0 || episode > 0) {
        const itemSe = Number(r.se ?? r.season ?? 0);
        const itemEp = Number(r.ep ?? r.episode ?? 0);
        if (itemSe !== season || itemEp !== episode) continue;
      }
      if (isFakeStream({ url: r.resourceLink, duration: r.duration, size: r.size }, minDuration)) continue;
      if (seenUrls.has(r.resourceLink)) continue;
      seenUrls.add(r.resourceLink);

      const resVal = parseInt(r.resolution || '1080', 10) || 1080;
      streams.push({
        source: `Direct CDN (${rd.source || 'Direct'})`,
        format: 'MP4',
        quality: `${resVal}p`,
        resolutionNum: resVal,
        url: r.resourceLink,
        codec: r.codecName,
        duration: r.duration,
        size: parseInt(r.size || '0', 10) || 0,
      });
      seenQualities.add(resVal);
    }
  }

  // 2. Web CDN mirrors (enrich or fallback with full-length 1080p/720p/480p streams)
  if (detailPath) {
    try {
      const token = await bootstrapToken();
      for (const domain of WEB_DOMAINS) {
        try {
          const playUrl = `${domain}/wefeed-h5api-bff/subject/play?subjectId=${subjectId}&se=${season}&ep=${episode}&detailPath=${encodeURIComponent(detailPath)}&streamSignType=0&supportCodecs%5Bhevc%5D=1&supportCodecs%5Bh264%5D=1`;
          const referer = `${domain}/movies/${detailPath}?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`;

          const res = await fetch(playUrl, {
            headers: {
              'User-Agent': WEB_USER_AGENT,
              'Referer': referer,
              'Accept': 'application/json',
              'x-client-info': '{"timezone":"Asia/Calcutta"}',
              'x-request-lang': 'en',
              'x-vip-restrict': '0',
              'x-no-high-risk-restrict': '0',
              'x-source': 'moviebox',
              'Authorization': `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(4000),
          });

          if (!res.ok) continue;
          const data = await res.json();
          const rawStreams = data?.data?.streams || [];

          for (const st of rawStreams) {
            if (!st.url || isFakeStream(st, minDuration) || seenUrls.has(st.url)) continue;
            const resVal = parseInt(st.resolutions || '1080', 10) || 1080;
            if (seenQualities.has(resVal)) continue;
            seenUrls.add(st.url);
            seenQualities.add(resVal);

            const sizeBytes = parseInt(st.size || '0', 10) || 0;
            streams.push({
              source: `Web CDN (${domain})`,
              format: st.format || 'MP4',
              quality: `${resVal}p`,
              resolutionNum: resVal,
              url: st.url,
              codec: st.codecName,
              duration: st.duration,
              size: sizeBytes,
            });
          }

          if (streams.length > 0) break;
        } catch {}
      }
    } catch {}
  }

  // 3. Mobile Native CDN fallback (strictly filtered against fake update promo videos)
  if (streams.length === 0) {
    try {
      const nativeRes = await apiRequest('GET', `/wefeed-mobile-bff/subject-api/play-info?subjectId=${subjectId}&se=${season}&ep=${episode}`);
      const rawStreams = nativeRes?.data?.streams || [];
      for (const st of rawStreams) {
        if (!st.url || isFakeStream(st, minDuration) || seenUrls.has(st.url)) continue;
        const resVal = parseInt(st.resolutions || '1080', 10) || 1080;
        if (seenQualities.has(resVal)) continue;
        seenUrls.add(st.url);
        seenQualities.add(resVal);

        streams.push({
          source: 'Mobile Native CDN',
          format: st.format || 'MP4',
          quality: `${resVal}p`,
          resolutionNum: resVal,
          url: st.url,
          codec: st.codecName,
          duration: st.duration,
          size: parseInt(st.size || '0', 10) || 0,
        });
      }
    } catch (e) {
      console.warn('Native getMovieBoxStreams error:', e.message);
    }
  }

  // Sort streams: 2160p (4K) > 1080p > 720p > 480p > 360p
  streams.sort((a, b) => (b.resolutionNum || 0) - (a.resolutionNum || 0));

  return streams;
}

function normalizeTitle(t) {
  return (t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, '') // remove brackets
    .replace(/\b(part|episode|season)\s+ii\b/g, '$1 2')
    .replace(/\b(part|episode|season)\s+iii\b/g, '$1 3')
    .replace(/\b(part|episode|season)\s+iv\b/g, '$1 4')
    .replace(/\b(part|episode|season)\s+v\b/g, '$1 5')
    .replace(/\bii\b/g, '2')
    .replace(/\biii\b/g, '3')
    .replace(/\biv\b/g, '4')
    .replace(/\bv\b/g, '5')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a Movie/TV show stream via MovieBox by TMDB ID, title, year, season, and episode.
 */
export async function resolveMovieBoxStream({
  tmdbId,
  type = 'movie',
  season = 1,
  episode = 1,
  title = '',
  year = '',
  dubId = null,
  proxyBase = '/proxy',
  midmanUrl = '',
  env = null,
}) {
  let resolvedTitle = title;
  let resolvedYear = year;
  let originalTitle = '';
  let altTitles = [];
  let expectedRuntime = 0;
  const targetType = type.toLowerCase() === 'tv' ? 'tv' : 'movie';

  // 1. Fetch metadata from TMDB if title or year are missing
  if ((!resolvedTitle || !resolvedYear || !expectedRuntime) && tmdbId) {
    try {
      const tmdbData = await tmdbFetch(`${targetType}/${tmdbId}?language=en-US&append_to_response=alternative_titles`, env);
      if (tmdbData) {
        resolvedTitle = resolvedTitle || tmdbData.title || tmdbData.name || '';
        originalTitle = tmdbData.original_title || tmdbData.original_name || '';
        const dateStr = tmdbData.release_date || tmdbData.first_air_date || '';
        resolvedYear = resolvedYear || (dateStr ? dateStr.slice(0, 4) : '');
        expectedRuntime = expectedRuntime || tmdbData.runtime || (Array.isArray(tmdbData.episode_run_time) ? tmdbData.episode_run_time[0] : 0) || 0;
        const rawAlts = targetType === 'tv' ? tmdbData.alternative_titles?.results : tmdbData.alternative_titles?.titles;
        if (Array.isArray(rawAlts)) {
          altTitles = rawAlts.map((a) => a.title || a.name).filter(Boolean);
        }
      }
    } catch (e) {
      console.warn('TMDB lookup failed in MovieBox resolver:', e.message);
    }
  }

  if (!resolvedTitle) {
    throw new Error('Title could not be resolved from TMDB');
  }

  // Build list of valid normalized targets to match any TMDB format
  const normTarget = normalizeTitle(resolvedTitle);
  const normOriginal = originalTitle ? normalizeTitle(originalTitle) : null;
  const normAlts = altTitles.map((t) => normalizeTitle(t));
  const validNormTargets = [normTarget, normOriginal, ...normAlts].filter(Boolean);

  const isTargetMatch = (candTitle) => {
    const cNorm = normalizeTitle(candTitle);
    for (const target of validNormTargets) {
      if (cNorm === target) return 100;
      if (cNorm.startsWith(target) || target.startsWith(cNorm)) return 85;
      if (cNorm.includes(target) || target.includes(cNorm)) return 70;
    }
    return 0;
  };

  const targetYearNum = parseInt(resolvedYear || '0', 10);
  const subDivider = resolvedTitle.split(/[:\-–]/)[0].trim();

  // 2. Search MovieBox: try primary title, then alternate queries if needed
  const searchQueries = [resolvedTitle];
  if (originalTitle && originalTitle !== resolvedTitle) searchQueries.push(originalTitle);
  if (subDivider && subDivider.length >= 3 && subDivider !== resolvedTitle && !searchQueries.includes(subDivider)) {
    searchQueries.push(subDivider);
  }
  for (const alt of altTitles.slice(0, 3)) {
    if (alt && !searchQueries.includes(alt)) searchQueries.push(alt);
  }

  let searchResults = [];
  for (const q of searchQueries) {
    try {
      searchResults = await searchMovieBox(q);
      if (searchResults.length > 0) break;
    } catch {}
  }

  if (!searchResults.length) {
    throw new Error(`MovieBox search returned 0 results for "${resolvedTitle}"`);
  }

  // 3. Score and select matching candidates
  let candidates = searchResults.filter((r) => r.type === targetType);
  if (candidates.length === 0) {
    candidates = searchResults;
  }

  const hasBrackets = (t) => /\[.*?\]|\(.*?\)/.test(t);
  const targetHasBrackets = hasBrackets(resolvedTitle);

  const scoreCandidate = (c) => {
    let score = isTargetMatch(c.title);
    if (score === 0) return 0;

    const cleanCandTitle = c.title.trim();
    if (cleanCandTitle.toLowerCase() === resolvedTitle.toLowerCase()) {
      score += 70;
    } else if (!targetHasBrackets && !hasBrackets(cleanCandTitle)) {
      score += 45;
    } else if (!targetHasBrackets && hasBrackets(cleanCandTitle)) {
      score -= 30; // Bracketed dub titles rank below the clean original title
    }

    if (c.detail_path) score += 20;
    if (c.type === targetType) score += 15;

    const cYear = parseInt((c.release_date || '').slice(0, 4), 10) || 0;
    if (targetYearNum && cYear) {
      const diff = Math.abs(cYear - targetYearNum);
      if (diff === 0) score += 25;
      else if (diff === 1) score += 10;
      else score -= 30;
    }

    return score;
  };

  const matchingCandidates = candidates.filter((c) => isTargetMatch(c.title) > 0).sort((a, b) => {
    return scoreCandidate(b) - scoreCandidate(a);
  });

  if (matchingCandidates.length === 0) {
    matchingCandidates.push(candidates[0]);
  }

  let matched = matchingCandidates[0];

  // 4. Discover dubs
  const details = await getMovieBoxDetails(matched.subject_id);
  const formattedDubs = [
    { id: matched.subject_id, label: 'Original', detail_path: details.detail_path || matched.detail_path },
    ...details.dubs
      .filter((d) => d.subject_id !== matched.subject_id)
      .map((d) => {
        let label = d.lang_name ? d.lang_name.trim() : 'Dub';
        const lower = label.toLowerCase();
        if (lower.startsWith('esla')) label = 'Spanish dub';
        else if (lower.startsWith('ptbr')) label = 'Portuguese dub';
        else if (!lower.includes('dub') && !lower.includes('audio')) {
          label = `${label.charAt(0).toUpperCase() + label.slice(1)} Dub`;
        } else {
          label = label.charAt(0).toUpperCase() + label.slice(1);
        }
        return {
          id: d.subject_id,
          label,
          detail_path: '',
        };
      }),
  ];

  // Also check if searchResults contains sibling dubs or alternate audio subjects with same base title and year
  let unverifiedCounter = 0;
  for (const sr of searchResults) {
    if (sr.subject_id === matched.subject_id) continue;
    const srYear = parseInt((sr.release_date || '').slice(0, 4), 10) || 0;
    if (targetYearNum && srYear && Math.abs(srYear - targetYearNum) > 1) continue;
    if (isTargetMatch(sr.title) > 0) {
      const dubMatch = sr.title.match(/\[(.*?)\]|\((.*?)\)/);
      if (dubMatch) {
        const rawTag = (dubMatch[1] || dubMatch[2]).trim();
        if (IGNORE_TAG_REGEX.test(rawTag)) continue;
        if (!VALID_DUB_REGEX.test(rawTag)) continue;

        let dubTag = rawTag;
        const lowerTag = dubTag.toLowerCase();
        if (lowerTag.startsWith('esla')) dubTag = 'Spanish dub';
        else if (lowerTag.startsWith('ptbr')) dubTag = 'Portuguese dub';
        else if (!lowerTag.includes('dub')) dubTag = `${dubTag} Dub`;

        const existing = formattedDubs.find((d) => d.id === sr.subject_id || d.label.toLowerCase().includes(rawTag.toLowerCase()));
        if (!existing) {
          formattedDubs.push({
            id: sr.subject_id,
            label: dubTag,
            detail_path: sr.detail_path || '',
          });
        } else if (!existing.detail_path && sr.detail_path) {
          existing.detail_path = sr.detail_path;
        }
      } else {
        if (sr.type !== targetType) continue;
        if (IGNORE_TAG_REGEX.test(sr.title)) continue;

        const existing = formattedDubs.find((d) => d.id === sr.subject_id);
        if (!existing) {
          unverifiedCounter++;
          const label = sr.language && sr.language !== 'English' && sr.language !== 'en'
            ? `${sr.language} (Unverified)`
            : (unverifiedCounter > 1 ? `Other Audio #${unverifiedCounter} (Unverified)` : 'Other Audio (Unverified)');
          formattedDubs.push({
            id: sr.subject_id,
            label,
            detail_path: sr.detail_path || '',
          });
        }
      }
    }
  }

  // 5. Fetch streams: if dubId is specified use that, otherwise try candidates
  const se = targetType === 'tv' ? season : 0;
  const ep = targetType === 'tv' ? episode : 0;
  const minDuration = 60;
  let playSubjectId = matched.subject_id;
  let streams = [];

  const cleanDubId = dubId ? String(dubId).replace(/^-/, '').trim() : null;
  if (cleanDubId) {
    const targetDub = formattedDubs.find((d) => d.id === cleanDubId || d.id === dubId || d.id.replace(/^-/, '') === cleanDubId);
    if (targetDub) {
      playSubjectId = targetDub.id;
      let playDetailPath = targetDub.detail_path;
      streams = await getMovieBoxStreams(playSubjectId, se, ep, playDetailPath, minDuration);

      // Graceful fallback: if selected dub subject has no streams, fall back to matched streams
      if (streams.length === 0) {
        console.warn(`Dub "${targetDub.label}" (ID ${playSubjectId}) had no streams. Falling back to primary stream.`);
        playSubjectId = matched.subject_id;
        let cDetailPath = matched.detail_path;
        streams = await getMovieBoxStreams(matched.subject_id, se, ep, cDetailPath, minDuration, details);
      }
    }
  } else {
    // Try primary matched candidate first with prefetched details
    streams = await getMovieBoxStreams(matched.subject_id, se, ep, matched.detail_path, minDuration, details);

    // If needed, probe other candidates in order
    if (streams.length === 0 || (streams[0]?.resolutionNum || 0) < 1080) {
      for (const c of matchingCandidates) {
        if (c.subject_id === matched.subject_id) continue;
        let cDetailPath = c.detail_path;
        if (!cDetailPath) {
          try {
            const cDet = await getMovieBoxDetails(c.subject_id);
            cDetailPath = cDet.detail_path || '';
          } catch {}
        }
        const candStreams = await getMovieBoxStreams(c.subject_id, se, ep, cDetailPath, minDuration);
        if (candStreams.length > 0) {
          const topRes = candStreams[0].resolutionNum || 0;
          const curRes = streams[0]?.resolutionNum || 0;
          if (!streams.length || topRes > curRes) {
            streams = candStreams;
            matched = c;
            playSubjectId = c.subject_id;
            if (topRes >= 1080) break;
          }
        }
      }
    }
  }

  if (streams.length === 0) {
    throw new Error(`No streams available on MovieBox for "${matched.title}"`);
  }

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const isTv = targetType === 'tv';
  const epTag = isTv ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : (resolvedYear ? `(${resolvedYear})` : '');
  const activeDubObj = formattedDubs.find((d) => d.id === playSubjectId);
  const dubTag = activeDubObj && !activeDubObj.label.startsWith('Original') ? `[${activeDubObj.label}]` : '';

  const formattedStreams = streams.map((s) => {
    const qualityTag = s.quality || 'HD';
    const fileBase = [matched.title, epTag, dubTag, `[${qualityTag}]`].filter(Boolean).join(' ').trim();
    const downloadFileName = `${fileBase}.mp4`;
    const isDirectAppCdn = !s.url.includes('bcdnxw') && /hakunaymatata|aoneroom/.test(s.url);
    const midman = (midmanUrl || 'https://zenkai-movies-production.up.railway.app').replace(/\/+$/, '');
    const midmanProxyUrl = `${midman}/proxy?url=${encodeURIComponent(s.url)}${isDirectAppCdn ? '' : '&referer=' + encodeURIComponent('https://123moviesfree.club/')}`;
    const baseProxy = (proxyBase || '/proxy').replace(/\?url=.*$/, '').replace(/\/+$/, '');
    const edgeProxyUrl = `${baseProxy}?url=${encodeURIComponent(s.url)}${isDirectAppCdn ? '' : '&referer=' + encodeURIComponent('https://123moviesfree.club/')}`;

    // Direct App CDN (movies) -> Railway midman proxy (Singapore)
    // Web Mirror CDN (bcdnxw for TV series & dubs) -> Local/Edge proxy
    const effectiveProxyUrl = isDirectAppCdn ? midmanProxyUrl : edgeProxyUrl;
    const isHls = /\.m3u8/i.test(s.url);
    const streamUrl = isHls ? `${effectiveProxyUrl}&seg=1` : effectiveProxyUrl;
    const downloadUrl = `${effectiveProxyUrl}&dl=1&fn=${encodeURIComponent(downloadFileName)}`;

    return {
      quality: s.quality,
      resolutionNum: s.resolutionNum,
      format: s.format,
      size: s.size,
      sizeLabel: formatSize(s.size),
      duration: s.duration || 0,
      url: s.url,
      streamUrl,
      downloadUrl,
      downloadFileName,
    };
  });

  const bestStream = formattedStreams[0];

  return {
    success: true,
    server: 'MovieBox',
    subjectId: playSubjectId,
    title: matched.title,
    streamUrl: bestStream.streamUrl,
    downloadUrl: bestStream.downloadUrl,
    rawStreamUrl: bestStream.url,
    quality: bestStream.quality,
    format: bestStream.format,
    duration: bestStream.duration || 0,
    dubs: formattedDubs.map((d) => ({ id: d.id, label: d.label, selected: d.id === playSubjectId })),
    streams: formattedStreams,
    referer: 'https://123moviesfree.club/',
  };
}
