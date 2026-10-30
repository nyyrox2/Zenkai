/**
 * CinePlayer Security: Anti-Theft & Debugger Lock
 * Scoped exclusively to the CinePlayer component.
 */

export function attachPlayerSecurity(
  container: HTMLElement | null,
  video: HTMLVideoElement | null,
  options?: { isPreview?: boolean }
): () => void {
  // If in preview mode (e.g. developer docs configurator), do not activate security listeners
  if (options?.isPreview) return () => {};

  // 1. Keyboard Shortcut Blocking (F12, View Source, DevTools Shortcuts)
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key ? e.key.toLowerCase() : '';
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (
      k === 'f12' ||
      (isCmdOrCtrl && e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || k === 'k')) ||
      (isMac && e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'c' || k === 'u')) ||
      (isCmdOrCtrl && (k === 'u' || k === 's'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      try {
        console.clear();
      } catch {}
      return false;
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  // 2. Anti-Theft: Block Context Menu & Drag on CinePlayer
  const blockEvent = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  if (container) {
    container.addEventListener('contextmenu', blockEvent, true);
    container.addEventListener('dragstart', blockEvent, true);
    container.style.userSelect = 'none';
  }

  if (video) {
    video.addEventListener('contextmenu', blockEvent, true);
    video.addEventListener('dragstart', blockEvent, true);
    video.setAttribute('controlsList', 'nodownload noplaybackrate');
    video.setAttribute('disablePictureInPicture', 'true');
  }

  // 3. Dynamic Anonymous Function Debugger Trap
  // Traps execution in an anonymous VM script if DevTools is open.
  const _0x3779a6 = () => {
    try {
      (function () {}['constructor']('debugger')());
    } catch {}
    try {
      Function('debugger')();
    } catch {}
  };

  const debugTimer = window.setInterval(_0x3779a6, 120);

  // 4. Console Wiper
  const clearTimer = window.setInterval(() => {
    try {
      console.clear();
    } catch {}
  }, 250);

  try {
    console.clear();
  } catch {}

  // Cleanup on unmount
  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    if (container) {
      container.removeEventListener('contextmenu', blockEvent, true);
      container.removeEventListener('dragstart', blockEvent, true);
    }
    if (video) {
      video.removeEventListener('contextmenu', blockEvent, true);
      video.removeEventListener('dragstart', blockEvent, true);
    }
    clearInterval(debugTimer);
    clearInterval(clearTimer);
  };
}
