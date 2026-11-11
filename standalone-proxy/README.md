# Zenkai Universal Edge & Streaming Proxy for Lovable

High-performance, edge-accelerated streaming proxy and cache for Zenkai (Android APK & Web).

## Features
- **Universal Client Access**: Works out of the box with the Zenkai Android APK (ExoPlayer), Zenkai Web (`zenkaii.pages.dev`, `zenkai.cfd`), localhost, and any custom domain.
- **Smart Referer Spoofing**:
  - MovieBox TV Series: `bcdnxw.hakunaymatata.com` (spoofs `Referer: https://123moviesfree.club/` to prevent 429)
  - MovieBox Movies: `bcdn.hakunaymatata.com` (community CDN, strips Referer to prevent 429)
  - FlixCloud / ReAnime: `https://flixcloud.cc/`
  - MegaPlay / RabbitStream / Vidstreaming: `https://megaplay.buzz/`
  - AnimeSalt / ACDN: `https://animesalt.cx/`
  - Subtitles / Stremio: `https://opensubtitles.org/`
- **HLS M3U8 Manifest Rewriting**: Sub-playlists, audio tracks, and AES-128 encryption keys (`#EXT-X-KEY`) automatically route back through this proxy.
- **Direct Segment Streaming**: Native `Range` request and `206 Partial Content` support for fast seeking in ExoPlayer and browsers.
- **Decreased Cloudflare Worker Hits**:
  - Built-in LRU/memory caching for AniList ID mappings (`/map/:id`), OpenSubtitles (`/subtitles`), and episodes (`/episodes/:id`).

---

## Endpoints
- `GET /api/public/proxy?url=<target>&referer=<custom>` or `GET /proxy?url=...`: Streaming proxy.
- `GET /map/:anilistId` or `GET /api/public/map/:anilistId`: Cached AniList to MAL / TMDB / TVDB ID mapping (24h cache).
- `GET /episodes/:anilistId` or `GET /api/public/episodes/:anilistId`: Cached episode listings and audio availability (1h cache).
- `GET /subtitles?imdb=<id>&s=<season>&e=<episode>`: Subtitles search with cache.

---

## Cloudflare Pages Configuration (Zenkai Web)
Under **Cloudflare Dashboard > Workers & Pages > Zenkai > Settings > Environment variables**:
- **Variable Name**: `STREAM_PROXY_URL`
- **Value**: `https://<your-new-lovable-or-worker-domain>/api/public/proxy`
