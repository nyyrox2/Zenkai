// Converted from Zenkai Android ReAnimeResolver.kt & cloudflare-worker FlixCloud extractor.
// Resolves FlixCloud (Re:Anime) direct HLS streams mapped natively by AniList ID and episode.

import { resolveMegaPlay } from "./direct-stream.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://reanime.to";
const FLIX = "https://flixcloud.cc";
const ENC_DEC = "https://enc-dec.app";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256hex(value) {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    typeof value === "string" ? encoder.encode(value) : value
  );
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64toU8(value) {
  if (!value) return new Uint8Array(0);
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveFields(seed) {
  let first = seed;
  for (let i = 0; i < 3; i++) first = await sha256hex(first + i);
  let second = first;
  for (let i = 0; i < 3; i++) second = await sha256hex(second + i);
  return {
    keyField: "kf_" + first.substring(8, 16),
    ivField: "ivf_" + first.substring(16, 24),
    containerName: "cd_" + first.substring(24, 32),
    arrayName: "ad_" + first.substring(32, 40),
    objectName: "od_" + first.substring(40, 48),
    tokenField: first.substring(48, 64) + "_" + first.substring(56, 64),
    keyFrag2Field: second.substring(0, 16) + "_" + second.substring(16, 24)
  };
}

function extractSsrObj(html) {
  const match = html.match(/\{type:"data",data:(\{)/);
  if (!match) throw new Error("SSR data block not found");
  let depth = 0;
  const start = html.indexOf("{", match.index + match[0].length - 1);
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error("SSR brace matching failed");
}

function parseJsLiteral(source) {
  let index = 0;
  function whitespace() {
    while (index < source.length && /\s/.test(source[index])) index++;
  }
  function doubleString() {
    let out = "";
    index++;
    while (index < source.length && source[index] !== '"') {
      if (source[index] === "\\") {
        index++;
        out += { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" }[source[index]] ?? source[index];
        index++;
      } else out += source[index++];
    }
    index++;
    return out;
  }
  function singleString() {
    let out = "";
    index++;
    while (index < source.length && source[index] !== "'") {
      if (source[index] === "\\") {
        index++;
        out += source[index] === "'" ? "'" : { n: "\n", t: "\t", r: "\r", "\\": "\\" }[source[index]] ?? source[index];
        index++;
      } else out += source[index++];
    }
    index++;
    return out;
  }
  function key() {
    whitespace();
    if (source[index] === '"') return doubleString();
    if (source[index] === "'") return singleString();
    const match = source.slice(index).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (!match) throw new Error(`Bad key at pos ${index}`);
    index += match[0].length;
    return match[0];
  }
  function object() {
    const out = {};
    index++;
    whitespace();
    while (index < source.length && source[index] !== "}") {
      if (source[index] === ",") {
        index++;
        whitespace();
        continue;
      }
      const property = key();
      whitespace();
      index++;
      out[property] = value();
      whitespace();
    }
    index++;
    return out;
  }
  function array() {
    const out = [];
    index++;
    whitespace();
    while (index < source.length && source[index] !== "]") {
      if (source[index] === ",") {
        index++;
        whitespace();
        continue;
      }
      out.push(value());
      whitespace();
    }
    index++;
    return out;
  }
  function value() {
    whitespace();
    if (source[index] === "{") return object();
    if (source[index] === "[") return array();
    if (source[index] === '"') return doubleString();
    if (source[index] === "'") return singleString();
    if (source.startsWith("true", index)) {
      index += 4;
      return true;
    }
    if (source.startsWith("false", index)) {
      index += 5;
      return false;
    }
    if (source.startsWith("null", index)) {
      index += 4;
      return null;
    }
    if (source.startsWith("undefined", index)) {
      index += 9;
      return null;
    }
    if (source.startsWith("!0", index)) {
      index += 2;
      return true;
    }
    if (source.startsWith("!1", index)) {
      index += 2;
      return false;
    }
    const match = source.slice(index).match(/^-?[\d.]+([eE][+-]?\d+)?/);
    if (match) {
      index += match[0].length;
      return parseFloat(match[0]);
    }
    throw new Error(`JS parse error at pos ${index}`);
  }
  return value();
}

function parseWasmDecrypt(bytes) {
  let position = 8;
  while (position < bytes.length) {
    const section = bytes[position++];
    let size = 0;
    let shift = 0;
    let next;
    do {
      next = bytes[position++];
      size |= (next & 127) << shift;
      shift += 7;
    } while (next & 128);
    if (section === 10) {
      position++;
      let bodySize = 0;
      let bodyShift = 0;
      do {
        next = bytes[position++];
        bodySize |= (next & 127) << bodyShift;
        bodyShift += 7;
      } while (next & 128);
      position += bodySize;
      break;
    }
    position += size;
  }
  let functionSize = 0;
  let functionShift = 0;
  let next;
  do {
    next = bytes[position++];
    functionSize |= (next & 127) << functionShift;
    functionShift += 7;
  } while (next & 128);
  const body = bytes.slice(position, position + functionSize);
  function leb(array, index) {
    let value = 0;
    let shift = 0;
    let next;
    do {
      next = array[index++];
      value |= (next & 127) << shift;
      shift += 7;
    } while (next & 128);
    return [value, index];
  }
  const xorEnd = [32, 2, 32, 5, 106, 45, 0, 0, 115, 33, 6];
  let transformStart = -1;
  outer: for (let i = 0; i < body.length - xorEnd.length; i++) {
    for (let j = 0; j < xorEnd.length; j++) if (body[i + j] !== xorEnd[j]) continue outer;
    transformStart = i + xorEnd.length;
    break;
  }
  if (transformStart < 0) throw new Error("WASM: transform start not found");
  let transformEnd = -1;
  let step = 36;
  for (let i = transformStart; i < body.length - 4; i++) {
    if (body[i] === 32 && body[i + 1] === 5 && body[i + 2] === 65) {
      const [value, nextIndex] = leb(body, i + 3);
      if (body[nextIndex] === 108) {
        transformEnd = i;
        step = value;
        break;
      }
    }
  }
  if (transformEnd < 0) throw new Error("WASM: keystream not found");
  const code = body.slice(transformStart, transformEnd);
  function transform(inputByte) {
    let local = inputByte & 255;
    const stack = [];
    let index = 0;
    while (index < code.length) {
      const opcode = code[index++];
      if (opcode === 32) {
        const [localIndex, nextIndex] = leb(code, index);
        index = nextIndex;
        stack.push(localIndex === 6 ? local : 0);
      } else if (opcode === 33) {
        const [localIndex, nextIndex] = leb(code, index);
        index = nextIndex;
        const value = stack.pop();
        if (localIndex === 6) local = value & 255;
      } else if (opcode === 65) {
        const [value, nextIndex] = leb(code, index);
        index = nextIndex;
        stack.push(value);
      } else if (opcode === 106) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push((left + right) & 255);
      } else if (opcode === 107) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push((left - right + 256) & 255);
      } else if (opcode === 113) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push((left & right) & 255);
      } else if (opcode === 114) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push((left | right) & 255);
      } else if (opcode === 115) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push((left ^ right) & 255);
      } else if (opcode === 116) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push((left << (right & 7)) & 255);
      } else if (opcode === 118) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push((left >>> (right & 7)) & 255);
      }
    }
    return local;
  }
  return { step, transform };
}

