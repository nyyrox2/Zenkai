import { useState } from 'react'
import { LOGO_URL } from '../lib/constants'

/** Dim logo that fills to full colour, left to right (see .zk-logofill in index.css). */
export function LogoFill({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false)
  const effectiveSrc = (!failed && src) ? src : LOGO_URL

  return (
    <div className="zk-logofill" role="status" aria-label="Loading">
      <img src={effectiveSrc} alt="Loading" onError={() => setFailed(true)} />
      <img src={effectiveSrc} alt="" aria-hidden className="zk-lit" onError={() => setFailed(true)} />
    </div>
  )
}
