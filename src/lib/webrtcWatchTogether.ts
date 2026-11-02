import { supabase } from './supabase'
import { requestMicrophoneStream } from './microphone'

export interface PeerMember {
  peerId: string
  userId?: string
  username: string
  displayName: string
  avatar: string | null
  isHost: boolean
  p2pConnected: boolean
  latencyMs?: number
  isMicActive?: boolean
  isLocallyMuted?: boolean
}

export interface WatchChatMessage {
  id: string
  senderId: string
  senderName: string
  avatar: string | null
  text: string
  timestamp: number
}

export interface WatchReaction {
  id: string
  emoji: string
  senderName: string
}

export type SyncActionType =
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'HEARTBEAT'
  | 'CHANGE_EP'
  | 'CHANGE_SHOW'
  | 'CHANGE_SERVER'
  | 'CHANGE_AUDIO'

export interface SyncPayload {
  type: SyncActionType
  currentTime: number
  paused?: boolean
  episode?: number
  animeId?: number
  animeTitle?: string
  server?: string
  audio?: 'sub' | 'dub'
  timestamp: number
  senderId: string
}

// STUN configuration using Google's public STUN servers for NAT traversal
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 6,
}

export class WatchTogetherRoom {
  public roomId: string
  public peerId: string
  public isHost: boolean
  public hostOnlyControl: boolean = true
  public animeId: number
  public episode: number
  public animeTitle: string
  public server: string

  private channel: ReturnType<typeof supabase.channel> | null = null
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private dataChannels: Map<string, RTCDataChannel> = new Map()
  private peers: Map<string, PeerMember> = new Map()

  // Voice Chat Mesh Properties
  private localAudioStream: MediaStream | null = null
  private isMicActive: boolean = false
  private mutedPeers: Set<string> = new Set()
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map()
  private peerVoiceStates: Map<string, boolean> = new Map()

  // Listeners
  private onSyncCallback?: (payload: SyncPayload) => void
  private onPeersChangeCallback?: (peers: PeerMember[]) => void
  private onChatCallback?: (msg: WatchChatMessage) => void
  private onReactionCallback?: (reaction: WatchReaction) => void
  private onEpisodeChangeCallback?: (episode: number) => void
  private onShowChangeCallback?: (animeId: number, animeTitle: string, episode: number) => void
  private onServerChangeCallback?: (server: string) => void
  private onAudioChangeCallback?: (audio: 'sub' | 'dub') => void
  private onConnectionStatusChangeCallback?: (status: 'connecting' | 'connected' | 'p2p' | 'disconnected') => void
  private onLocalMicChangeCallback?: (active: boolean) => void

  private isDestroyed = false

  constructor(options: {
    roomId: string
    isHost: boolean
    animeId: number
    episode: number
    animeTitle: string
    server: string
    user: { id?: string; username: string; displayName: string; avatar: string | null }
  }) {
    this.roomId = options.roomId
    this.isHost = options.isHost
    this.animeId = options.animeId
    this.episode = options.episode
    this.animeTitle = options.animeTitle
    this.server = options.server
    this.peerId = options.user.id || `peer_${Math.random().toString(36).substring(2, 9)}`

    // Add self to peer list
    this.peers.set(this.peerId, {
      peerId: this.peerId,
      userId: options.user.id,
      username: options.user.username,
      displayName: options.user.displayName,
      avatar: options.user.avatar,
      isHost: options.isHost,
      p2pConnected: true,
    })

    this.initChannel(options.user)
  }

