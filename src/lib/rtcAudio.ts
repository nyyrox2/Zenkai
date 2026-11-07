/**
 * Helpers that attach / detach the local microphone track on a peer connection.
 */

/** The audio transceiver of this connection (a voice connection has exactly one). */
export function audioTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | null {
  return (
    pc.getTransceivers().find(
      (t) =>
        (!t.receiver.track || t.receiver.track.kind === 'audio') &&
        t.currentDirection !== 'stopped'
    ) ?? null
  )
}

/** Make sure our side is allowed to send on the audio m-line. */
export function allowSendingAudio(pc: RTCPeerConnection) {
  for (const t of pc.getTransceivers()) {
    if (!t.receiver.track || t.receiver.track.kind === 'audio') {
      if (t.direction === 'recvonly' || t.direction === 'inactive') {
        t.direction = 'sendrecv'
      }
    }
  }
}

/** Send this microphone track on the peer connection */
export async function sendAudioTrack(
  pc: RTCPeerConnection,
  track: MediaStreamTrack,
  stream: MediaStream
) {
  const senders = pc.getSenders()
  if (senders.some((s) => s.track === track)) {
    return
  }

  const emptySender = senders.find((s) => !s.track)
  if (emptySender) {
    try {
      await emptySender.replaceTrack(track)
    } catch {
      pc.addTrack(track, stream)
    }
  } else {
    pc.addTrack(track, stream)
  }

  allowSendingAudio(pc)
}

/** Stop sending audio (the track itself is stopped by the caller). */
export function silenceAudio(pc: RTCPeerConnection) {
  for (const s of pc.getSenders()) {
    if (s.track?.kind === 'audio') {
      void s.replaceTrack(null).catch(() => {})
    }
  }
}
