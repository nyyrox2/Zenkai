import { supabase } from './supabase'
import { requestMicrophoneStream } from './microphone'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 6,
}

export interface CallUserInfo {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'

export class DirectVoiceCall {
  public callId: string
  public myUser: CallUserInfo
  public partner: CallUserInfo
  public isCaller: boolean
  public status: CallStatus = 'idle'
  public isMuted: boolean = false
  public isDeafened: boolean = false
  public connectedAt?: number
  public duration: number = 0
  public micPermissionDenied: boolean = false

  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private remoteAudio: HTMLAudioElement | null = null
  private signalChannel: ReturnType<typeof supabase.channel> | null = null

  // Listeners
  private onStatusChange?: (status: CallStatus) => void
  private onRemoteSpeakingChange?: (speaking: boolean) => void
  private onCallEnded?: (summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void
  private onMicPermissionError?: (error: any) => void

  constructor(options: {
    callId: string
    myUser: CallUserInfo
    partner: CallUserInfo
    isCaller: boolean
  }) {
    this.callId = options.callId
    this.myUser = options.myUser
    this.partner = options.partner
    this.isCaller = options.isCaller
    this.status = options.isCaller ? 'calling' : 'incoming'
  }

  public setCallbacks(cbs: {
    onStatusChange?: (status: CallStatus) => void
    onRemoteSpeakingChange?: (speaking: boolean) => void
    onCallEnded?: (summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void
    onMicPermissionError?: (error: any) => void
  }) {
    this.onStatusChange = cbs.onStatusChange
    this.onRemoteSpeakingChange = cbs.onRemoteSpeakingChange
    this.onCallEnded = cbs.onCallEnded
    this.onMicPermissionError = cbs.onMicPermissionError
  }

  /** Initialize signaling channel for this call session */
  public async initSignaling() {
    const channelName = `call_session_${this.callId}`
    this.signalChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    this.signalChannel
      .on('broadcast', { event: 'call:accepted' }, async () => {
        if (this.isCaller && this.status === 'calling') {
          await this.startPeerConnectionAsCaller()
        }
      })
      .on('broadcast', { event: 'call:rejected' }, () => {
        this.endCall(false, 'declined')
      })
      .on('broadcast', { event: 'call:ended' }, () => {
        this.endCall(false, this.status === 'incoming' ? 'missed' : undefined)
      })
      .on('broadcast', { event: 'signal:offer' }, async ({ payload }) => {
        if (!this.isCaller && payload.sdp) {
          await this.handleOffer(payload.sdp)
        }
      })
      .on('broadcast', { event: 'signal:answer' }, async ({ payload }) => {
        if (this.isCaller && payload.sdp && this.pc) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          this.updateStatus('connected')
        }
      })
      .on('broadcast', { event: 'signal:ice' }, async ({ payload }) => {
        if (payload.candidate && this.pc) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } catch {
            // ignore
          }
        }
      })
      .on('broadcast', { event: 'call:speaking' }, ({ payload }) => {
        this.onRemoteSpeakingChange?.(Boolean(payload.speaking))
      })

    await this.signalChannel.subscribe()
  }