function runDecrypt(wasmBytes, fragment, keyFragment, token, seed) {
  const { step, transform } = parseWasmDecrypt(wasmBytes);
  const out = new Uint8Array(fragment.length);
  for (let i = 0; i < fragment.length; i++) {
    const value = fragment[i] ^ keyFragment[i] ^ (token[i] & 255);
    out[i] = (transform(value) ^ (i * step + seed)) & 255;
  }
  return out;
}

/**
 * Local FlixCloud decryption using pure Web Crypto (no external decrypt API dependency).
 */
async function decryptFlixcloudLocal(data) {
  const seed = data.obfuscation_seed;
  if (!seed) throw new Error("obfuscation_seed missing");
  const fields = await deriveFields(seed);
  const cryptoData = data.obfuscated_crypto_data;
  if (!cryptoData) throw new Error("obfuscated_crypto_data missing");
  const container = cryptoData[fields.containerName];
  if (!container) throw new Error(`containerName ${fields.containerName} missing`);
  const array = container[fields.arrayName];
  if (!array) throw new Error(`arrayName ${fields.arrayName} missing`);
  const object = array[0][fields.objectName];
  if (!object) throw new Error(`objectName ${fields.objectName} missing`);

  const fragment = b64toU8(object[fields.keyField]);
  const iv = b64toU8(object[fields.ivField]);
  const keyFragmentRaw = data[fields.keyFrag2Field];
  if (!keyFragmentRaw) throw new Error(`kf2 field ${fields.keyFrag2Field} missing`);
  const keyFragment = b64toU8(keyFragmentRaw);
  const token = data[fields.tokenField];
  if (!token) throw new Error(`tokenField ${fields.tokenField} missing`);

  const tokenResponse = await fetch(`${FLIX}/api/m3u8/${token}`, {
    headers: { "User-Agent": UA, Referer: `${BASE}/` }
  });
  if (!tokenResponse.ok) throw new Error(`Token API ${tokenResponse.status}`);
  const tokenData = await tokenResponse.json();

  const videoKey = (await sha256hex(token + "vid")).substring(0, 10);
  const tokenKey = (await sha256hex(token + "key")).substring(0, 10);
  const videoBytes = b64toU8(tokenData[videoKey]);
  const tokenBytes = b64toU8(tokenData[tokenKey]);
  if (!videoBytes.length || !tokenBytes.length) throw new Error("Token fields missing");

  const seedNumber = parseInt(seed.substring(0, 8), 16);
  const wasmPayload = b64toU8(data.w_payload ?? "");
  if (!wasmPayload.length) throw new Error("w_payload missing");

  const wasmOut = runDecrypt(wasmPayload, fragment, keyFragment, tokenBytes, seedNumber);
  const material = await globalThis.crypto.subtle.importKey("raw", wasmOut, { name: "PBKDF2" }, false, ["deriveBits"]);
  const derived = new Uint8Array(
    await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: encoder.encode(seed), iterations: 1000, hash: "SHA-256" },
      material,
      256
    )
  );
  for (let i = 0; i < 32; i++) derived[i] ^= seed.charCodeAt(i % seed.length);
  const aesKeyBytes = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", derived));
  const aesKey = await globalThis.crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-CBC", iv }, aesKey, videoBytes);
  const url = decoder.decode(plain).trim().replace(/\0+$/, "");
  if (!url.startsWith("http")) throw new Error(`Unexpected decrypted URL: ${url.substring(0, 60)}`);
  return { streamUrl: url, wPayload: data.w_payload || "" };
}

