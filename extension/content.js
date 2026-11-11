// Zenkai Stream Companion Content Script
// Communicates extension presence to Zenkai Web

(function () {
  const meta = {
    installed: true,
    version: '1.0.1',
    name: 'Zenkai Stream Companion',
    active: true,
    capabilities: [
      'direct-cdn',
      'header-rewrite',
      'bcdnxw-direct',
      'hakunaymatata-direct',
      'cors-bypass',
      'p2p-residential'
    ]
  };

  // 1. Mark the root HTML document attribute immediately so React components detect it before first render
  document.documentElement.dataset.zenkaiCompanion = 'true';
  document.documentElement.dataset.zenkaiCompanionVersion = meta.version;

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
})();
