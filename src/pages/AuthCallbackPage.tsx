import { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, Copy, ExternalLink, ShieldCheck, Smartphone, Monitor, AlertCircle } from 'lucide-react'
import { GoogleIcon } from '../components/BrandIcons'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const { search, hash } = useLocation()
  const navigate = useNavigate()

  const [copied, setCopied] = useState(false)
  const [redirectAttempted, setRedirectAttempted] = useState(false)
  const [exchangeError, setExchangeError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(true)

  // Parse parameters from hash and search
  const authParams = useMemo(() => {
    const params = new URLSearchParams()
    
    // Hash params (Supabase Implicit grant: #access_token=...&refresh_token=...)
    if (hash && hash.startsWith('#')) {
      const cleanHash = hash.slice(1)
      const hashSearchParams = new URLSearchParams(cleanHash)
      hashSearchParams.forEach((val, key) => params.set(key, val))
    }

    // Search params (PKCE / error: ?code=... or ?error=...)
    if (search && search.startsWith('?')) {
      const searchParams = new URLSearchParams(search.slice(1))
      searchParams.forEach((val, key) => {
        if (!params.has(key)) params.set(key, val)
      })
    }

    return params
  }, [hash, search])

  const accessToken = authParams.get('access_token')
  const refreshToken = authParams.get('refresh_token')
  const code = authParams.get('code')
  const errorDescription = authParams.get('error_description') || authParams.get('error')

  // Construct target deep link payload
  const payloadString = useMemo(() => {
    if (hash && hash.length > 1) return hash.slice(1)
    if (search && search.length > 1) return search.slice(1)
    return ''
  }, [hash, search])

  const customSchemeUrl = `zenkai://auth/callback#${payloadString}`
  const androidIntentUrl = `intent://auth/callback#${payloadString}#Intent;scheme=zenkai;package=com.nyyrox.zenkai;end;`

  useEffect(() => {
    const handleAuth = async () => {
      // 1. If we have code but no tokens, try exchanging it on the web client too so session is also valid on web
      if (code && !accessToken) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setExchangeError(error.message)
          } else if (data.session) {
            // Updated session with tokens!
            const newPayload = `access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}&token_type=bearer&expires_in=${data.session.expires_in}`
            triggerAppRedirect(newPayload)
            setProcessing(false)
            return
          }
        } catch (e: any) {
          setExchangeError(e?.message || 'Code exchange failed')
        }
      }

      // 2. If we already have access token or raw payload, trigger app deep-link
      if (payloadString && (accessToken || refreshToken || code)) {
        triggerAppRedirect(payloadString)
      }

      setProcessing(false)
    }

    const triggerAppRedirect = (payload: string) => {
      setRedirectAttempted(true)
      const customUrl = `zenkai://auth/callback#${payload}`
      const intentUrl = `intent://auth/callback#${payload}#Intent;scheme=zenkai;package=com.nyyrox.zenkai;end;`

      // Try Android Intent first on Android user agent, else custom scheme
      const isAndroid = /android/i.test(navigator.userAgent)
      if (isAndroid) {
        window.location.href = intentUrl
      } else {
        window.location.href = customUrl
      }
    }

    void handleAuth()
  }, [code, accessToken, refreshToken, payloadString])

  const copyToClipboard = () => {
    const copyData = accessToken
      ? JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })
      : payloadString

    navigator.clipboard.writeText(copyData).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleWebLogin = async () => {
    setProcessing(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setExchangeError(error.message)
      setProcessing(false)
    }
  }

  const hasTokens = Boolean(accessToken || code || payloadString)

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0e111a]/95 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative z-10">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-400 flex items-center justify-center shadow-lg shadow-red-500/20 mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Zenkai Authentication</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {hasTokens
              ? 'Login successful! Redirecting you back to Zenkai…'
              : 'Sign in to sync your Zenkai account across all your devices.'}
          </p>
        </div>

        {/* Error message if any */}
        {(errorDescription || exchangeError) && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            <div className="leading-snug">{errorDescription || exchangeError}</div>
          </div>
        )}

        {/* Case 1: Tokens received -> App Return Buttons */}
        {hasTokens ? (
          <div className="space-y-3.5">
            {redirectAttempted && (
              <div className="text-xs text-neutral-400 text-center bg-white/5 py-2 px-3 rounded-lg border border-white/5">
                We tried opening Zenkai automatically. If it didn't open, tap below:
              </div>
            )}

            {/* Android / APK Open */}
            <a
              href={androidIntentUrl}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
            >
              <Smartphone className="w-5 h-5" />
              <span>Open in Zenkai APK (Android)</span>
            </a>

            {/* Windows / Desktop / Generic Deep link */}
            <a
              href={customSchemeUrl}
              className="w-full flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/15 text-white font-medium py-3 px-4 rounded-xl border border-white/10 transition-all active:scale-[0.98]"
            >
              <Monitor className="w-5 h-5 text-neutral-300" />
              <span>Open in Zenkai Windows App</span>
            </a>

            {/* Manual Token Copy Fallback */}
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 font-medium py-2.5 px-4 rounded-xl border border-neutral-700/50 text-xs transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Login token copied to clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-400" />
                  <span>Copy Session Token (Manual Fallback)</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                onClick={() => navigate('/profile', { replace: true })}
                className="text-xs text-neutral-400 hover:text-white inline-flex items-center gap-1 transition-colors"
              >
                <span>Or continue browsing on Zenkai Web</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          /* Case 2: No tokens present -> Sign in with Google */
          <div className="space-y-4">
            <button
              onClick={handleWebLogin}
              disabled={processing}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-neutral-900 font-semibold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <GoogleIcon className="w-5 h-5 flex-shrink-0" />
              <span>{processing ? 'Connecting…' : 'Sign in with Google'}</span>
            </button>

            <p className="text-xs text-neutral-400 text-center leading-relaxed">
              Once authenticated, your login token will automatically link to your Zenkai APK and Windows Desktop app.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-xs text-neutral-600 tracking-wide uppercase font-mono">
        Zenkai · Streaming & Anime Experience
      </div>
    </div>
  )
}