/**
 * Decrypt stream URL via enc-dec.app (mirrors ReAnimeResolver.kt).
 */
async function decryptFlixcloudEncDec(dataObj) {
  const clone = { ...dataObj };
  delete clone.subtitles;

  // 1. Decrypt token
  const tokenReq = await fetch(`${ENC_DEC}/api/dec-flixcloud?type=token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ data: clone })
  });
  if (!tokenReq.ok) throw new Error(`Token dec status ${tokenReq.status}`);
  const tokenJson = await tokenReq.json();
  if (tokenJson.status !== 200 || !tokenJson.result?.token) throw new Error("Invalid token dec response");
  const token = tokenJson.result.token;
  const context = tokenJson.result.context;

  // 2. Fetch Token M3u8 Response from Flixcloud
  const m3u8Req = await fetch(`${FLIX}/api/m3u8/${token}`, {
    headers: { "User-Agent": UA, Referer: `${FLIX}/` }
  });
  if (!m3u8Req.ok) throw new Error(`Flix m3u8 status ${m3u8Req.status}`);
  const streamData = await m3u8Req.json();

  // 3. Decrypt Stream URL
  const streamDecReq = await fetch(`${ENC_DEC}/api/dec-flixcloud?type=stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ data: { context, stream_response: streamData } })
  });
  if (!streamDecReq.ok) throw new Error(`Stream dec status ${streamDecReq.status}`);
  const streamDecJson = await streamDecReq.json();
  if (streamDecJson.status !== 200 || !streamDecJson.result?.stream) throw new Error("Invalid stream dec response");

  return {
    streamUrl: streamDecJson.result.stream,
    wPayload: streamDecJson.result.context?.w_payload || clone.w_payload || ""
  };
}