  private initChannel(user: { id?: string; username: string; displayName: string; avatar: string | null }) {
    const channelName = `wt_room_${this.roomId}`

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: this.peerId },
      },
    })

    // Presence listener: tracks who is currently in the room
    this.channel
      .on('presence', { event: 'sync' }, () => {
        if (this.isDestroyed) return
        const state = this.channel?.presenceState() || {}
        const activePeerIds = new Set<string>()

        for (const [key, presences] of Object.entries(state)) {
          activePeerIds.add(key)
          const p = (presences as any[])[0]
          if (p && key !== this.peerId) {
            const existing = this.peers.get(key)
            this.peers.set(key, {
              peerId: key,
              userId: p.userId,
              username: p.username || `User`,
              displayName: p.displayName || p.username || 'Otaku',
              avatar: p.avatar || null,
              isHost: Boolean(p.isHost),
              p2pConnected: existing?.p2pConnected || false,
              latencyMs: existing?.latencyMs,
            })

            // Mesh peer connection: if connection does not exist yet and this.peerId < key (or host)
            if (!this.peerConnections.has(key) && (this.peerId < key || this.isHost)) {
              void this.initiatePeerConnection(key)
            }
          }
        }

        // Clean up departed peers
        for (const [id, pc] of this.peerConnections.entries()) {
          if (!activePeerIds.has(id)) {
            pc.close()
            this.peerConnections.delete(id)
            this.dataChannels.delete(id)
            this.peers.delete(id)
            const audioEl = this.remoteAudioElements.get(id)
            if (audioEl) {
              audioEl.pause()
              audioEl.srcObject = null
              audioEl.remove()
              this.remoteAudioElements.delete(id)
            }
            this.mutedPeers.delete(id)
            this.peerVoiceStates.delete(id)
          }
        }

        this.notifyPeersChanged()
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (this.isDestroyed || key === this.peerId) return
        const p = (newPresences as any[])[0]
        if (p) {
          this.peers.set(key, {
            peerId: key,
            userId: p.userId,
            username: p.username,
            displayName: p.displayName || p.username,
            avatar: p.avatar || null,
            isHost: Boolean(p.isHost),
            p2pConnected: false,
          })
          this.notifyPeersChanged()

          // Connect mesh peer connection
          if (this.peerId < key || this.isHost) {
            void this.initiatePeerConnection(key)
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (this.isDestroyed || key === this.peerId) return
        const pc = this.peerConnections.get(key)
        if (pc) {
          pc.close()
          this.peerConnections.delete(key)
          this.dataChannels.delete(key)
        }
        const audioEl = this.remoteAudioElements.get(key)
        if (audioEl) {
          audioEl.pause()
          audioEl.srcObject = null
          audioEl.remove()
          this.remoteAudioElements.delete(key)
        }
        this.mutedPeers.delete(key)
        this.peerVoiceStates.delete(key)
        this.peers.delete(key)
        this.notifyPeersChanged()
      })

    // WebRTC Signaling over Supabase Broadcast
    this.channel
      .on('broadcast', { event: 'signal:offer' }, async ({ payload }) => {
        if (payload.targetPeerId !== this.peerId) return
        await this.handleRemoteOffer(payload.fromPeerId, payload.sdp)
      })
      .on('broadcast', { event: 'signal:answer' }, async ({ payload }) => {
        if (payload.targetPeerId !== this.peerId) return
        await this.handleRemoteAnswer(payload.fromPeerId, payload.sdp)
      })
      .on('broadcast', { event: 'signal:ice' }, async ({ payload }) => {
        if (payload.targetPeerId !== this.peerId) return
        await this.handleRemoteIceCandidate(payload.fromPeerId, payload.candidate)
      })
      // Transparent broadcast fallback if WebRTC is still handshaking or symmetric NAT blocks P2P
      .on('broadcast', { event: 'p2p:sync' }, ({ payload }) => {
        this.handleIncomingData(payload)
      })
      .on('broadcast', { event: 'p2p:chat' }, ({ payload }) => {
        this.onChatCallback?.(payload)
      })
      .on('broadcast', { event: 'p2p:reaction' }, ({ payload }) => {
        this.onReactionCallback?.(payload)
      })
      .on('broadcast', { event: 'p2p:voice_status' }, ({ payload }) => {
        if (payload?.peerId) {
          this.peerVoiceStates.set(payload.peerId, Boolean(payload.micActive))
          this.notifyPeersChanged()
        }
      })

    // Subscribe and track presence
    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel?.track({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          isHost: this.isHost,
          joinedAt: Date.now(),
        })
        this.onConnectionStatusChangeCallback?.('connected')
      }
    })
  }

  /** Host/Initiator creates WebRTC connection & DataChannel to target peer */
  private async initiatePeerConnection(targetPeerId: string) {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG)
      this.peerConnections.set(targetPeerId, pc)

      // Add active audio track if local mic is streaming, else prepare audio transceiver for future mic activation
      if (this.localAudioStream && this.localAudioStream.getAudioTracks().length > 0) {
        this.localAudioStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.localAudioStream!)
        })
      } else {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' })
        } catch {
          // ignore
        }
      }

      // Initiator creates the DataChannel
      const dc = pc.createDataChannel('zk-sync', { ordered: true })
      this.setupDataChannel(dc, targetPeerId)

      this.setupPeerConnectionEvents(pc, targetPeerId)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      void this.channel?.send({
        type: 'broadcast',
        event: 'signal:offer',
        payload: {
          fromPeerId: this.peerId,
          targetPeerId,
          sdp: offer,
        },
      })
    } catch (err) {
      console.warn('[WebRTC] initiatePeerConnection error:', err)
    }
  }

  /** Remote peer receives SDP Offer, creates Answer */
  private async handleRemoteOffer(fromPeerId: string, sdp: RTCSessionDescriptionInit) {
    try {
      let pc = this.peerConnections.get(fromPeerId)
      if (!pc) {
        pc = new RTCPeerConnection(RTC_CONFIG)
        this.peerConnections.set(fromPeerId, pc)
        const targetPc = pc

        if (this.localAudioStream && this.localAudioStream.getAudioTracks().length > 0) {
          this.localAudioStream.getAudioTracks().forEach((track) => {
            targetPc.addTrack(track, this.localAudioStream!)
          })
        } else {
          try {
            targetPc.addTransceiver('audio', { direction: 'sendrecv' })
          } catch {
            // ignore
          }
        }

        this.setupPeerConnectionEvents(targetPc, fromPeerId)

        // Listen for the DataChannel opened by initiator
        targetPc.ondatachannel = (e) => {
          this.setupDataChannel(e.channel, fromPeerId)
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      void this.channel?.send({
        type: 'broadcast',
        event: 'signal:answer',
        payload: {
          fromPeerId: this.peerId,
          targetPeerId: fromPeerId,
          sdp: answer,
        },
      })
    } catch (err) {
      console.warn('[WebRTC] handleRemoteOffer error:', err)
    }
  }

  /** Initiator receives SDP Answer */
  private async handleRemoteAnswer(fromPeerId: string, sdp: RTCSessionDescriptionInit) {
    try {
      const pc = this.peerConnections.get(fromPeerId)
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      }
    } catch (err) {
      console.warn('[WebRTC] handleRemoteAnswer error:', err)
    }
  }

  /** Both peers exchange ICE candidates */
  private async handleRemoteIceCandidate(fromPeerId: string, candidate: RTCIceCandidateInit) {
    try {
      const pc = this.peerConnections.get(fromPeerId)
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (err) {
      console.warn('[WebRTC] handleRemoteIceCandidate error:', err)
    }
  }

  private setupPeerConnectionEvents(pc: RTCPeerConnection, targetPeerId: string) {
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void this.channel?.send({
          type: 'broadcast',
          event: 'signal:ice',
          payload: {
            fromPeerId: this.peerId,
            targetPeerId,
            candidate: e.candidate,
          },
        })
      }
    }

    // Handle incoming audio stream from remote peer
    pc.ontrack = (e) => {
      const stream = e.streams[0] || (e.track ? new MediaStream([e.track]) : null)
      if (!stream) return
      let audioEl = this.remoteAudioElements.get(targetPeerId)
      if (!audioEl) {
        audioEl = document.createElement('audio')
        audioEl.autoplay = true
        audioEl.setAttribute('playsinline', 'true')
        audioEl.style.display = 'none'
        document.body.appendChild(audioEl)
        this.remoteAudioElements.set(targetPeerId, audioEl)
      }
      audioEl.srcObject = stream
      audioEl.muted = this.mutedPeers.has(targetPeerId)
      audioEl.play().catch(() => {
        // Autoplay may wait for user interaction
      })
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') {
        const peer = this.peers.get(targetPeerId)
        if (peer) {
          peer.p2pConnected = true
          this.notifyPeersChanged()
        }
        this.onConnectionStatusChangeCallback?.('p2p')
      } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        const peer = this.peers.get(targetPeerId)
        if (peer) {
          peer.p2pConnected = false
          this.notifyPeersChanged()
        }
      }
    }
  }

  private setupDataChannel(dc: RTCDataChannel, peerId: string) {
    this.dataChannels.set(peerId, dc)

    dc.onopen = () => {
      const peer = this.peers.get(peerId)
      if (peer) {
        peer.p2pConnected = true
        this.notifyPeersChanged()
      }
      this.onConnectionStatusChangeCallback?.('p2p')
    }

    dc.onclose = () => {
      this.dataChannels.delete(peerId)
      const peer = this.peers.get(peerId)
      if (peer) {
        peer.p2pConnected = false
        this.notifyPeersChanged()
      }
    }

    dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        this.handleIncomingData(data)
      } catch (err) {
        console.warn('[WebRTC DataChannel] parse error:', err)
      }
    }
  }

  /** Route incoming P2P or Broadcast packets */
  private handleIncomingData(data: any) {
    if (!data || data.senderId === this.peerId) return

    // If host-only control is enforced, non-hosts must only accept sync commands originating from the host
    if (this.hostOnlyControl && !this.isHost && data.kind === 'SYNC') {
      const sender = this.peers.get(data.senderId)
      if (sender && !sender.isHost) {
        return // Reject unauthorized sync packet from non-host peer
      }
    }

    switch (data.kind) {
      case 'SYNC': {
        const payload = data.payload as SyncPayload
        if (payload.type === 'CHANGE_SHOW' && payload.animeId) {
          this.animeId = payload.animeId
          if (payload.animeTitle) this.animeTitle = payload.animeTitle
          if (payload.episode) this.episode = payload.episode
          this.onShowChangeCallback?.(payload.animeId, payload.animeTitle || '', payload.episode || 1)
        } else if (payload.type === 'CHANGE_EP' && payload.episode) {
          this.episode = payload.episode
          this.onEpisodeChangeCallback?.(payload.episode)
        } else if (payload.type === 'CHANGE_SERVER' && payload.server) {
          this.server = payload.server
          this.onServerChangeCallback?.(payload.server)
        } else if (payload.type === 'CHANGE_AUDIO' && payload.audio) {
          this.onAudioChangeCallback?.(payload.audio)
        } else {
          this.onSyncCallback?.(payload)
        }
        break
      }
      case 'CHAT': {
        this.onChatCallback?.(data.payload as WatchChatMessage)
        break
      }
      case 'REACTION': {
        this.onReactionCallback?.(data.payload as WatchReaction)
        break
      }
      case 'VOICE_STATUS': {
        const payload = data.payload as { peerId: string; micActive: boolean }
        if (payload?.peerId) {
          this.peerVoiceStates.set(payload.peerId, Boolean(payload.micActive))
          this.notifyPeersChanged()
        }
        break
      }
    }
  }

  /** Send data via direct WebRTC DataChannel; fallback to Supabase Broadcast if DC is buffering/connecting */
  private broadcastP2P(data: any) {
    const raw = JSON.stringify(data)
    let sentP2P = false

    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === 'open') {
        try {
          dc.send(raw)
          sentP2P = true
        } catch {
          // ignore
        }
      }
    }

    // Always send over Supabase Broadcast as transparent fallback if no open DataChannels
    if (!sentP2P || this.dataChannels.size < this.peers.size - 1) {
      const eventName =
        data.kind === 'CHAT'
          ? 'p2p:chat'
          : data.kind === 'REACTION'
          ? 'p2p:reaction'
          : data.kind === 'VOICE_STATUS'
          ? 'p2p:voice_status'
          : 'p2p:sync'
      void this.channel?.send({
        type: 'broadcast',
        event: eventName,
        payload: data.payload,
      })
    }
  }

  // ================= Public Action Methods =================

  /** Broadcast playback sync (Play, Pause, Seek, Heartbeat) */
  public sendSync(action: SyncActionType, currentTime: number, paused?: boolean) {
    if (this.hostOnlyControl && !this.isHost) return

    const payload: SyncPayload = {
      type: action,
      currentTime,
      paused,
      timestamp: Date.now(),
      senderId: this.peerId,
    }

    this.broadcastP2P({ kind: 'SYNC', payload })
  }

  /** Broadcast episode change */
  public sendEpisodeChange(episode: number) {
    if (this.hostOnlyControl && !this.isHost) return
    this.episode = episode

    const payload: SyncPayload = {
      type: 'CHANGE_EP',
      currentTime: 0,
      episode,
      timestamp: Date.now(),
      senderId: this.peerId,
    }

    this.broadcastP2P({ kind: 'SYNC', payload })
  }

  /** Broadcast anime show change (switches the entire party to a new anime title) */
  public sendShowChange(animeId: number, animeTitle: string, episode = 1) {
    if (this.hostOnlyControl && !this.isHost) return
    this.animeId = animeId
    this.animeTitle = animeTitle
    this.episode = episode

    const payload: SyncPayload = {
      type: 'CHANGE_SHOW',
      currentTime: 0,
      animeId,
      animeTitle,
      episode,
      timestamp: Date.now(),
      senderId: this.peerId,
    }

    this.broadcastP2P({ kind: 'SYNC', payload })
  }

  /** Broadcast server change (switches video provider / server for all peers) */
  public sendServerChange(server: string) {
    if (this.hostOnlyControl && !this.isHost) return
    this.server = server

    const payload: SyncPayload = {
      type: 'CHANGE_SERVER',
      currentTime: 0,
      server,
      timestamp: Date.now(),
      senderId: this.peerId,
    }

    this.broadcastP2P({ kind: 'SYNC', payload })
  }

  /** Broadcast audio mode change ('sub' or 'dub') for all peers */
  public sendAudioChange(audio: 'sub' | 'dub') {
    if (this.hostOnlyControl && !this.isHost) return

    const payload: SyncPayload = {
      type: 'CHANGE_AUDIO',
      currentTime: 0,
      audio,
      timestamp: Date.now(),
      senderId: this.peerId,
    }

    this.broadcastP2P({ kind: 'SYNC', payload })
  }

  /** Broadcast room chat message */
  public sendChat(text: string, user: { displayName: string; avatar: string | null }): WatchChatMessage {
    const msg: WatchChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: this.peerId,
      senderName: user.displayName,
      avatar: user.avatar,
      text: text.trim(),
      timestamp: Date.now(),
    }

    this.broadcastP2P({ kind: 'CHAT', payload: msg })
    return msg
  }

  /** Broadcast live floating emoji reaction */
  public sendReaction(emoji: string, senderName: string): WatchReaction {
    const r: WatchReaction = {
      id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      emoji,
      senderName,
    }

    this.broadcastP2P({ kind: 'REACTION', payload: r })
    return r
  }

  /** Toggle Host-Only control setting */
  public setHostOnlyControl(val: boolean) {
    if (!this.isHost) return
    this.hostOnlyControl = val
  }

  // ================= WebRTC Voice Chat Controls =================

  /** Toggle microphone on/off and stream audio to all peers */
  public async toggleMic(preacquiredStream?: MediaStream): Promise<boolean> {
    if (this.isDestroyed) return false

    if (this.isMicActive) {
      this.isMicActive = false
      if (this.localAudioStream) {
        this.localAudioStream.getAudioTracks().forEach((track) => {
          track.enabled = false
        })
      }
    } else {
      try {
        if (preacquiredStream && preacquiredStream.active) {
          this.localAudioStream = preacquiredStream
        } else if (!this.localAudioStream || this.localAudioStream.getAudioTracks().length === 0 || !this.localAudioStream.active) {
          this.localAudioStream = await requestMicrophoneStream()
        }

        const audioTrack = this.localAudioStream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = true

          for (const pc of this.peerConnections.values()) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track)
            if (sender) {
              void sender.replaceTrack(audioTrack)
            } else {
              pc.addTrack(audioTrack, this.localAudioStream)
            }
          }
        }
        this.isMicActive = true
      } catch (err) {
        console.error('[WebRTC] toggleMic getUserMedia error:', err)
        this.isMicActive = false
        this.onLocalMicChangeCallback?.(false)
        throw err
      }
    }

    this.onLocalMicChangeCallback?.(this.isMicActive)
    this.peerVoiceStates.set(this.peerId, this.isMicActive)
    this.broadcastP2P({
      kind: 'VOICE_STATUS',
      payload: {
        peerId: this.peerId,
        micActive: this.isMicActive,
      },
    })
    this.notifyPeersChanged()
    return this.isMicActive
  }

  /** Locally mute or unmute a specific peer's incoming audio on this device */
  public toggleMutePeer(targetPeerId: string): boolean {
    if (this.mutedPeers.has(targetPeerId)) {
      this.mutedPeers.delete(targetPeerId)
    } else {
      this.mutedPeers.add(targetPeerId)
    }

    const isMuted = this.mutedPeers.has(targetPeerId)
    const audioEl = this.remoteAudioElements.get(targetPeerId)
    if (audioEl) {
      audioEl.muted = isMuted
    }
    this.notifyPeersChanged()
    return isMuted
  }

  public isPeerLocallyMuted(targetPeerId: string): boolean {
    return this.mutedPeers.has(targetPeerId)
  }

  public getIsMicActive(): boolean {
    return this.isMicActive
  }

  public getPeers(): PeerMember[] {
    return Array.from(this.peers.values()).map((p) => ({
      ...p,
      isMicActive: p.peerId === this.peerId ? this.isMicActive : Boolean(this.peerVoiceStates.get(p.peerId)),
      isLocallyMuted: this.mutedPeers.has(p.peerId),
    }))
  }

  public onSync(cb: (payload: SyncPayload) => void) {
    this.onSyncCallback = cb
  }

  public onPeersChange(cb: (peers: PeerMember[]) => void) {
    this.onPeersChangeCallback = cb
  }

  public onChat(cb: (msg: WatchChatMessage) => void) {
    this.onChatCallback = cb
  }

  public onReaction(cb: (reaction: WatchReaction) => void) {
    this.onReactionCallback = cb
  }

  public onEpisodeChange(cb: (episode: number) => void) {
    this.onEpisodeChangeCallback = cb
  }

  public onShowChange(cb: (animeId: number, animeTitle: string, episode: number) => void) {
    this.onShowChangeCallback = cb
  }

  public onServerChange(cb: (server: string) => void) {
    this.onServerChangeCallback = cb
  }

  public onAudioChange(cb: (audio: 'sub' | 'dub') => void) {
    this.onAudioChangeCallback = cb
  }

  public onLocalMicChange(cb: (active: boolean) => void) {
    this.onLocalMicChangeCallback = cb
  }

  public onConnectionStatusChange(cb: (status: 'connecting' | 'connected' | 'p2p' | 'disconnected') => void) {
    this.onConnectionStatusChangeCallback = cb
  }

  private notifyPeersChanged() {
    this.onPeersChangeCallback?.(this.getPeers())
  }

  /** Close WebRTC connections and unsubscribe from room */
  public destroy() {
    this.isDestroyed = true

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((t) => t.stop())
      this.localAudioStream = null
    }

    for (const audioEl of this.remoteAudioElements.values()) {
      audioEl.pause()
      audioEl.srcObject = null
      audioEl.remove()
    }
    this.remoteAudioElements.clear()
    this.mutedPeers.clear()
    this.peerVoiceStates.clear()

    for (const pc of this.peerConnections.values()) {
      pc.close()
    }
    this.peerConnections.clear()
    this.dataChannels.clear()
    this.peers.clear()

    if (this.channel) {
      void this.channel.untrack()
      void supabase.removeChannel(this.channel)
      this.channel = null
    }

    this.onConnectionStatusChangeCallback?.('disconnected')
  }
}

/** Generate a clean 6-character room code */
export function generateWatchRoomId(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'
  let res = 'zk-'
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return res
}
