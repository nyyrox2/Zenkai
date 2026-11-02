import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { useProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'
import {
  DirectVoiceCall,
  sendIncomingCallAlert,
  type CallUserInfo,
} from '../lib/webrtcVoiceCall'
import { sendDirectMessage } from '../lib/messages'
import { VoiceCallOverlay } from '../components/VoiceCallOverlay'
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
  const { user, username } = useAuth()
  const me = useProfile()
  const [activeCall, setActiveCall] = useState<DirectVoiceCall | null>(null)
  const [returnPath, setReturnPath] = useState<string | null>(null)

  // Listen for incoming call invites via Realtime broadcast
  useEffect(() => {
    if (!user?.id) return

    const myChannelName = `call_invite_user_${user.id}`
    const channel = supabase.channel(myChannelName)

    channel
      .on('broadcast', { event: 'incoming_call_invite' }, async ({ payload }) => {
        if (!payload || !payload.callId || !payload.caller) return

        // If already in a call, ignore
        if (activeCall && activeCall.status !== 'ended') {
          return
        }

        const myUser: CallUserInfo = {
          id: user.id,
          username: username || user.email?.split('@')[0] || 'User',
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

        incoming.setCallbacks({
          onCallEnded: async (summary) => {
            if (summary.status === 'declined') {
              try {
                await sendDirectMessage(user.id, payload.caller.id, '[CALL:declined]')
              } catch {
                // ignore
              }
            } else if (summary.status === 'missed') {
              const name = payload.caller.displayName || payload.caller.username
              toast(`Missed call from ${name}`, 'info')
              if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('Missed call', { body: `${name} tried to call you`, icon: '/favicon.ico' })
              }
            }
          },
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
      toast('Already in a call', 'info')
      return
    }

    const currentLoc = window.location.pathname + window.location.search
    setReturnPath(currentLoc)
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()

    const myUser: CallUserInfo = {
      id: user.id,
      username: username || user.email?.split('@')[0] || 'User',
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

    outgoing.setCallbacks({
      onCallEnded: async (summary) => {
        // The callee logs their own decline; the caller logs only ended / missed.
        if (outgoing.isCaller && summary.status !== 'declined') {
          try {
            const content =
              summary.status === 'ended' ? `[CALL:ended:${summary.duration}]` : `[CALL:missed]`
            await sendDirectMessage(user.id, partner.id, content)
          } catch (err) {
            console.warn('[VoiceCall] Failed to log call direct message:', err)
          }
        }
      },
    })

    if (preacquiredStream) {
      void outgoing.acquireMicrophone(preacquiredStream)
    }

    await outgoing.initSignaling()
    setActiveCall(outgoing)
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
      await sendDirectMessage(user.id, partner.id, `[CALL:started:${Date.now()}]`)
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
