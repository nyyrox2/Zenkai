# Zenkai Streaming Proxy for Lovable

This standalone proxy file is designed to run on Lovable (`https://proxy-publish-pilot.lovable.app/api/public/proxy`) or any other serverless edge runtime.

## Features
- **Locked Allowed Origin**: Accepts requests from `https://zenkaii.pages.dev` (and local development).
- **Universal Provider Support**: Proxies streams from FlixCloud, MegaPlay, ACDN, AnimeSalt, Vidstreaming, RapidCloud, RabbitStream, etc.
- **HLS M3U8 Manifest Rewriting**: Sub-playlists, audio tracks, and AES-128 encryption keys automatically loop back through the proxy so browsers play encrypted streams without CORS errors.
- **Direct Segment Streaming**: Full `Range` request and `206 Partial Content` support for fast `.ts` / `.m4s` chunks.
- **Dev-Safe**: Zenkai automatically ignores the external proxy and uses local `/proxy` when running on `npm run dev` / localhost.

## How to Deploy on Lovable

In your Lovable project (`proxy-publish-pilot`):

### Option 1: Edit the Route File in Lovable
Open the file in your Lovable files tree:
- Path: `app/routes/api/public/proxy.ts` (or `src/routes/api/public/proxy.ts`)
- Replace the entire file contents with `standalone-proxy/lovable-proxy-route.ts`.
- Save / Publish.

### Option 2: Ask Lovable in Chat
Paste the following prompt into your Lovable chat:
```
Update /api/public/proxy to be a universal HLS stream proxy for https://zenkaii.pages.dev:
1. Allow origin: https://zenkaii.pages.dev (and localhost for testing).
2. Whitelist all streaming CDNs (megaplay.buzz, flixcloud.cc, animesalt.cx, acdn.top, rapid-cloud.ru, megacloud.tv, rabbitstream.net, enc-dec.app, etc.) and any URL ending in .m3u8, .ts, .m4s, .key, .bin, .mp4, .vtt.
3. Rewrite HLS m3u8 playlists so nested playlists and AES keys route back through /api/public/proxy?url=...
4. Support Range requests and stream response body for .ts video chunks.
```

---

## How to Configure on Cloudflare Pages

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** -> your Zenkai pages project (`zenkai` / `zenkaii`).
3. Click **Settings** -> **Environment variables**.
4. Under **Production** (and optionally **Preview**), click **Add variable**:
   - **Variable name**: `STREAM_PROXY_URL`
   - **Value**: `https://proxy-publish-pilot.lovable.app/api/public/proxy`
5. Click **Save**.
6. When the latest commit is deployed, Zenkai on `https://zenkaii.pages.dev` will automatically route its video streams through your Lovable proxy!
