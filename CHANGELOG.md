# Changelog

All notable changes to the Zenkai Web application will be documented in this file.

## [1.0.1] - 2026-10-19

### 🚀 New Features & Providers
- **FlixCloud Direct HLS Server**:
  - Integrated native FlixCloud extractor adapted from Zenkai Android (`ReAnimeResolver.kt`) into Web-standard JavaScript (`server/flixcloud.js`).
  - Added full support for both **SUB** and **DUB** audio selections.
  - Implemented client-side Web Crypto (AES-CBC, PBKDF2) and `enc-dec.app` decryption pipelines with automatic fallback.
  - Integrated into CinePlayer with support for intro/outro skip intervals and ASS/SSA styled subtitle rendering.
  - Seamless Tier-2 fallback to verified MegaPlay/Vidstream streams when FlixCloud manifests are unavailable.
- **ReAnime Embed Player**:
  - Added dedicated **ReAnime** embed server to the server selector.
  - Automatically resolves native FlixCloud HD-2 player embeds via `/api/embed/reanime` with audio mode switching.

### ⚡ Performance & Episode Optimizations
- **TMDB Episode Group Mapping**:
  - Enhanced episode details and episode thumbnail fetching for long-running series (e.g. *One Piece*) using TMDB episode groups (absolute ordering).
  - Maintained lightweight caching for homepage hero banners and carousel queries to ensure instant initial page loads.

### 🛡️ Streaming Proxy & Security Fixes
- **Stream Proxy & CDN Compatibility**:
  - Added `vividcdn.top`, `vividcdn.com`, `rundowncdn.top`, `fallencdn.top`, `atomic4cdn.com`, `enc-dec.app`, and `reanime.to` to SSRF security allowlists.
  - Corrected MIME types for disguised video segments (`.png`, `.webp`) and AES keys (`key.bin`) to ensure strict browser media player compliance.
  - Proxy header forwarding for Range requests and authenticated Referer/Origin headers.

### 🛠️ Build & Stability
- Added robust TypeScript module definitions for `hls.js` in `src/vite-env.d.ts`.
- Fixed strict type checks in `CinePlayer.tsx`.
- Verified production build and bundling with Vite.
