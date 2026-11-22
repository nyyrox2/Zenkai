// Zenkai Stream Companion Content Script
// Communicates extension presence to Zenkai Web

(function () {
  const meta = {
    installed: true,
    version: '1.3.0',
    name: 'Zenkai Stream Companion',
    active: true,
    capabilities: [
      'direct-cdn',
      'header-rewrite',
      'bcdnxw-direct',
      'hakunaymatata-direct',
      'anime-direct',
      'megaplay-direct',
      'flixcloud-direct',
      'animesalt-direct',
      'cors-bypass',
      'p2p-residential',
      // 1.2.0: the web app resolves IP-bound ACDN streams in this browser (see rules 36-40)
      'acdn-client',
      // 1.3.0: direct zero-proxy file download directly from CDN with custom naming
      'direct-download'
    ]
  };

  // 1. Mark the root HTML document attribute immediately so React components detect it before first render
  document.documentElement.dataset.zenkaiCompanion = 'true';
  document.documentElement.dataset.zenkaiCompanionVersion = meta.version;
  // capability list also as an attribute, for pages whose CSP blocks the inline script below
  document.documentElement.dataset.zenkaiCompanionCaps = meta.capabilities.join(',');

  // 2. Inject global object into the page execution context
  try {
    const s = document.createElement('script');
    s.textContent = `
      window.__ZENKAI_COMPANION__ = ${JSON.stringify(meta)};
      window.dispatchEvent(new CustomEvent('zenkai:companion-ready', { detail: ${JSON.stringify(meta)} }));
      document.documentElement.dataset.zenkaiCompanion = 'true';
    `;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  } catch (e) {}

  // 3. Keep polling ping responder for dynamic checks
  window.addEventListener('zenkai:ping-companion', () => {
    window.dispatchEvent(new CustomEvent('zenkai:companion-pong', { detail: meta }));
  });

  // 4. Direct zero-proxy file download handler
  window.addEventListener('zenkai:extension-download', (e) => {
    const detail = (e && e.detail) || {};
    if (!detail.url) return;
    chrome.runtime.sendMessage(
      {
        type: 'ZENKAI_DOWNLOAD',
        url: detail.url,
        filename: detail.filename || 'video.mp4',
      },
      (res) => {
        const ok = Boolean(res && res.ok);
        window.dispatchEvent(
          new CustomEvent('zenkai:extension-download-result', {
            detail: { ok, error: res?.error, id: detail.id },
          })
        );
      }
    );
  });
})();