  /** Caller initiates WebRTC offer */
  private async startPeerConnectionAsCaller() {
    try {
      this.createPeerConnection()

      try {
        await this.acquireMicrophone()
        if (this.pc && this.localStream) {
          for (const track of this.localStream.getTracks()) {
            this.pc.addTrack(track, this.localStream)
          }
        }
      } catch (micErr) {
        console.warn('[VoiceCall] Mic acquisition deferred/denied:', micErr)
        this.micPermissionDenied = true
        this.onMicPermissionError?.(micErr)
      }

      if (this.pc) {
        if (this.pc.getSenders().length === 0) {
          try {
            this.pc.addTransceiver('audio', { direction: 'sendrecv' })
          } catch {}
        }

        const offer = await this.pc.createOffer()
        await this.pc.setLocalDescription(offer)

        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:offer',
          payload: { sdp: offer },
        })
      }
    } catch (err) {
      console.warn('[VoiceCall] Caller setup error:', err)
      this.endCall(true, 'missed')
    }
  }

  /** Callee accepts incoming call */
  public async acceptCall(preacquiredStream?: MediaStream) {
    try {
      this.updateStatus('calling')
      this.createPeerConnection()

      try {
        await this.acquireMicrophone(preacquiredStream)
        if (this.pc && this.localStream) {
          for (const track of this.localStream.getTracks()) {
            this.pc.addTrack(track, this.localStream)
          }
        }
      } catch (micErr) {
        console.warn('[VoiceCall] Callee mic deferred/denied:', micErr)
        this.micPermissionDenied = true
        this.onMicPermissionError?.(micErr)
        if (this.pc && this.pc.getSenders().length === 0) {
          try {
            this.pc.addTransceiver('audio', { direction: 'sendrecv' })
          } catch {}
        }
      }

      // Inform caller that call is accepted
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'call:accepted',
        payload: { acceptedBy: this.myUser.id },
      })
    } catch (err) {
      console.warn('[VoiceCall] acceptCall error:', err)
      this.endCall(true, 'declined')
    }
  }

  /** Callee receives offer from Caller and generates answer */
  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) this.createPeerConnection()
    try {
      if (this.pc) {
        if (this.localStream) {
          for (const track of this.localStream.getTracks()) {
            this.pc.addTrack(track, this.localStream)
          }
        }

        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)

        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:answer',
          payload: { sdp: answer },
        })

        this.updateStatus('connected')
      }
    } catch (err) {
      console.warn('[VoiceCall] handleOffer error:', err)
      this.endCall()
    }
  }

  private createPeerConnection() {
    if (this.pc) return
    this.pc = new RTCPeerConnection(RTC_CONFIG)

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:ice',
          payload: { candidate: e.candidate },
        })
      }
    }

    this.pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        this.remoteStream = e.streams[0]
        if (!this.remoteAudio) {
          this.remoteAudio = new Audio()
          this.remoteAudio.autoplay = true
        }
        this.remoteAudio.srcObject = this.remoteStream
        this.remoteAudio.muted = this.isDeafened
        this.remoteAudio.play().catch(() => {})
      }
    }

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState
      if (state === 'connected') {
        this.updateStatus('connected')
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        if (this.status === 'connected') {
          this.endCall(false)
        }
      }
    }
  }

  public async acquireMicrophone(preacquiredStream?: MediaStream): Promise<MediaStream> {
    if (preacquiredStream && preacquiredStream.active && preacquiredStream.getAudioTracks().length > 0) {
      this.localStream = preacquiredStream
      this.micPermissionDenied = false
    } else if (!this.localStream || !this.localStream.active || this.localStream.getAudioTracks().length === 0) {
      try {
        this.localStream = await requestMicrophoneStream()
        this.micPermissionDenied = false
      } catch (err) {
        this.micPermissionDenied = true
        console.warn('[VoiceCall] acquireMicrophone error:', err)
        throw err
      }
    }

    this.micPermissionDenied = false

    // Attach acquired track to active peer connection if already created
    if (this.pc && this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !this.isMuted
        const sender = this.pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track)
        if (sender) {
          void sender.replaceTrack(audioTrack)
        } else {
          this.pc.addTrack(audioTrack, this.localStream)
        }
      }
    }

    return this.localStream
  }

  /** Toggle local mic mute */
  public async toggleMute(): Promise<boolean> {
    if (!this.localStream || !this.localStream.active) {
      try {
        await this.acquireMicrophone()
        this.isMuted = false
        return false
      } catch {
        this.isMuted = true
        return true
      }
    }

    this.isMuted = !this.isMuted
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !this.isMuted
      }
    }
    return this.isMuted
  }

  /** Toggle deafen (mute incoming remote audio) */
  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened
    if (this.remoteAudio) {
      this.remoteAudio.muted = this.isDeafened
    }
    return this.isDeafened
  }

  /** Retry acquiring microphone if permission was initially blocked */
  public async retryMicrophone(): Promise<boolean> {
    try {
      await this.acquireMicrophone()
      this.micPermissionDenied = false
      if (this.pc && this.localStream) {
        const audioTrack = this.localStream.getAudioTracks()[0]
        if (audioTrack) {
          const sender = this.pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track)
          if (sender) {
            await sender.replaceTrack(audioTrack)
          } else {
            this.pc.addTrack(audioTrack, this.localStream)
          }
        }
      }
      return true
    } catch (err) {
      this.micPermissionDenied = true
      this.onMicPermissionError?.(err)
      return false
    }
  }

  private updateStatus(newStatus: CallStatus) {
    if (newStatus === 'connected' && !this.connectedAt) {
      this.connectedAt = Date.now()
    }
    this.status = newStatus
    this.onStatusChange?.(newStatus)
  }

  /** Reject or end call */
  public endCall(sendBroadcast = true, reason?: 'ended' | 'missed' | 'declined') {
    let finalStatus: 'ended' | 'missed' | 'declined' = reason || 'ended'

    if (!reason) {
      if (this.status === 'connected') {
        finalStatus = 'ended'
      } else if (this.status === 'incoming') {
        finalStatus = 'declined'
      } else {
        finalStatus = 'missed'
      }
    }

    if (this.connectedAt) {
      this.duration = Math.max(0, Math.floor((Date.now() - this.connectedAt) / 1000))
    }

    if (sendBroadcast && this.signalChannel) {
      void this.signalChannel.send({
        type: 'broadcast',
        event: this.status === 'incoming' ? 'call:rejected' : 'call:ended',
        payload: { by: this.myUser.id, reason: finalStatus },
      })
    }

    // Stop local mic
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) {
        t.stop()
      }
      this.localStream = null
    }

    // Clean up audio
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null
      this.remoteAudio.remove()
      this.remoteAudio = null
    }

    // Close WebRTC
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    // Leave channel
    if (this.signalChannel) {
      void supabase.removeChannel(this.signalChannel)
      this.signalChannel = null
    }

    this.updateStatus('ended')
    this.onCallEnded?.({ status: finalStatus, duration: this.duration })
  }
}

/** Global Caller invitation helper: broadcasts an incoming call alert to partner */
export async function sendIncomingCallAlert(
  partnerId: string,
  callInfo: {
    callId: string
    caller: CallUserInfo
  }
): Promise<void> {
  const channel = supabase.channel(`call_invite_user_${partnerId}`)
  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({
        type: 'broadcast',
        event: 'incoming_call_invite',
        payload: callInfo,
      })
      await supabase.removeChannel(channel)
    }
  })
}
