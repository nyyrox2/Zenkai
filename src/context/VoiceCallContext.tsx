import React, { createContext, useContext, useState, useEffect } from 'react'
import { DirectVoiceCall, sendIncomingCallAlert, type CallUserInfo } from '../lib/webrtcVoiceCall'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useProfile } from '../lib/profile'
import { VoiceCallOverlay } from '../components/VoiceCallOverlay'
import { sendDirectMessage } from '../lib/messages'
import { toast } from '../lib/toast'

interface VoiceCallContextType {
  activeCall: DirectVoiceCall | null
  startCall: (partner: CallUserInfo, preacquiredStream?: MediaStream) => Promise<void>
  endCall: () => void
  returnPath: string | null
  setReturnPath: (path: string | null) => void
}

const VoiceCallContext = createContext<VoiceCallContextType | null>(null)

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const me = useProfile()
  const username = user?.user_metadata?.username || me.name || user?.email?.split('@')[0] || 'User'
  const [activeCall, setActiveCall] = useState<DirectVoiceCall | null>(null)
  const [returnPath, setReturnPath] = useState<string | null>(null)

  // Restore active call on page refresh / reload
  useEffect(() => {
    if (!user?.id) return
    const saved = sessionStorage.getItem('zk:voice_call')
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (!parsed?.callId || !parsed?.partner) return
      void (async () => {
        const { data } = await supabase
          .from('call_sessions')
          .select('status')
          .eq('call_id', parsed.callId)
          .maybeSingle()

        if (!data || data.status === 'ended' || data.status === 'declined') {
          sessionStorage.removeItem('zk:voice_call')
          return
        }

        const myUser: CallUserInfo = {
          id: user.id,
          username,
          displayName: me.name || user.user_metadata?.full_name || 'Otaku',
          avatar: me.avatar,
        }

        const restored = new DirectVoiceCall({
          callId: parsed.callId,
          myUser,
          partner: parsed.partner,
          isCaller: parsed.isCaller,
        })
        if (parsed.connectedAt) {
          restored.connectedAt = parsed.connectedAt
        }
        await restored.initSignaling()
        setActiveCall(restored)
        await restored.reconnect()
      })()
    } catch {
      sessionStorage.removeItem('zk:voice_call')
    }
  }, [user?.id, username, me])

  // Save active call to sessionStorage
  useEffect(() => {
    if (activeCall && activeCall.status !== 'ended') {
      try {
        sessionStorage.setItem('zk:voice_call', JSON.stringify({
          callId: activeCall.callId,
          isCaller: activeCall.isCaller,
          partner: activeCall.partner,
          connectedAt: activeCall.connectedAt,
        }))
      } catch {}
    } else {
      try {
        sessionStorage.removeItem('zk:voice_call')
      } catch {}
    }
  }, [activeCall, activeCall?.status])

  // Listen for global incoming call invitations targeted at current logged in user
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel(`call_invite_user_${user.id}`)

    channel
      .on('broadcast', { event: 'incoming_call_invite' }, async ({ payload }) => {
        if (!payload || !payload.caller) return

        // If already in call with the same partner who reloaded/re-called, switch cleanly
        if (activeCall && activeCall.status !== 'ended') {
          if (activeCall.partner.id === payload.caller.id) {
            activeCall.endCall(false, 'ended')
          } else {
            return
          }
        }

        const myUser: CallUserInfo = {
          id: user.id,
          username: username,
          displayName: me.name || user.user_metadata?.full_name || 'Otaku',
          avatar: me.avatar,
        }

        const incoming = new DirectVoiceCall({
          callId: payload.callId,
          myUser,
          partner: payload.caller,
          isCaller: false,
        })

        // Save current location as return path when receiving call
        setReturnPath(window.location.pathname + window.location.search)

        incoming.addCallEndedListener(async (summary) => {
          if (summary.status === 'missed') {
            const name = payload.caller.displayName || payload.caller.username
            toast(`Missed call from ${name}`, 'info')
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('Missed call', { body: `${name} tried to call you`, icon: '/favicon.ico' })
            }
          }
        })

        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Incoming call', {
            body: `${payload.caller.displayName || payload.caller.username} is calling…`,
            icon: '/favicon.ico',
            tag: payload.callId,
          })
        }

        await incoming.initSignaling()
        setActiveCall(incoming)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, username, me, activeCall])

  const startCall = async (partner: CallUserInfo, preacquiredStream?: MediaStream) => {
    if (!user?.id) {
      toast('Please sign in to make voice calls', 'error')
      return
    }

    if (activeCall && activeCall.status !== 'ended') {
      if (activeCall.partner.id === partner.id) {
        activeCall.endCall(false, 'ended')
      } else {
        toast('Already in a call', 'info')
        return
      }
    }

    const currentLoc = window.location.pathname + window.location.search
    setReturnPath(currentLoc)
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()

    const myUser: CallUserInfo = {
      id: user.id,
      username: username,
      displayName: me.name || user.user_metadata?.full_name || 'Otaku',
      avatar: me.avatar,
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const outgoing = new DirectVoiceCall({
      callId,
      myUser,
      partner,
      isCaller: true,
    })

    let startedMsgId: string | null = null

    // Caller logs the final resolution (ended duration, missed, or declined)
    outgoing.addCallEndedListener(async (summary) => {
      if (outgoing.isCaller) {
        try {
          const duration = outgoing.getDuration() || summary.duration || 0
          const content =
            summary.status === 'ended' || duration > 0
              ? `[CALL:ended:${duration}]`
              : summary.status === 'declined'
              ? `[CALL:declined]`
              : `[CALL:missed]`

          if (startedMsgId) {
            const { error } = await supabase
              .from('direct_messages')
              .update({ content })
              .eq('id', startedMsgId)
            if (!error) return
          }
          await sendDirectMessage(user.id, partner.id, content)
        } catch (err) {
          console.warn('[VoiceCall] Failed to log call direct message:', err)
        }
      }
    })

    if (preacquiredStream) {
      void outgoing.acquireMicrophone(preacquiredStream)
    }

    await outgoing.initSignaling()
    setActiveCall(outgoing)

    // Pre-generate WebRTC offer so it is immediately waiting in the backend for callee
    void outgoing.startPeerConnectionAsCaller()

    window.setTimeout(() => {
      if (outgoing.status === 'calling') outgoing.endCall(true, 'missed')
    }, 45_000)

    if (!preacquiredStream) {
      void outgoing.acquireMicrophone().catch((err) => {
        console.warn('[VoiceCall] Caller mic permission deferred:', err)
      })
    }

    // Send call started message to Supabase direct messages
    try {
      const dm = await sendDirectMessage(user.id, partner.id, `[CALL:started:${Date.now()}]`)
      if (dm?.id) startedMsgId = dm.id
    } catch (err) {
      console.warn('[VoiceCall] Failed to send call started message:', err)
    }

    // Broadcast incoming call invite to partner's listener channel
    await sendIncomingCallAlert(partner.id, {
      callId,
      caller: myUser,
    })
  }

  const endCall = () => {
    try {
      sessionStorage.removeItem('zk:voice_call')
    } catch {}
    if (activeCall) {
      activeCall.endCall()
      setActiveCall(null)
    }
  }

  return (
    <VoiceCallContext.Provider value={{ activeCall, startCall, endCall, returnPath, setReturnPath }}>
      {children}
      <VoiceCallOverlay call={activeCall} onEndCall={() => setActiveCall(null)} />
    </VoiceCallContext.Provider>
  )
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallContext)
  if (!ctx) throw new Error('useVoiceCall must be used within a VoiceCallProvider')
  return ctx
}
