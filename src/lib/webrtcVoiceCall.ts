import { supabase } from './supabase'
import { requestMicrophoneStream } from './microphone'
import { allowSendingAudio, sendAudioTrack, silenceAudio } from './rtcAudio'
import { playConnected, playHangup, playMicOff, playMicOn, startRinging, stopRinging } from './sounds'

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

  // Listeners & signaling tracking
  private onCallEndedListeners: Array<(summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void> = []
  private handledOffer = false
  private handledAnswer = false
  private processedCandidates = new Set<string>()

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
    this.syncRinging()
  }

  /** Ringtone while a call comes in, soft ringback while we are calling, silence otherwise. */
  private syncRinging() {
    if (this.status === 'incoming') startRinging('incoming')
    else if (this.status === 'calling' && this.isCaller) startRinging('outgoing')
    else stopRinging()
  }

  public setCallbacks(cbs: {
    onStatusChange?: (status: CallStatus) => void
    onRemoteSpeakingChange?: (speaking: boolean) => void
    onCallEnded?: (summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void
    onMicPermissionError?: (error: any) => void
  }) {
    if (cbs.onStatusChange !== undefined) this.onStatusChange = cbs.onStatusChange
    if (cbs.onRemoteSpeakingChange !== undefined) this.onRemoteSpeakingChange = cbs.onRemoteSpeakingChange
    if (cbs.onCallEnded !== undefined) {
      this.onCallEndedListeners.push(cbs.onCallEnded)
      this.onCallEnded = cbs.onCallEnded
    }
    if (cbs.onMicPermissionError !== undefined) this.onMicPermissionError = cbs.onMicPermissionError
  }

  public addCallEndedListener(fn: (summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void) {
    this.onCallEndedListeners.push(fn)
    return () => {
      this.onCallEndedListeners = this.onCallEndedListeners.filter((l) => l !== fn)
    }
  }

  /** Safely add candidate without dropping if remote description is still preparing */
  private async addIceCandidateSafe(candidate: RTCIceCandidateInit) {
    if (!candidate || !this.pc) return
    const key = `${candidate.candidate}-${candidate.sdpMid}-${candidate.sdpMLineIndex}`
    if (this.processedCandidates.has(key)) return
    if (!this.pc.remoteDescription) {
      setTimeout(() => void this.addIceCandidateSafe(candidate), 350)
      return
    }
    this.processedCandidates.add(key)
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch {
      // ignore duplicated candidate
    }
  }

  private applyDbCandidates(row: any) {
    const candidates = this.isCaller ? row.callee_candidates : row.caller_candidates
    if (Array.isArray(candidates)) {
      for (const cand of candidates) {
        void this.addIceCandidateSafe(cand)
      }
    }
  }

  /** Read latest offer, answer, and ICE candidates persisted in backend */
  public async syncFromBackend() {
    try {
      const { data } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('call_id', this.callId)
        .maybeSingle()
      if (!data) return

      if (!this.isCaller && data.offer && !this.handledOffer) {
        await this.handleOffer(data.offer)
      } else if (this.isCaller && data.answer && !this.handledAnswer && this.pc) {
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          this.handledAnswer = true
          this.updateStatus('connected')
        } catch {}
      }

      if (data.status === 'declined' && this.status !== 'ended') {
        this.endCall(false, 'declined')
      } else if (data.status === 'ended' && this.status !== 'ended') {
        this.endCall(false, 'ended')
      }

      this.applyDbCandidates(data)
    } catch (err) {
      console.warn('[VoiceCall] syncFromBackend error:', err)
    }
  }

  /** Initialize signaling channel for this call session */
  public async initSignaling() {
    const channelName = `call_session_${this.callId}`
    this.signalChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    // Upsert call session in backend database
    if (this.isCaller) {
      void supabase
        .from('call_sessions')
        .upsert({
          call_id: this.callId,
          caller_id: this.myUser.id,
          callee_id: this.partner.id,
          status: 'calling',
          updated_at: new Date().toISOString(),
        })
        .then(
          () => {},
          (err: any) => console.warn('[VoiceCall] DB init session error:', err)
        )
    }

    // Subscribe to Postgres database realtime updates for call_sessions
    this.signalChannel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_sessions',
        filter: `call_id=eq.${this.callId}`,
      },
      async (payload) => {
        const row = payload.new as any
        if (!row) return

        if (!this.isCaller && row.offer && !this.handledOffer) {
          await this.handleOffer(row.offer)
        } else if (this.isCaller && row.answer && !this.handledAnswer && this.pc) {
          try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(row.answer))
            this.handledAnswer = true
            this.updateStatus('connected')
          } catch (e) {
            console.warn('[VoiceCall] Apply answer from DB error:', e)
          }
        }

        if (row.status === 'declined' && this.status !== 'ended') {
          this.endCall(false, 'declined')
        } else if (row.status === 'ended' && this.status !== 'ended') {
          this.endCall(false, 'ended')
        }

        this.applyDbCandidates(row)
      }
    )

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
        if (!this.isCaller && payload.sdp && !this.handledOffer) {
          await this.handleOffer(payload.sdp)
        }
      })
      .on('broadcast', { event: 'signal:answer' }, async ({ payload }) => {
        if (this.isCaller && payload.sdp && this.pc && !this.handledAnswer) {
          try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            this.handledAnswer = true
            this.updateStatus('connected')
          } catch (e) {
            console.warn('[VoiceCall] Remote answer error:', e)
          }
        }
      })
      .on('broadcast', { event: 'signal:ice' }, async ({ payload }) => {
        if (payload.candidate) {
          await this.addIceCandidateSafe(payload.candidate)
        }
      })
      .on('broadcast', { event: 'call:speaking' }, ({ payload }) => {
        this.onRemoteSpeakingChange?.(Boolean(payload.speaking))
      })

    await this.signalChannel.subscribe()

    // Immediately sync with backend in case of reload/reconnect
    void this.syncFromBackend()
  }

  /** Caller initiates WebRTC offer */
  private async startPeerConnectionAsCaller() {
    try {
      this.createPeerConnection()

      try {
        await this.acquireMicrophone()
        await this.attachLocalAudio()
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

        // Persist offer in Supabase backend
        void supabase
          .from('call_sessions')
          .update({
            offer: offer,
            status: 'calling',
            updated_at: new Date().toISOString(),
          })
          .eq('call_id', this.callId)

        // Broadcast offer for ultra-low latency
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
        await this.attachLocalAudio()
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

      // Update backend status to accepted
      void supabase
        .from('call_sessions')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('call_id', this.callId)

      // Inform caller that call is accepted
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'call:accepted',
        payload: { acceptedBy: this.myUser.id },
      })

      // Immediately sync with backend in case offer was already generated
      void this.syncFromBackend()
    } catch (err) {
      console.warn('[VoiceCall] acceptCall error:', err)
      this.endCall(true, 'declined')
    }
  }

  /** Callee receives offer from Caller and generates answer */
  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (this.handledOffer) return
    if (!this.pc) this.createPeerConnection()
    try {
      if (this.pc) {
        this.handledOffer = true
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
        allowSendingAudio(this.pc)
        await this.attachLocalAudio()
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)

        // Persist answer in backend
        void supabase
          .from('call_sessions')
          .update({
            answer: answer,
            status: 'connected',
            updated_at: new Date().toISOString(),
          })
          .eq('call_id', this.callId)

        // Fast broadcast
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:answer',
          payload: { sdp: answer },
        })

        this.updateStatus('connected')
        void this.syncFromBackend()
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
        // Fast broadcast
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:ice',
          payload: { candidate: e.candidate },
        })

        // Backend persistence in Supabase
        void supabase.rpc('append_call_candidate', {
          p_call_id: this.callId,
          p_is_caller: this.isCaller,
          p_candidate: e.candidate.toJSON(),
        })
      }
    }

    this.pc.ontrack = (e) => {
      const incoming = e.streams && e.streams[0] ? e.streams[0] : e.track ? new MediaStream([e.track]) : null
      if (incoming) {
        this.remoteStream = incoming
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
      } else if (state === 'disconnected') {
        // Try recovering via backend sync before hanging up
        void this.syncFromBackend()
      } else if (state === 'failed' || state === 'closed') {
        if (this.status === 'connected') {
          this.endCall(false)
        }
      }
    }
  }

  /** Send the current microphone track (once) over the peer connection, honouring mute. */
  private async attachLocalAudio() {
    if (!this.pc || !this.localStream) return
    const track = this.localStream.getAudioTracks()[0]
    if (!track) return
    track.enabled = !this.isMuted
    await sendAudioTrack(this.pc, track, this.localStream)
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
    await this.attachLocalAudio()

    return this.localStream
  }

  /** Toggle local mic mute */
  public async toggleMute(): Promise<boolean> {
    if (!this.localStream || !this.localStream.active || this.localStream.getAudioTracks().every((t) => t.readyState === 'ended')) {
      try {
        this.isMuted = false // acquireMicrophone enables the new track based on this flag
        await this.acquireMicrophone()
        playMicOn()
        return false
      } catch {
        this.isMuted = true
        return true
      }
    }

    // Muting stops the tracks so the browser releases the microphone (its "in use" indicator goes off);
    // unmuting re-acquires it above.
    this.isMuted = true
    if (this.pc) silenceAudio(this.pc)
    for (const track of this.localStream.getTracks()) track.stop()
    this.localStream = null
    playMicOff()
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
      await this.attachLocalAudio()
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
    const prev = this.status
    this.status = newStatus
    this.syncRinging()
    if (newStatus === 'connected' && prev !== 'connected') playConnected()
    else if (newStatus === 'ended' && prev !== 'ended') playHangup()
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

    // Persist final call status in Supabase backend
    void supabase
      .from('call_sessions')
      .update({
        status: finalStatus,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', this.callId)
      .then(
        () => {},
        () => {}
      )

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

    const summary = { status: finalStatus, duration: this.duration }
    this.onCallEnded?.(summary)
    for (const listener of this.onCallEndedListeners) {
      try {
        listener(summary)
      } catch (err) {
        console.error('[VoiceCall] onCallEndedListener error:', err)
      }
    }
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
