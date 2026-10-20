// Zenkai Shield (server): proof-of-work challenge -> short-lived HMAC token, plus per-IP rate limits.
// Web-standard APIs only, so it runs in Cloudflare Pages Functions and in the Vite dev server.
// Needs env.SHIELD_SECRET (wrangler pages secret). Without it the shield is off and everything passes.

const TOKEN_TTL = 86400; // seconds a token stays valid (24 hours, covers the entire session)
const CHALLENGE_TTL = 90;
const DIFFICULTY = 3; // leading hex zeros (~4k hashes, a few ms in the browser)

// [max requests, per 60s]
const LIMITS = { shield: [30, 60], proxy: [180, 60], stream: [30, 60], subtitles: [40, 60], novel: [60, 60], manga: [60, 60], default: [120, 60] };

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const hmac = async (data, secret) => {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
};
const safeEq = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

const clientIp = (r) =>
  r.headers.get("CF-Connecting-IP") || r.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "0.0.0.0";
const ipHash = async (r, secret) => (await hmac(`ip:${clientIp(r)}`, secret)).slice(0, 16);

/* ---------- captcha (self-contained SVG, no third party) ---------- */
const CHARS = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
function captchaImage() {
  const r = crypto.getRandomValues(new Uint8Array(48));
  const text = [...r.slice(0, 5)].map((b) => CHARS[b % CHARS.length]).join("");
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60" viewBox="0 0 180 60"><rect width="180" height="60" rx="12" fill="#17171b"/>';
  for (let i = 0; i < 5; i++)
    svg += `<path d="M${r[5 + i] % 30} ${r[10 + i] % 60} Q${60 + (r[15 + i] % 60)} ${r[20 + i] % 60} ${150 + (r[25 + i] % 30)} ${r[30 + i] % 60}" stroke="hsl(${r[35 + i] * 1.4} 60% 55%)" stroke-width="1.6" fill="none" opacity=".7"/>`;
  [...text].forEach((c, i) => {
    const x = 20 + i * 30;
    svg += `<text x="${x}" y="${38 + (r[40 + i] % 10)}" font-size="${28 + (r[40 + i] % 8)}" font-family="monospace" font-weight="800" fill="hsl(${r[40 + i] * 1.4} 80% 72%)" transform="rotate(${(r[40 + i] % 41) - 20} ${x} 30)">${c}</text>`;
  });
  return { text, svg: svg + "</svg>" };
}

/* ---------- challenge + token ---------- */
// Captcha only when something looks off: the client says DevTools were opened (?cap=1), no UA / bot UA / no Accept-Language, or this IP keeps asking for challenges.
const suspicious = (request, url) => {
  const ua = request.headers.get("User-Agent") || "";
  return (
    url.searchParams.get("cap") === "1" ||
    !ua ||
    /bot|crawl|spider|headless|curl|wget|python|scrapy|httpclient|axios|node-fetch/i.test(ua) ||
    !request.headers.get("Accept-Language") ||
    (hits.get(`shield:${clientIp(request)}`)?.n ?? 0) > 12
  );
};

async function challenge(request, secret, url) {
  const cid = crypto.randomUUID();
  const salt = hex(crypto.getRandomValues(new Uint8Array(8)));
  const t = Math.floor(Date.now() / 1000);
  const ih = await ipHash(request, secret);
  const cap = suspicious(request, url) ? 1 : 0;
  const { text, svg } = captchaImage();
  const capSig = await hmac(`cap:${cid}:${text}:${t}:${ih}`, secret);
  return {
    cid,
    salt,
    difficulty: DIFFICULTY,
    t,
    cap,
    sig: await hmac(`${cid}:${salt}:${DIFFICULTY}:${t}:${cap}:${ih}`, secret),
    svg,
    capSig,
  };
}

