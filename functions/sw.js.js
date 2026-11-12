// Serves /sw.js with the ad-network zone that matches the domain being visited,
// so one repo/deployment can back several domains. Replaces public/sw.js.
const ZONES = {
  // hostname (without www.) -> ad-network service-worker config
  'FIRST-DOMAIN.com': { domain: '3nbf4.com', zoneId: 12249368 },
  'SECOND-DOMAIN.com': { domain: '5gvci.com', zoneId: 12249533 },
}
// Used for *.pages.dev previews and any unlisted hostname.
const FALLBACK = ZONES['FIRST-DOMAIN.com']

export function onRequestGet({ request }) {
  const host = new URL(request.url).hostname.replace(/^www\./, '')
  const z = ZONES[host] || FALLBACK
  const body =
    `self.options = ${JSON.stringify({ domain: z.domain, zoneId: z.zoneId }, null, 4)}\n` +
    `self.lary = ""\n` +
    `importScripts('https://${z.domain}/act/files/service-worker.min.js?r=sw')\n`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
