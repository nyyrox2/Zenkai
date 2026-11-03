import { supabase } from './supabase'
import { requestMicrophoneStream } from './microphone'
import { allowSendingAudio, sendAudioTrack } from './rtcAudio'
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

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'hold' | 'ended'

export class DirectVoiceCall {
  public callId: string
  public myUser: CallUserInfo
  public partner: CallUserInfo
  public isCaller: boolean
  public status: CallStatus = 'idle'
  public isMuted: boolean = false
  public isDeafened: boolean = false
  public isOnHold: boolean = false
  public localOffer?: RTCSessionDescriptionInit
  public localAnswer?: RTCSessionDescriptionInit
  private connectingPollTimer?: number
  public isRemoteOnHold: boolean = false
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
    this.ensureRemoteAudio()
  }

  /** Continuous elapsed call duration (seconds) that persists across page navigations */
  public getDuration(): number {
    if (!this.connectedAt) return 0
    return Math.max(0, Math.floor((Date.now() - this.connectedAt) / 1000))
  }

  /** Attach persistent audio element to the document body to prevent throttling / garbage collection */
  private ensureRemoteAudio(): HTMLAudioElement | null {
    if (typeof document === 'undefined') return null
    if (!this.remoteAudio) {
      let el = document.getElementById('zk-voice-remote-audio') as HTMLAudioElement | null
      if (!el) {
        el = document.createElement('audio')
        el.id = 'zk-voice-remote-audio'
        el.autoplay = true
        ;(el as any).playsInline = true
        el.style.display = 'none'
        document.body.appendChild(el)
      }
      this.remoteAudio = el
    }
    if (this.remoteStream) {
      this.remoteAudio.srcObject = this.remoteStream
    }
    this.remoteAudio.muted = this.isDeafened || this.isOnHold
    return this.remoteAudio
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
      // ignore duplicate candidate
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

      if (this.isCaller && (data.status === 'accepted' || data.status === 'connecting') && !this.handledOffer) {
        await this.startPeerConnectionAsCaller()
      }

      if (!this.isCaller && data.offer && !this.handledOffer) {
        await this.handleOffer(data.offer)
      } else if (this.isCaller && data.answer && !this.handledAnswer && this.pc) {
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          this.handledAnswer = true
          this.updateStatus('connecting')
        } catch (e) {
          console.warn('[VoiceCall] Apply answer from DB error:', e)
        }
      }

      if (data.status === 'hold') {
        this.isRemoteOnHold = true
        if (this.status !== 'hold') this.updateStatus('hold')
      } else if (data.status === 'connected' && this.isRemoteOnHold) {
        this.isRemoteOnHold = false
        if (!this.isOnHold) this.updateStatus('connected')
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
      try {
        await supabase
          .from('call_sessions')
          .upsert({
            call_id: this.callId,
            caller_id: this.myUser.id,
            callee_id: this.partner.id,
            status: 'calling',
            updated_at: new Date().toISOString(),
          })
      } catch (err: any) {
        console.warn('[VoiceCall] DB init session error:', err)
      }
    }

    // Realtime Postgres database updates for call_sessions
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

        if (this.isCaller && (row.status === 'accepted' || row.status === 'connecting') && !this.handledOffer) {
          await this.startPeerConnectionAsCaller()
        }

        if (!this.isCaller && row.offer && !this.handledOffer) {
          await this.handleOffer(row.offer)
        } else if (this.isCaller && row.answer && !this.handledAnswer && this.pc) {
          try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(row.answer))
            this.handledAnswer = true
            this.updateStatus('connecting')
          } catch (e) {
            console.warn('[VoiceCall] Apply answer from DB error:', e)
          }
        }

        if (row.status === 'hold') {
          this.isRemoteOnHold = true
          if (this.status !== 'hold') this.updateStatus('hold')
        } else if (row.status === 'connected' && this.isRemoteOnHold) {
          this.isRemoteOnHold = false
          if (!this.isOnHold) this.updateStatus('connected')
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
        if (this.isCaller) {
          this.updateStatus('connecting')
          await this.startPeerConnectionAsCaller()
        }
      })
      .on('broadcast', { event: 'call:rejected' }, () => {
        this.endCall(false, 'declined')
      })
      .on('broadcast', { event: 'call:ended' }, () => {
        this.endCall(false, this.status === 'incoming' ? 'missed' : undefined)
      })
      .on('broadcast', { event: 'call:hold' }, () => {
        this.isRemoteOnHold = true
        if (this.status !== 'hold') this.updateStatus('hold')
      })
      .on('broadcast', { event: 'call:resume' }, () => {
        this.isRemoteOnHold = false
        if (!this.isOnHold) this.updateStatus('connected')
      })
      .on('broadcast', { event: 'signal:request_offer' }, () => {
        if (this.isCaller && this.localOffer) {
          void this.signalChannel?.send({
            type: 'broadcast',
            event: 'signal:offer',
            payload: { sdp: this.localOffer },
          })
        }
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
            this.updateStatus('connecting')
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
  public async startPeerConnectionAsCaller() {
    if (this.handledOffer && this.localOffer) {
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'signal:offer',
        payload: { sdp: this.localOffer },
      })
      void supabase
        .from('call_sessions')
        .upsert({
          call_id: this.callId,
          caller_id: this.myUser.id,
          callee_id: this.partner.id,
          offer: this.localOffer,
          status: 'connecting',
          updated_at: new Date().toISOString(),
        })
      return
    }
    try {
      this.updateStatus('connecting')
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

        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true,
        })
        await this.pc.setLocalDescription(offer)
        this.handledOffer = true
        this.localOffer = offer

        // Persist offer in Supabase backend
        void supabase
          .from('call_sessions')
          .upsert({
            call_id: this.callId,
            caller_id: this.myUser.id,
            callee_id: this.partner.id,
            offer: offer,
            status: 'connecting',
            updated_at: new Date().toISOString(),
          })

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
      this.updateStatus('connecting')
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

      // Update backend status to accepted / connecting
      void supabase
        .from('call_sessions')
        .update({
          status: 'connecting',
          updated_at: new Date().toISOString(),
        })
        .eq('call_id', this.callId)

      // Inform caller that call is accepted
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'call:accepted',
        payload: { acceptedBy: this.myUser.id },
      })

      // Prompt caller to send offer immediately
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'signal:request_offer',
        payload: { requestedBy: this.myUser.id },
      })

      // Ensure remote audio element is created and unlocked
      this.ensureRemoteAudio()
      if (this.remoteAudio) {
        this.remoteAudio.play().catch(() => {})
      }

      // Immediately sync with backend to retrieve offer
      void this.syncFromBackend()
    } catch (err) {
      console.warn('[VoiceCall] acceptCall error:', err)
      this.endCall(true, 'declined')
    }
  }

  /** Callee receives offer from Caller and generates answer */
  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (this.handledAnswer) return
    if (!this.pc) this.createPeerConnection()
    try {
      if (this.pc) {
        this.handledOffer = true
        this.updateStatus('connecting')
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
        allowSendingAudio(this.pc)
        await this.attachLocalAudio()
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        this.handledAnswer = true
        this.localAnswer = answer

        // Persist answer in backend
        void supabase
          .from('call_sessions')
          .update({
            answer: answer,
            status: 'connecting',
            updated_at: new Date().toISOString(),
          })
          .eq('call_id', this.callId)

        // Fast broadcast
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:answer',
          payload: { sdp: answer },
        })

        // Apply any caller ICE candidates that arrived early
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
        this.ensureRemoteAudio()
        if (this.remoteAudio) {
          this.remoteAudio.srcObject = this.remoteStream
          this.remoteAudio.muted = this.isDeafened || this.isOnHold
          this.remoteAudio.play().catch(() => {})
        }
        if (this.status === 'connecting' || this.status === 'calling') {
          this.updateStatus('connected')
        }
      }
    }

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState
      if (state === 'connected') {
        this.updateStatus('connected')
      } else if (state === 'disconnected') {
        if (this.status === 'connected') {
          this.updateStatus('connecting')
          void this.syncFromBackend()
        }
      } else if (state === 'failed') {
        void this.syncFromBackend()
      } else if (state === 'closed') {
        if (this.status !== 'ended') {
          this.endCall(false)
        }
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      const ice = this.pc?.iceConnectionState
      if (ice === 'connected' || ice === 'completed') {
        this.updateStatus('connected')
      } else if (ice === 'failed') {
        void this.syncFromBackend()
      }
    }
  }

  /** Send the current microphone track (once) over the peer connection, honouring mute & hold. */
  private async attachLocalAudio() {
    if (!this.pc || !this.localStream) return
    const track = this.localStream.getAudioTracks()[0]
    if (!track) return
    track.enabled = !this.isMuted && !this.isOnHold
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
        this.isMuted = false
        await this.acquireMicrophone()
        playMicOn()
        return false
      } catch {
        this.isMuted = true
        return true
      }
    }

    this.isMuted = !this.isMuted
    const track = this.localStream.getAudioTracks()[0]
    if (track) {
      track.enabled = !this.isMuted && !this.isOnHold
    }

    if (this.isMuted) playMicOff()
    else playMicOn()

    return this.isMuted
  }

  /** Toggle call on hold */
  public async toggleHold(): Promise<boolean> {
    this.isOnHold = !this.isOnHold

    if (this.localStream) {
      const track = this.localStream.getAudioTracks()[0]
      if (track) track.enabled = !this.isMuted && !this.isOnHold
    }

    if (this.remoteAudio) {
      this.remoteAudio.muted = this.isDeafened || this.isOnHold
    }

    const nextStatus: CallStatus = this.isOnHold ? 'hold' : (this.connectedAt ? 'connected' : 'connecting')
    this.updateStatus(nextStatus)

    // Notify partner of hold status
    if (this.signalChannel) {
      void this.signalChannel.send({
        type: 'broadcast',
        event: this.isOnHold ? 'call:hold' : 'call:resume',
        payload: { by: this.myUser.id },
      })
    }

    void supabase
      .from('call_sessions')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', this.callId)

    return this.isOnHold
  }

  /** Toggle deafen (mute incoming remote audio) */
  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened
    if (this.remoteAudio) {
      this.remoteAudio.muted = this.isDeafened || this.isOnHold
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

  private startConnectingPoll() {
    if (this.connectingPollTimer) return
    let tick = 0
    this.connectingPollTimer = window.setInterval(() => {
      tick++
      if (this.status !== 'connecting' || tick > 25) {
        if (this.connectingPollTimer) {
          clearInterval(this.connectingPollTimer)
          this.connectingPollTimer = undefined
        }
        return
      }
      void this.syncFromBackend()
      if (this.isCaller && this.localOffer) {
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:offer',
          payload: { sdp: this.localOffer },
        })
      } else if (!this.isCaller && !this.handledOffer) {
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:request_offer',
          payload: { requestedBy: this.myUser.id },
        })
      }
    }, 1200)
  }

  private updateStatus(newStatus: CallStatus) {
    if (newStatus === 'connected' && !this.connectedAt) {
      this.connectedAt = Date.now()
    }
    const prev = this.status
    this.status = newStatus
    this.syncRinging()

    if (newStatus === 'connecting') {
      this.startConnectingPoll()
    } else if (this.connectingPollTimer && (newStatus === 'connected' || newStatus === 'ended')) {
      clearInterval(this.connectingPollTimer)
      this.connectingPollTimer = undefined
    }

    if (newStatus === 'connected' && prev !== 'connected' && prev !== 'hold') playConnected()
    else if (newStatus === 'ended' && prev !== 'ended') playHangup()
    this.onStatusChange?.(newStatus)
  }

  /** Reject or end call */
  public endCall(sendBroadcast = true, reason?: 'ended' | 'missed' | 'declined') {
    if (this.connectingPollTimer) {
      clearInterval(this.connectingPollTimer)
      this.connectingPollTimer = undefined
    }
    let finalStatus: 'ended' | 'missed' | 'declined' = reason || 'ended'

    if (!reason) {
      if (this.status === 'connected' || this.status === 'hold' || this.connectedAt) {
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