/** Returns { token, expiresIn } or { code } when the proof is rejected. */
async function verify(body, request, secret) {
  const { cid, salt, difficulty, t, cap, sig, nonce, answer, capSig } = body || {};
  const bad = { code: "SHIELD_BAD_PROOF" };
  if (!cid || !salt || !t || !sig || typeof difficulty !== "number" || typeof nonce !== "number") return bad;
  const now = Math.floor(Date.now() / 1000);
  if (now - t > CHALLENGE_TTL || t > now + 30) return bad;
  const ih = await ipHash(request, secret);
  if (!safeEq(await hmac(`${cid}:${salt}:${difficulty}:${t}:${cap}:${ih}`, secret), String(sig))) return bad;
  if (difficulty < DIFFICULTY || !(await sha256(`${cid}:${salt}:${nonce}`)).startsWith("0".repeat(difficulty))) return bad;
  if (cap) {
    const guess = String(answer || "").trim().toUpperCase();
    if (!guess || !safeEq(await hmac(`cap:${cid}:${guess}:${t}:${ih}`, secret), String(capSig || ""))) return { code: "SHIELD_CAPTCHA_WRONG" };
  }
  const exp = now + TOKEN_TTL;
  return { token: `${ih}.${exp}.${await hmac(`${ih}.${exp}`, secret)}`, expiresIn: TOKEN_TTL };
}

async function tokenOk(token, request, secret) {
  const [ih, exp, sig] = String(token || "").split(".");
  if (!ih || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEq(await hmac(`${ih}.${exp}`, secret), sig) && safeEq(ih, await ipHash(request, secret));
}

/* ---------- rate limit (per isolate; cheap burst control) ---------- */
const hits = new Map();
function limited(ip, cat) {
  const [max, win] = LIMITS[cat] || LIMITS.default;
  const now = Date.now();
  const k = `${cat}:${ip}`;
  let h = hits.get(k);
  if (!h || now > h.reset) {
    if (hits.size > 2000) for (const [key, v] of hits) if (now > v.reset) hits.delete(key);
    hits.set(k, (h = { n: 0, reset: now + win * 1000 }));
  }
  return ++h.n > max ? Math.ceil((h.reset - now) / 1000) : 0;
}

const categoryOf = (path) =>
  path === "/proxy" || path === "/api/proxy" ? "proxy" : (path.match(/^\/api\/(stream|subtitles|novel|manga)\b/)?.[1] ?? "default");

/**
 * Called first thing in handle(). Returns a Response when the request is answered or blocked here,
 * or null to let it continue. `json(data, status)` is the handler's own JSON helper (keeps CORS headers).
 */
export async function shield(request, env, path, json) {
  if (env?.IS_DEV) return null;
  const secret = env?.SHIELD_SECRET || "zenkai-shield-v1-secret-2026";
  if (path === "/api/shield/challenge" || path === "/api/shield/verify") {
    const retry = limited(clientIp(request), "shield");
    if (retry) return json({ error: "Too many requests", retryAfter: retry }, 429);
    if (path.endsWith("challenge")) return json(await challenge(request, secret, new URL(request.url)));
    if (request.method !== "POST") return json({ error: "Not available" }, 404);
    const out = await verify(await request.json().catch(() => null), request, secret);
    return out.token ? json({ success: true, ...out }) : json({ error: "Verification failed", code: out.code }, 403);
  }
  if (request.method === "OPTIONS" || !(path.startsWith("/api/") || path === "/proxy")) return null;

  const cat = categoryOf(path);
  const retry = limited(clientIp(request), cat);
  if (retry) return json({ error: "Too many requests", retryAfter: retry }, 429);

  // Media (hls.js / <img>) and iframe embeds (/api/embed/*) can't send custom headers: they only get the rate limit. The Android app is let through the same way.
  const app = /Aniverse\/|Zenkai/i.test(request.headers.get("User-Agent") || "") || request.headers.has("X-Zenkai-Client");
  if (cat === "proxy" || app || path.startsWith("/api/embed/")) return null;

  const token = request.headers.get("X-Zenkai-Shield");
  if (!token) return json({ error: "Verification required", code: "SHIELD_VERIFICATION_REQUIRED" }, 401);
  if (!(await tokenOk(token, request, secret))) return json({ error: "Invalid or expired token", code: "SHIELD_TOKEN_INVALID" }, 403);
  return null;
}
