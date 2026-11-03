/**
 * Helpers that attach / detach the local microphone track on a peer connection without ever creating
 * a second sender or touching a transceiver that was never negotiated (both silently break outgoing voice).
 */

/** The audio transceiver of this connection (a voice connection has exactly one). */
export function audioTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | null {
  return pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio' && t.currentDirection !== 'stopped') ?? null
}

/** Make sure our side is allowed to send on the audio m-line (answerers start as receive-only). */
export function allowSendingAudio(pc: RTCPeerConnection) {
  const t = audioTransceiver(pc)
  if (t && (t.direction === 'recvonly' || t.direction === 'inactive')) t.direction = 'sendrecv'
}

/** Send this microphone track: reuse the existing audio sender, only add a new one if none exists. */
export async function sendAudioTrack(pc: RTCPeerConnection, track: MediaStreamTrack, stream: MediaStream) {
  const t = audioTransceiver(pc)
  if (t) {
    if (t.sender.track !== track) await t.sender.replaceTrack(track)
    allowSendingAudio(pc)
  } else if (!pc.getSenders().some((s) => s.track === track)) {
    pc.addTrack(track, stream)
  }
}

/** Stop sending audio (the track itself is stopped by the caller). */
export function silenceAudio(pc: RTCPeerConnection) {
  const t = audioTransceiver(pc)
  if (t?.sender.track) void t.sender.replaceTrack(null).catch(() => {})
}
