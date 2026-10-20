<div align="center">

<img src="docs/logo.svg" alt="Zenkai logo" width="112" height="112" />

# Zenkai

**Watch anime & movies. Read manga & novels. Track it all in one beautiful place.**

Free, fast and beautifully simple. Responsive on phone, tablet and desktop, with polished light and dark themes.

[![Latest release](https://img.shields.io/github/v/release/Nyyrox/zenkai?style=for-the-badge&color=e8294c&label=release)](https://github.com/Nyyrox/zenkai/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Nyyrox/zenkai/total?style=for-the-badge&color=e8294c)](https://github.com/Nyyrox/zenkai/releases)
[![Stars](https://img.shields.io/github/stars/Nyyrox/zenkai?style=for-the-badge&color=e8294c)](https://github.com/Nyyrox/zenkai/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-e8294c?style=for-the-badge)](https://opensource.org/licenses/MIT)

[**Download the Android app**](https://github.com/Nyyrox/zenkai/releases/latest) ·
[Releases](https://github.com/Nyyrox/zenkai/releases) ·
[Report a bug](https://github.com/Nyyrox/zenkai/issues) ·
[Discord](https://discord.gg/kHxHzZtH7) ·
[Telegram](https://t.me/StreamverseOfc)

<img src="docs/banner.jpg" alt="Zenkai: watch anime and movies, read manga and novels" width="720" />

</div>

---

## Contents

- [Features](#features)
- [Get the app](#get-the-app)
- [Quick start](#quick-start)
- [Deploy your own](#deploy-your-own)
- [Keyboard & TV remote](#keyboard--tv-remote)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [API](#api)
- [Routes](#routes)
- [Contributing](#contributing)
- [License](#-license)
- [Disclaimer](#disclaimer)

## Features

Zenkai is four apps in one, each with its own colour identity:

| Section | Accent | What you get |
| ------- | ------ | ------------ |
| **Anime** アニメ | Red | Trending, popular and top-rated rows, airing schedule in your local time, sub and dub, multiple servers, intro/outro skip, captions, optional Anime4K upscaling |
| **Movies** 映画 | Black & white | Movies and TV via TMDB, browse and search, details and a full-screen player |
| **Manga** 漫画 | Indigo | Five servers (ComicK, Manhua, Asura Scans, WeebCentral, MangaDex), reader with saved preferences |
| **Novels** 小説 | Amber | Search, details, chapters and a distraction-free reader |

Across everything:

- **Details pages** with AniList and MAL score rings, next-episode countdown, characters and voice actors, staff, related titles, watch order, score distribution and recommendations.
- **Continue watching / reading** shelves, watchlist and progress, stored locally in your browser.
- **AniList sync** and a customisable profile.
- **Command-palette search** (`Ctrl/⌘ + K` or `/`) with keyboard navigation and filters.
- **Theme toggle** with a circular reveal animation.
- **Phone:** bottom dock navigation. **Desktop:** floating glass navbar.
- **Multi-audio dubs** through the ACDN resolver, played in Zenkai's own player.
- **Zenkai Shield**, an optional invisible proof-of-work gate for your API.

## Get the app

The Android app is published on the release repo:

**https://github.com/Nyyrox/zenkai/releases/latest**

1. Download the latest `.apk` from the release assets.
2. Open it on your phone and allow installs from your browser or file manager if asked.
3. Install and open Zenkai.

The web app reads that repo live. The home-page banner and `/app` show the current version, release notes, APK links, sizes, download counts and stars. New releases appear within five minutes with no redeploy.

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/nyyrox2/Zenkai.git
cd Zenkai
npm install
npm run dev        # http://localhost:5173
```

| Command           | What it does                                |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Dev server, with the API served in-process  |
| `npm run build`   | Type-checks, then builds to `dist/`         |
| `npm run preview` | Serves the production build locally         |

`npm run dev` serves `/api/*` and `/proxy` through a Vite middleware, so there is nothing else to run.

## Deploy your own

Zenkai deploys to **Cloudflare Pages**:

- Build command: `npm run build`
- Output directory: `dist`

Everything in `functions/` is picked up automatically. Or from the CLI:

```bash
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name my-zenkai
```

If the frontend is hosted elsewhere, point it at your API with `VITE_API_BASE`.

## Keyboard & TV remote

Press **`?`** anywhere (or use *Keyboard shortcuts* in the footer) to see the full list.

| Where | Keys |
| ----- | ---- |
| Everywhere | `/` or `Ctrl/⌘ K` search · `?` shortcuts |
| Anime player | `Space`/`K` play · `←` `→` seek 10 s (`Shift` 30 s) · `J` `L` ±10 s · `↑` `↓` volume · `0`-`9` jump to % · `Home` `End` · `,` `.` frame step · `<` `>` speed · `N` `P` next/prev episode · `M` mute · `C` captions · `F` fullscreen · `I` picture-in-picture · `Tab` skip intro |
| Manga reader | `←` `→` pages · `Space`/`PgDn`/`Shift+Space`/`PgUp` · `Home` `End` · `[` `]` chapters · `C` chapters · `S` settings · `F` fullscreen |
| Novel reader | `←` `→` or `[` `]` chapters · `Esc` close panel |

**TV mode** turns on by itself on smart TVs (Android TV, Fire TV, Tizen, webOS and similar). On a TV box or a browser on a TV, add `?tv=1` to the URL once or flip the switch in the shortcuts panel (`?tv=0` turns it off). It enlarges the UI, draws a clear focus ring, and lets the D-pad move between buttons and cards. `OK` presses, `Back` closes a menu and then goes back, and media keys (play/pause, next, previous, fast-forward, rewind) control the player. In the player, `↑` brings up the controls and `←` `→` seek, or move between controls when they are showing.

## Configuration

Copy `.env.example` to `.env` and adjust.

| Variable                 | Where  | Purpose |
| ------------------------ | ------ | ------- |
| `VITE_SITE_URL`          | build  | Public site URL for the share image and sitemap |
| `VITE_ANILIST_CLIENT_ID` | build  | AniList app client ID. Redirect URL: `https://your-domain.com/auth/anilist` |
| `VITE_API_BASE`          | build  | API origin when the frontend and API are hosted separately |
| `SHIELD_SECRET`          | server | Turns on Zenkai Shield. Unset means off. On Cloudflare: `npx wrangler pages secret put SHIELD_SECRET` |
| `GITHUB_TOKEN`           | server | Optional. Lifts GitHub's 60 requests/hour anonymous limit for the release data |

## Project structure

```
src/
  pages/        Landing, Home, Details, Catalog, Schedule, Watch, Manga, Novel, Movies, Profile, App
  components/   Flat. CinePlayer.tsx + cineplayer.css is the video player
  services/     anilist.ts (GraphQL) · jikan.ts (MyAnimeList) · api.ts (Zenkai API client)
  hooks/        useAsync · useTmdb · useEpisodes · ...
  lib/          utils · constants · mappers · servers · episodes · progress · subtitles · backToDetails
server/         handler.js: one Web-standard API used by Pages Functions AND `npm run dev`
functions/      Cloudflare Pages Functions (thin wrappers around server/handler.js)
public/         Static assets and anime-mapping.json
docs/           README assets
```

Built with React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion and hls.js. Metadata comes from AniList (GraphQL), MyAnimeList (via Jikan) and TMDB.

## API

All routes are served by `server/handler.js`.

| Route                     | What it does |
| ------------------------- | ------------ |
| `/api/stream`             | MegaPlay / Vidstream HLS resolver (sub and dub, intro/outro, captions). `server=acdn` is the multi-audio resolver (dub only) |
| `/proxy` (`/api/proxy`)   | Referer-spoofing proxy that rewrites m3u8 so segments and keys pass through |
| `/api/mapping/:anilistId` | AniBridge mapping (AniList to MAL / TMDB / TVDB / IMDb / AniDB), ARM fallback |
| `/api/tmdb`               | TMDB details, backdrops and logo PNG |
| `/api/subtitles`          | OpenSubtitles (IMDb id comes from the mapping) |
| `/api/embed/animesalt`    | AnimeSalt multi-audio player URL |
| `/api/app/release`        | Live Android release data from GitHub (cached 5 min, served stale if GitHub is down) |
| `/api/manga/*`            | `home`, `search`, `chapters`, `pages`, `sources`. Every route takes `source=` |
| `/api/novel/*`            | `home`, `search`, `detail`, `chapters`, `read` |

<details>
<summary><b>ACDN (multi audio)</b></summary>

A **Direct** server that only appears while **DUB** is selected, tagged *Multi audio*. `server/acdn.js` is a port of the Android `MultiAudioExtractor`: `public/anime-mapping.json` (AniList id to AnimeSalt id / season / episode offset), then AnimeDekho (search, episode page, `?trdekho=0..4` players), then an AnimeSalt fallback. Players are turned into a direct stream (as-cdn / ravok HLS, AbyssPlayer via enc-dec.app, `player.php`, Pixel, plain m3u8 / mp4) and played in Zenkai's own player, which lists the stream's audio tracks under the language button.

The mapping file is bundled into the API, so editing it needs a redeploy.

</details>

<details>
<summary><b>Manga servers</b></summary>

Five servers, same as the Android app (`src/lib/mangaModels.ts` is a port of `MangaModels.kt`): **ComicK**, **Manhua**, **Asura Scans**, **WeebCentral** and **MangaDex**.

- Pick one with the tabs on `/manga`. It is remembered, and links carry `?source=<id>`.
- WeebCentral, ComicK, Manhua and Asura go through the Zenkai manga worker (`server/manga.js`). MangaDex is queried directly from its public API (`server/mangadex.js`), English chapters only.
- A title's details page has a **Server** row: tapping another server searches the same title there and opens the best match.

</details>

## Routes

| Path                            | Page |
| ------------------------------- | ---- |
| `/`                             | Opening page: pick Anime, Movies, Manga or Novels |
| `/home`                         | Anime home |
| `/trending` `/popular` `/top`   | Ranked infinite-scroll catalogues with filters |
| `/browse`                       | Search plus genre / year / season / format / status / sort |
| `/schedule`                     | Day-by-day airing schedule in local time |
| `/anime/:id` · `/mal/:id`       | Details: watch now, episodes, watch order, stats |
| `/watch/:id?ep=&server=&audio=` | Player |
| `/movies` · `/movies/:type/:id` | Movies and TV |
| `/manga` · `/manga/:id`         | Manga browse and details, reader at `/manga/:id/read/:chapterId` |
| `/novel` · `/novel/:source/:slug` | Novel browse and details, reader under `/read/:chapter` |
| `/list` · `/profile`            | Your library and profile |
| `/app`                          | Android app page: live release notes, APK download, install guide |

## Contributing

Contributions are welcome.

1. Fork the repo and create a branch: `git checkout -b feat/my-change`.
2. Run `npm run build` before you push. It type-checks, so it catches most mistakes.
3. Open a pull request that says what changed and why.

Found a bug or want a feature? [Open an issue](https://github.com/Nyyrox/zenkai/issues) or ask in the [Discord](https://discord.gg/kHxHzZtH7).

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

## Disclaimer

Zenkai does not host or store any video, manga or novel files. It displays metadata and trailers from public APIs and links to content hosted by third parties. All titles and artwork belong to their respective owners.

---

<div align="center">

Made with care by [Nyyrox](https://github.com/Nyyrox). If Zenkai is useful to you, leave a star.

</div>