/**
 * Resolves a single server object from Re:Anime flix response.
 */
async function resolveSingleServer(serverObj, targetAudio) {
  const dataLink = serverObj.dataLink;
  if (!dataLink) return null;

  const embedRes = await fetch(dataLink, {
    headers: { "User-Agent": UA, Referer: `${BASE}/` }
  });
  if (!embedRes.ok) return null;
  const html = await embedRes.text();

  let dataObj = null;
  try {
    dataObj = parseJsLiteral(extractSsrObj(html));
  } catch {
    const dataMatch = html.match(/type:\s*"data",\s*data:\s*(\{[\s\S]*?\})\s*,\s*uses:/);
    if (!dataMatch) return null;
    const fixed = dataMatch[1].replace(/([{,])(\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:\s*)(?=["'\[{0-9tfn\-])/g, '$1$2"$3"$4');
    dataObj = JSON.parse(fixed);
  }
  if (!dataObj) return null;

  // Extract subtitles and chapters
  const rawSubs = Array.isArray(dataObj.subtitles) ? dataObj.subtitles : [];
  const subtitles = rawSubs.map((s, i) => ({
    file: s.url,
    label: s.language || "English",
    default: !!s.default || i === 0
  })).filter(s => !!s.file);

  const intro = dataObj.intro_chapter ? {
    start: Number(dataObj.intro_chapter.start) || 0,
    end: Number(dataObj.intro_chapter.end) || 0
  } : null;

  const outro = dataObj.outro_chapter ? {
    start: Number(dataObj.outro_chapter.start) || 0,
    end: Number(dataObj.outro_chapter.end) || 0
  } : null;

  // Decrypt stream URL: try enc-dec.app first (matches Kotlin ReAnimeResolver), fallback to local WebCrypto
  let dec = null;
  try {
    dec = await decryptFlixcloudEncDec(dataObj);
  } catch (encErr) {
    try {
      dec = await decryptFlixcloudLocal(dataObj);
    } catch (locErr) {
      console.warn("FlixCloud decryption failed:", encErr.message, locErr.message);
      return null;
    }
  }

  if (!dec?.streamUrl || !dec.streamUrl.startsWith("http")) return null;

  // Build manifest URL through enc-dec parse-flixcloud (which decodes HLS m3u8 playlist into standard #EXTM3U)
  const manifestUrl = `${ENC_DEC}/api/parse-flixcloud?url=${encodeURIComponent(dec.streamUrl)}&w_payload=${encodeURIComponent(dec.wPayload)}`;

  const isServer2 = serverObj.serverName?.includes("2") || dataLink.includes("v=2");
  const sName = "FlixCloud";

  return {
    server: sName,
    serverId: isServer2 ? `flixcloud-2` : `flixcloud`,
    streamUrl: manifestUrl,
    audio: targetAudio,
    subtitles,
    intro,
    outro,
    referer: `${FLIX}/`
  };
}

/**
 * Main FlixCloud Resolver (Converted directly from ReAnimeResolver.kt).
 * Tier 1: Re:Anime Flix API + EncDec / Local Decryption.
 * Tier 2: Seamless fallback to MegaPlay / Vidstream if FlixCloud has no source.
 */
export async function resolveFlixCloud({ anilistId, episode = 1, audio = "sub", preferredServer = "1", title = "" }) {
  const targetAudio = audio.toLowerCase() === "dub" ? "dub" : "sub";

  // Tier 1: Client-Side Re:Anime Flix API
  if (anilistId) {
    try {
      const flixRes = await fetch(`${BASE}/api/flix/${anilistId}/${episode}`, {
        headers: { "User-Agent": UA, Accept: "application/json" }
      });
      if (flixRes.ok) {
        const flixJson = await flixRes.json();
        if (flixJson?.success && Array.isArray(flixJson.servers) && flixJson.servers.length > 0) {
          const matchingServers = [];
          for (const s of flixJson.servers) {
            const dt = (s.dataType || "").toLowerCase();
            if (targetAudio === "dub" && dt.includes("dub")) {
              matchingServers.push(s);
            } else if (targetAudio === "sub" && (dt.includes("sub") || dt.includes("raw"))) {
              matchingServers.push(s);
            }
          }

          if (matchingServers.length === 0 && targetAudio !== "dub") {
            matchingServers.push(flixJson.servers[0]);
          }

          const isSrv2 = (s) => (s.serverName || "").includes("2") || (s.dataLink || "").includes("v=2");
          const sortedServers = preferredServer.includes("2")
            ? matchingServers.slice().sort((a, b) => (isSrv2(b) ? 1 : 0) - (isSrv2(a) ? 1 : 0))
            : matchingServers.slice().sort((a, b) => (isSrv2(a) ? 1 : 0) - (isSrv2(b) ? 1 : 0));

          for (const srv of sortedServers) {
            const res = await resolveSingleServer(srv, targetAudio);
            if (res && res.streamUrl && !res.streamUrl.includes("slopnet")) {
              return res;
            }
          }
        }
      }
    } catch (e) {
      console.warn("FlixCloud Tier 1 resolution error:", e.message);
    }
  }

  // Tier 2: Seamless Fallback to Verified HLS Providers (MegaPlay / Vidstream)
  // Exactly matching ReAnimeResolver.kt lines 62-76
  try {
    const fallback =
      (await resolveMegaPlay(anilistId, episode, targetAudio, "bcdn", title)) ||
      (await resolveMegaPlay(anilistId, episode, targetAudio, "vidstream", title));

    if (fallback && fallback.audio?.toLowerCase() === targetAudio) {
      return {
        ...fallback,
        server: "FlixCloud",
        serverId: `flixcloud-${targetAudio}`
      };
    }
  } catch (e) {
    console.warn("FlixCloud Tier 2 fallback error:", e.message);
  }

  return null;
}

/**
 * Resolves Re:Anime iframe embed player URL (HD-2 / Server 2).
 */
export async function resolveReanimeEmbed({ anilistId, episode = 1, audio = "sub" }) {
  if (!anilistId) return null;
  const targetAudio = audio.toLowerCase() === "dub" ? "dub" : "sub";
  try {
    const flixRes = await fetch(`${BASE}/api/flix/${anilistId}/${episode}`, {
      headers: { "User-Agent": UA, Accept: "application/json" }
    });
    if (!flixRes.ok) return null;
    const flixJson = await flixRes.json();
    if (!flixJson?.success || !Array.isArray(flixJson.servers) || flixJson.servers.length === 0) return null;

    const matchingServers = [];
    for (const s of flixJson.servers) {
      const dt = (s.dataType || "").toLowerCase();
      if (targetAudio === "dub" && dt.includes("dub")) {
        matchingServers.push(s);
      } else if (targetAudio === "sub" && (dt.includes("sub") || dt.includes("raw"))) {
        matchingServers.push(s);
      }
    }

    if (matchingServers.length === 0 && targetAudio !== "dub") {
      matchingServers.push(flixJson.servers[0]);
    }

    // Prefer HD-2 as it uses the dedicated embed player
    const isSrv2 = (s) => (s.serverName || "").includes("2") || (s.dataLink || "").includes("v=2");
    const server = matchingServers.find(isSrv2) || matchingServers[0] || flixJson.servers[0];
    return server?.dataLink || null;
  } catch (e) {
    console.warn("resolveReanimeEmbed error:", e.message);
    return null;
  }
}
