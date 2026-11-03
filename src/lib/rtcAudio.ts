/**
 * Helpers that attach / detach the local microphone track on a peer connection without ever creating
 * duplicate senders or broken transceivers.
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

/** Make sure our side is allowed to send on the audio m-line (answerers default to matching remote direction). */
export function allowSendingAudio(pc: RTCPeerConnection) {
  const t = audioTransceiver(pc)
  if (t && (t.direction === 'recvonly' || t.direction === 'inactive')) {
    t.direction = 'sendrecv'
  }
}

/** Send this microphone track: reuse existing transceiver sender or add track with stream */
export async function sendAudioTrack(
  pc: RTCPeerConnection,
  track: MediaStreamTrack,
  stream: MediaStream
) {
  const transceivers = pc.getTransceivers()
  const t = transceivers.find(
    (tr) => tr.receiver.track?.kind === 'audio' || tr.sender.track?.kind === 'audio'
  )
  if (t) {
    if (t.direction === 'recvonly' || t.direction === 'inactive') {
      t.direction = 'sendrecv'
    }
    if (t.sender.track !== track) {
      await t.sender.replaceTrack(track)
    }
  } else if (!pc.getSenders().some((s) => s.track === track)) {
    pc.addTrack(track, stream)
  }
}

/** Stop sending audio (the track itself is stopped by the caller). */
export function silenceAudio(pc: RTCPeerConnection) {
  const t = audioTransceiver(pc)
  if (t?.sender.track) {
    void t.sender.replaceTrack(null).catch(() => {})
  }
}
