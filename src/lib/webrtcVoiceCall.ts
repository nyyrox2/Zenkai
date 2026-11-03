import { supabase } from './supabase'
import { requestMicrophoneStream } from './microphone'
import { allowSendingAudio, sendAudioTrack } from './rtcAudio'
import { playConnected, playHangup, playMicOff, playMicOn, startRinging, stopRinging } from './sounds'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 8,
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
  public isAccepted: boolean = false
  public pendingOffer: RTCSessionDescriptionInit | null = null
  public status: CallStatus = 'idle'
  public isMuted: boolean = false
  public isDeafened: boolean = false
  public isOnHold: boolean = false
  public localOffer?: RTCSessionDescriptionInit
  public localAnswer?: RTCSessionDescriptionInit
  private connectingPollTimer?: number
  public isRemoteOnHold: boolean = false
  public isRemoteMuted: boolean = false
  public connectedAt?: number
  public duration: number = 0
  public micPermissionDenied: boolean = false
  public partnerDisconnectSecondsLeft: number = 60
  private partnerDisconnectTimer?: number
  private audioWatchdogTimer?: number

  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private remoteAudio: HTMLAudioElement | null = null
  public signalChannel: ReturnType<typeof supabase.channel> | null = null

  // Listeners & signaling tracking
  private onCallEndedListeners: Array<(summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void> = []
  private handledOffer = false
  private handledAnswer = false
  private processedCandidates = new Set<string>()

  private onStatusChange?: (status: CallStatus) => void
  private onRemoteSpeakingChange?: (speaking: boolean) => void
  private onRemoteMuteChange?: (isMuted: boolean) => void
  private onCallEnded?: (summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void
  private onMicPermissionError?: (error: any) => void
  private onPartnerDisconnectTick?: (secondsLeft: number) => void

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
    this.isAccepted = options.isCaller
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
        el.volume = 1.0
        ;(el as any).playsInline = true
        el.setAttribute('playsinline', 'true')
        el.setAttribute('webkit-playsinline', 'true')
        // Keep active with invisible fixed placement so browser power saver does not mute/pause it
        el.style.position = 'fixed'
        el.style.bottom = '0'
        el.style.right = '0'
        el.style.width = '1px'
        el.style.height = '1px'
        el.style.opacity = '0.01'
        el.style.pointerEvents = 'none'
        el.style.zIndex = '-9999'
        document.body.appendChild(el)
      }
      this.remoteAudio = el
      this.remoteAudio.volume = 1.0
      this.remoteAudio.onpause = () => {
        if (this.status === 'connected' && !this.isOnHold && !this.isDeafened && this.remoteStream) {
          void this.remoteAudio?.play().catch(() => {})
        }
      }

      // Unlock browser autoplay policy on any user interaction
      const unlockAudio = () => {
        if (this.remoteAudio && this.remoteStream && this.remoteAudio.paused && !this.isOnHold && !this.isDeafened) {
          void this.remoteAudio.play().catch(() => {})
        }
      }
      window.addEventListener('click', unlockAudio, { passive: true })
      window.addEventListener('touchstart', unlockAudio, { passive: true })
    }
    if (this.remoteStream && this.remoteAudio.srcObject !== this.remoteStream) {
      this.remoteAudio.srcObject = this.remoteStream
    }
    this.remoteAudio.muted = this.isDeafened || this.isOnHold
    this.remoteAudio.volume = 1.0
    return this.remoteAudio
  }

  /** Periodic watchdog to guarantee remote audio continues playing and local mic remains live */
  private startAudioWatchdog() {
    if (this.audioWatchdogTimer) return
    this.audioWatchdogTimer = window.setInterval(() => {
      if (this.status !== 'connected') return
      if (this.remoteAudio && this.remoteStream && !this.isOnHold && !this.isDeafened) {
        if (this.remoteAudio.paused) {
          void this.remoteAudio.play().catch(() => {})
        }
      }
      if (this.localStream && !this.isMuted && !this.isOnHold) {
        const audioTracks = this.localStream.getAudioTracks()
        if (audioTracks.length === 0 || audioTracks.every((t) => t.readyState === 'ended')) {
          void this.acquireMicrophone().catch(() => {})
        }
      }
    }, 2500)
  }

  private stopAudioWatchdog() {
    if (this.audioWatchdogTimer) {
      clearInterval(this.audioWatchdogTimer)
      this.audioWatchdogTimer = undefined
    }
  }

  /** Start a 60-second reconnect window when partner temporarily disconnects / refreshes */
  public handlePartnerDisconnected() {
    if (this.status === 'ended') return
    if (this.connectedAt) {
      this.updateStatus('connecting')
      if (this.partnerDisconnectTimer) return
      this.partnerDisconnectSecondsLeft = 60
      this.onPartnerDisconnectTick?.(60)

      this.partnerDisconnectTimer = window.setInterval(() => {
        this.partnerDisconnectSecondsLeft--
        this.onPartnerDisconnectTick?.(this.partnerDisconnectSecondsLeft)
        if (this.partnerDisconnectSecondsLeft <= 0) {
          this.clearPartnerDisconnectTimer()
          // 60 seconds elapsed without partner rejoining: end call
          this.endCall(true, 'ended')
        }
      }, 1000)
    }
  }

  public clearPartnerDisconnectTimer() {
    if (this.partnerDisconnectTimer) {
      clearInterval(this.partnerDisconnectTimer)
      this.partnerDisconnectTimer = undefined
    }
    this.partnerDisconnectSecondsLeft = 60
    this.onPartnerDisconnectTick?.(60)
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
    onRemoteMuteChange?: (isMuted: boolean) => void
    onCallEnded?: (summary: { status: 'ended' | 'missed' | 'declined'; duration: number }) => void
    onMicPermissionError?: (error: any) => void
    onPartnerDisconnectTick?: (secondsLeft: number) => void
  }) {
    if (cbs.onStatusChange !== undefined) this.onStatusChange = cbs.onStatusChange
    if (cbs.onRemoteSpeakingChange !== undefined) this.onRemoteSpeakingChange = cbs.onRemoteSpeakingChange
    if (cbs.onRemoteMuteChange !== undefined) this.onRemoteMuteChange = cbs.onRemoteMuteChange
    if (cbs.onCallEnded !== undefined) {
      this.onCallEndedListeners.push(cbs.onCallEnded)
      this.onCallEnded = cbs.onCallEnded
    }
    if (cbs.onMicPermissionError !== undefined) this.onMicPermissionError = cbs.onMicPermissionError
    if (cbs.onPartnerDisconnectTick !== undefined) this.onPartnerDisconnectTick = cbs.onPartnerDisconnectTick
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
      setTimeout(() => void this.addIceCandidateSafe(candidate), 300)
      return
    }
    this.processedCandidates.add(key)
    try {
      await this.pc.addIceCandidate(candidate)
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

      // Terminal checks first! If call ended or was declined, stop and exit immediately.
      if (data.status === 'declined' && this.status !== 'ended') {
        this.clearPartnerDisconnectTimer()
        this.endCall(false, 'declined')
        return
      }
      if (data.status === 'ended' && this.status !== 'ended') {
        this.clearPartnerDisconnectTimer()
        this.endCall(false, 'ended')
        return
      }

      if (this.isCaller && (data.status === 'accepted' || data.status === 'connecting') && !this.handledOffer) {
        await this.startPeerConnectionAsCaller()
      }

      if (!this.isCaller && data.offer) {
        this.pendingOffer = data.offer
        // Callee only processes offer if user has clicked "Accept"
        if (this.isAccepted && !this.handledOffer) {
          await this.handleOffer(data.offer)
        }
      } else if (this.isCaller && data.answer && !this.handledAnswer && this.pc) {
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          this.handledAnswer = true
          this.updateStatus('connected')
        } catch (e) {
          console.warn('[VoiceCall] Apply answer from DB error:', e)
        }
      }

      if (data.status === 'hold') {
        this.isRemoteOnHold = true
        if (this.status !== 'hold') this.updateStatus('hold')
      } else if (data.status === 'connected') {
        this.isRemoteOnHold = false
        if (this.status !== 'connected' && this.status !== 'ended' && !this.isOnHold) {
          this.updateStatus('connected')
        }
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

        // Terminal checks first!
        if (row.status === 'declined' && this.status !== 'ended') {
          this.clearPartnerDisconnectTimer()
          this.endCall(false, 'declined')
          return
        }
        if (row.status === 'ended' && this.status !== 'ended') {
          this.clearPartnerDisconnectTimer()
          this.endCall(false, 'ended')
          return
        }

        if (this.isCaller && (row.status === 'accepted' || row.status === 'connecting') && !this.handledOffer) {
          await this.startPeerConnectionAsCaller()
        }

        if (!this.isCaller && row.offer) {
          this.pendingOffer = row.offer
          if (this.isAccepted && !this.handledOffer) {
            await this.handleOffer(row.offer)
          }
        } else if (this.isCaller && row.answer && !this.handledAnswer && this.pc) {
          try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(row.answer))
            this.handledAnswer = true
            this.updateStatus('connected')
          } catch (e) {
            console.warn('[VoiceCall] Apply answer from DB error:', e)
          }
        }

        if (row.status === 'hold') {
          this.isRemoteOnHold = true
          if (this.status !== 'hold') this.updateStatus('hold')
        } else if (row.status === 'connected') {
          this.isRemoteOnHold = false
          if (this.status !== 'connected' && this.status !== 'ended' && !this.isOnHold) {
            this.updateStatus('connected')
          }
        }

        this.applyDbCandidates(row)
      }
    )

    this.signalChannel
      .on('broadcast', { event: 'call:accepted' }, async () => {
        if (this.isCaller) {
          this.clearPartnerDisconnectTimer()
          this.updateStatus('connecting')
          if (!this.localOffer || !this.pc || this.pc.signalingState === 'closed') {
            await this.startPeerConnectionAsCaller(false)
          } else {
            void this.signalChannel?.send({
              type: 'broadcast',
              event: 'signal:offer',
              payload: { sdp: this.localOffer },
            })
          }
        }
      })
      .on('broadcast', { event: 'call:rejected' }, ({ payload }) => {
        this.clearPartnerDisconnectTimer()
        if (payload?.reason === 'busy') {
          console.warn('[VoiceCall] Partner is busy on another call')
        }
        this.endCall(false, 'declined')
      })
      .on('broadcast', { event: 'call:ended' }, () => {
        this.clearPartnerDisconnectTimer()
        this.endCall(false, 'ended')
      })
      .on('broadcast', { event: 'call:partner_reloading' }, () => {
        this.handlePartnerDisconnected()
      })
      .on('broadcast', { event: 'call:hold' }, () => {
        this.isRemoteOnHold = true
        if (this.status !== 'hold') this.updateStatus('hold')
      })
      .on('broadcast', { event: 'call:resume' }, () => {
        this.isRemoteOnHold = false
        if (!this.isOnHold) this.updateStatus('connected')
      })
      .on('broadcast', { event: 'call:reconnect' }, async (eventPayload) => {
        console.log('[VoiceCall] Partner reconnected:', eventPayload)
        this.clearPartnerDisconnectTimer()
        if (this.pc) {
          try {
            this.pc.close()
          } catch {}
          this.pc = null
        }
        this.handledOffer = false
        this.handledAnswer = false
        this.localOffer = undefined
        this.localAnswer = undefined
        this.processedCandidates.clear()
        this.updateStatus('connecting')

        if (!this.localStream || !this.localStream.active) {
          try {
            await this.acquireMicrophone()
          } catch {}
        }

        if (this.isCaller) {
          await this.startPeerConnectionAsCaller(true)
        } else {
          this.createPeerConnection()
          if (this.pc) {
            allowSendingAudio(this.pc)
            await this.attachLocalAudio()
          }
          void this.signalChannel?.send({
            type: 'broadcast',
            event: 'signal:request_offer',
            payload: { requestedBy: this.myUser.id },
          })
          void this.syncFromBackend()
        }
      })
      .on('broadcast', { event: 'signal:request_offer' }, async () => {
        if (this.isCaller) {
          if (this.localOffer && this.pc && this.pc.signalingState !== 'closed') {
            void this.signalChannel?.send({
              type: 'broadcast',
              event: 'signal:offer',
              payload: { sdp: this.localOffer },
            })
          } else {
            await this.startPeerConnectionAsCaller(false)
          }
        }
      })
      .on('broadcast', { event: 'signal:offer' }, async ({ payload }) => {
        if (!this.isCaller && payload.sdp) {
          this.pendingOffer = payload.sdp
          if (this.isAccepted && !this.handledOffer) {
            await this.handleOffer(payload.sdp)
          }
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
      .on('broadcast', { event: 'call:connected' }, () => {
        this.clearPartnerDisconnectTimer()
        if (this.status !== 'connected' && this.status !== 'ended') {
          this.updateStatus('connected')
        }
      })
      .on('broadcast', { event: 'call:mute' }, ({ payload }) => {
        this.isRemoteMuted = Boolean(payload?.muted)
        this.onRemoteMuteChange?.(this.isRemoteMuted)
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

  /** Restore or recover an ongoing active voice call across refresh or tab reopen */
  public async reconnect(): Promise<void> {
    this.updateStatus('connecting')
    if (this.pc) {
      try {
        this.pc.close()
      } catch {}
      this.pc = null
    }
    this.handledOffer = false
    this.handledAnswer = false
    this.localOffer = undefined
    this.localAnswer = undefined
    this.processedCandidates.clear()

    // Ensure audio element exists and is active
    this.ensureRemoteAudio()
    if (this.remoteAudio) {
      this.remoteAudio.play().catch(() => {})
    }

    try {
      await this.acquireMicrophone()
    } catch (err) {
      console.warn('[VoiceCall] Mic acquisition during reconnect:', err)
      this.micPermissionDenied = true
      this.onMicPermissionError?.(err)
    }

    if (this.isCaller) {
      await this.startPeerConnectionAsCaller(true)
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'call:reconnect',
        payload: { by: this.myUser.id, role: 'caller' },
      })
    } else {
      this.createPeerConnection()
      if (this.pc) {
        allowSendingAudio(this.pc)
        await this.attachLocalAudio()
      }
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'call:reconnect',
        payload: { by: this.myUser.id, role: 'callee' },
      })
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'signal:request_offer',
        payload: { requestedBy: this.myUser.id },
      })
      void this.syncFromBackend()
    }
  }

  /** Caller initiates WebRTC offer */
  public async startPeerConnectionAsCaller(forceFresh = false) {
    if (!forceFresh && this.handledOffer && this.localOffer && this.pc && this.pc.signalingState !== 'closed') {
      const offerPayload: RTCSessionDescriptionInit = {
        type: this.localOffer.type,
        sdp: this.localOffer.sdp,
      }
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'signal:offer',
        payload: { sdp: offerPayload },
      })
      void supabase
        .from('call_sessions')
        .upsert({
          call_id: this.callId,
          caller_id: this.myUser.id,
          callee_id: this.partner.id,
          offer: offerPayload,
          status: 'connecting',
          updated_at: new Date().toISOString(),
        })
      return
    }
    try {
      this.updateStatus('connecting')
      if (this.pc) {
        try {
          this.pc.close()
        } catch {}
        this.pc = null
      }
      this.handledOffer = false
      this.handledAnswer = false
      this.localOffer = undefined
      this.processedCandidates.clear()
      const pc = this.createPeerConnection()

      try {
        await this.acquireMicrophone()
        await this.attachLocalAudio()
      } catch (micErr) {
        console.warn('[VoiceCall] Mic acquisition deferred/denied:', micErr)
        this.micPermissionDenied = true
        this.onMicPermissionError?.(micErr)
      }

      if (pc.getSenders().length === 0) {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' })
        } catch {}
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      })
      await pc.setLocalDescription(offer)
      const offerPayload: RTCSessionDescriptionInit = {
        type: offer.type,
        sdp: offer.sdp,
      }
      this.handledOffer = true
      this.localOffer = offerPayload

      // Persist offer in Supabase backend
      void supabase
        .from('call_sessions')
        .upsert({
          call_id: this.callId,
          caller_id: this.myUser.id,
          callee_id: this.partner.id,
          offer: offerPayload,
          status: 'connecting',
          updated_at: new Date().toISOString(),
        })

      // Broadcast offer for ultra-low latency
      void this.signalChannel?.send({
        type: 'broadcast',
        event: 'signal:offer',
        payload: { sdp: offerPayload },
      })
    } catch (err) {
      console.warn('[VoiceCall] Caller setup error:', err)
      this.endCall(true, 'missed')
    }
  }

  /** Callee accepts incoming call */
  public async acceptCall(preacquiredStream?: MediaStream) {
    try {
      this.isAccepted = true
      this.clearPartnerDisconnectTimer()
      this.updateStatus('connecting')
      this.createPeerConnection()

      try {
        await this.acquireMicrophone(preacquiredStream)
      } catch (micErr) {
        console.warn('[VoiceCall] Callee mic deferred/denied:', micErr)
        this.micPermissionDenied = true
        this.onMicPermissionError?.(micErr)
      }

      // If caller's offer already arrived while ringing, process it immediately!
      if (this.pendingOffer && !this.handledOffer) {
        await this.handleOffer(this.pendingOffer)
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

      // Only request offer from caller if we didn't receive one already
      if (!this.handledOffer && !this.pendingOffer) {
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:request_offer',
          payload: { requestedBy: this.myUser.id },
        })
      }

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
        if (this.localStream) {
          await this.attachLocalAudio()
        }
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        const answerPayload: RTCSessionDescriptionInit = {
          type: answer.type,
          sdp: answer.sdp,
        }
        this.handledAnswer = true
        this.localAnswer = answerPayload

        // Persist answer in backend
        void supabase
          .from('call_sessions')
          .update({
            answer: answerPayload,
            status: 'connecting',
            updated_at: new Date().toISOString(),
          })
          .eq('call_id', this.callId)

        // Fast broadcast
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'signal:answer',
          payload: { sdp: answerPayload },
        })

        // Apply any caller ICE candidates that arrived early
        void this.syncFromBackend()
      }
    } catch (err) {
      console.warn('[VoiceCall] handleOffer error:', err)
      this.endCall()
    }
  }

  private createPeerConnection(): RTCPeerConnection {
    if (this.pc) return this.pc
    const pc = new RTCPeerConnection(RTC_CONFIG)
    this.pc = pc

    pc.onicecandidate = (e) => {
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

    pc.ontrack = (e) => {
      const incoming = e.streams && e.streams[0] ? e.streams[0] : e.track ? new MediaStream([e.track]) : null
      if (incoming) {
        this.remoteStream = incoming
        this.ensureRemoteAudio()
        if (this.remoteAudio) {
          this.remoteAudio.srcObject = this.remoteStream
          this.remoteAudio.muted = this.isDeafened || this.isOnHold
          this.remoteAudio.volume = 1.0
          void this.remoteAudio.play().catch(() => {})
        }

        if (e.track) {
          e.track.onunmute = () => {
            if (this.remoteAudio && !this.isOnHold && !this.isDeafened) {
              void this.remoteAudio.play().catch(() => {})
            }
          }
        }

        if (this.status === 'connecting' || this.status === 'calling') {
          this.updateStatus('connected')
        }
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
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

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState
      if (ice === 'connected' || ice === 'completed') {
        this.updateStatus('connected')
      } else if (ice === 'failed') {
        void this.syncFromBackend()
      }
    }

    return pc
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

    void this.signalChannel?.send({
      type: 'broadcast',
      event: 'call:mute',
      payload: { muted: this.isMuted, by: this.myUser.id },
    })

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

    if (newStatus === 'connected') {
      this.startAudioWatchdog()
      this.clearPartnerDisconnectTimer()
      if (prev !== 'connected' && prev !== 'hold') {
        playConnected()
        // Broadcast connected event to partner
        void this.signalChannel?.send({
          type: 'broadcast',
          event: 'call:connected',
          payload: { by: this.myUser.id },
        })
        // Persist connected state in Supabase backend
        void supabase
          .from('call_sessions')
          .update({
            status: 'connected',
            updated_at: new Date().toISOString(),
          })
          .eq('call_id', this.callId)
      }
    } else if (newStatus === 'ended') {
      this.stopAudioWatchdog()
      this.clearPartnerDisconnectTimer()
      if (prev !== 'ended') playHangup()
    }
    this.onStatusChange?.(newStatus)
  }

  /** Reject or end call */
  public endCall(sendBroadcast = true, reason?: 'ended' | 'missed' | 'declined') {
    this.clearPartnerDisconnectTimer()
    this.stopAudioWatchdog()
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

    if (this.signalChannel) {
      const chan = this.signalChannel
      if (sendBroadcast) {
        void chan.send({
          type: 'broadcast',
          event: this.status === 'incoming' ? 'call:rejected' : 'call:ended',
          payload: { by: this.myUser.id, reason: finalStatus },
        })
      }
      setTimeout(() => {
        void supabase.removeChannel(chan)
      }, 350)
      this.signalChannel = null
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
