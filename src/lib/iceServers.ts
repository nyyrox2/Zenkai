/**
 * ICE servers for WebRTC (client-side only, no backend needed).
 * STUN finds the public address; TURN relays audio when a direct link is impossible
 * (mobile data / CGNAT, strict Wi-Fi, symmetric NAT) - the main reason voice goes silent.
 *
 * Override with your own TURN at build time (recommended for reliability):
 *   VITE_TURN_URLS="turn:host:80,turn:host:443?transport=tcp,turns:host:443?transport=tcp"
 *   VITE_TURN_USER=...  VITE_TURN_PASS=...
 * Without them, the public Open Relay servers are used as a best-effort fallback.
 */
const env = import.meta.env as Record<string, string | undefined>

const stun: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

const customUrls = env.VITE_TURN_URLS?.split(',').map((s) => s.trim()).filter(Boolean)

const turn: RTCIceServer[] =
  customUrls && customUrls.length && env.VITE_TURN_USER && env.VITE_TURN_PASS
    ? [{ urls: customUrls, username: env.VITE_TURN_USER, credential: env.VITE_TURN_PASS }]
    : [
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
            'turns:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ]

export const ICE_SERVERS: RTCIceServer[] = [...stun, ...turn]
