# Changelog

All notable changes to the Zenkai Web application will be documented in this file.

## [1.0.3] - 2026-11-01

### 🔌 Zenkai Player API

- **Embeddable Player**:
  - Put any anime episode on your own site with one iframe: `/embed?id={anilistId}&ep={episode}`. No keys, no setup.
  - Choose the server with `server=` and the audio with `audio=sub|dub`.
  - `/api/servers?id={anilistId}&ep={episode}` lists the servers available for an episode.
  - The API info endpoint now reports version 1.0.3.
- **Live Embed Generator & Docs**:
  - Build, preview and copy your snippet on the `/api` page, with every option documented.

### 🖼️ TMDB-First Artwork & Loading

- **TMDB First, AniList As Fallback**:
  - Hero banners, the details poster and the gallery now use TMDB artwork first and only fall back to AniList when TMDB has nothing.
  - TMDB posters are now returned and cached (cache upgraded so existing visitors pick them up).
- **Skeleton Then Fade-In**:
  - Posters, banners, episode thumbnails, gallery tiles, schedule, book covers and movie pages show a shimmer skeleton until the image is fully loaded, then fade in.
- **Faster Hero**:
  - The hero shows the TMDB title-logo PNG when one exists and plain text only when it does not.
  - TMDB data for the first four hero slides is prefetched as soon as the list arrives.
- **New Black & White Loader**:
  - A scrambling ZENKAI wordmark with a hairline sweep and the live loading timer replaces the old skeleton on the home page.

### 🎬 CinePlayer Popups

- **Morphing Small Popups**:
  - Speed, quality, captions, audio and server popups now open with the same circle, lopsided blob, rectangle morph as the server popup on the player page.
  - Fixed the captions popup snapping straight to a rectangle.
- **Minimal Big Sheets**:
  - Settings, Caption settings, Episodes and Report open with a quick, plain slide and fade instead.

### 📰 What's New From GitHub

- **Always In Sync**:
  - The What's New popup and the footer version now read the latest GitHub release automatically, so publishing a release updates both.
  - Works offline with a built-in fallback note.
- **Lighter, Minimal Design**:
  - New black and white card with crimson accents only. Removed the heavy blur, meteors and per-mouse-move spotlight that caused lag.

### 🧹 Cleanup

- **Quieter Sync**:
  - Removed the "Watchlist synced from AniList" toast. Syncing still happens in the background.
- **Version 1.0.3**:
  - Version bumped across `package.json`, the lockfile and the API info endpoint.

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
