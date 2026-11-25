/**
 * Universal Mobile-Friendly Microphone Permission & Stream Acquisition Helper
 *
 * Mobile browsers (iOS Safari, Android Chrome, WebViews) strictly require:
 * 1. Synchronous invocation within the active user gesture (touch/click) call-stack.
 *    Any preceding `await` (e.g. network call) discards user activation and silences permission popups.
 * 2. Secure context (HTTPS or localhost).
 * 3. Standard `{ audio: true }` constraint for widest compatibility.
 */

export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    throw new Error(
      'Microphone access requires HTTPS on mobile devices. Browsers block microphone requests over insecure HTTP.'
    )
  }

  // 1. Modern standard API
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    try {
      // Echo cancellation matters here: the movie plays from the same speakers the mic hears
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (err: any) {
      // Constraints unsupported: fall back to the plain, most compatible request
      if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
        return await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      throw err
    }
  }

  // 2. Legacy mobile Safari / Android WebKit
  const legacyNav = navigator as any
  const legacyGetUserMedia =
    legacyNav.getUserMedia ||
    legacyNav.webkitGetUserMedia ||
    legacyNav.mozGetUserMedia ||
    legacyNav.msGetUserMedia

  if (legacyGetUserMedia) {
    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(navigator, { audio: true }, resolve, reject)
    })
  }

  throw new Error('Microphone is not supported on this browser or context.')
}

export function isMicrophoneSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  return Boolean(
    (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).getUserMedia
  )
}
