import type { ReactNode } from 'react'

/**
 * "Server not available" state for the watch page.
 * Plugo naps while his unplugged cable sways near the socket and a tiny spark flickers.
 * Not interactive. Pure SVG + CSS keyframes, respects prefers-reduced-motion.
 */

const CSS = `
.sp-float{transform-box:fill-box;transform-origin:50% 100%;animation:sp-float 3.2s ease-in-out infinite}
.sp-sway{transform-box:fill-box;transform-origin:0 50%;animation:sp-sway 2.4s ease-in-out infinite}
.sp-blink{transform-box:fill-box;transform-origin:50% 50%;animation:sp-blink 4.8s infinite}
.sp-spark{transform-box:fill-box;transform-origin:50% 50%;animation:sp-spark 1.3s ease-in-out infinite}
.sp-z{transform-box:fill-box;transform-origin:50% 50%;opacity:0;animation:sp-z 3s ease-out infinite}
@keyframes sp-float{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-3px) scale(1.02,.98)}}
@keyframes sp-sway{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes sp-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes sp-spark{0%,100%{opacity:.1;transform:scale(.5)}50%{opacity:1;transform:scale(1.15)}}
@keyframes sp-z{0%{opacity:0;transform:translate(0,6px) scale(.6)}30%{opacity:.85}100%{opacity:0;transform:translate(9px,-18px) scale(1.1)}}
@media (prefers-reduced-motion:reduce){.sp-root svg *{animation:none!important}.sp-root .sp-z{opacity:.6}}
`

const STAR = 'M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8Z'

export function StreamProblem({ reason, children }: { reason?: string; onReconnect?: () => void; children?: ReactNode }) {
  return (
    <div data-reason={reason} className="sp-root absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black px-3">
      <style>{CSS}</style>

      <svg viewBox="0 0 220 120" className="h-20 w-auto min-h-0 shrink sm:h-36" role="img" aria-label="A sleepy plug mascot, unplugged from the wall">
        {/* wall socket */}
        <rect x="176" y="40" width="34" height="46" rx="12" fill="#0d0d0f" stroke="#2a2a2e" strokeWidth="1.5" />
        <rect x="181" y="55" width="10" height="4" rx="2" fill="#000" />
        <rect x="181" y="65" width="10" height="4" rx="2" fill="#000" />

        {/* spark in the gap */}
        <path d={STAR} transform="translate(166 62)" fill="currentColor" className="sp-spark text-accent" />

        {/* shadow */}
        <ellipse cx="82" cy="106" rx="34" ry="4" fill="#fff" opacity=".06" />

        {/* swaying cable + plug */}
        <g className="sp-sway" style={{ transformOrigin: '112px 84px' }}>
          <path d="M112 84 C132 98 142 70 158 62" fill="none" stroke="#3a3a40" strokeWidth="6" strokeLinecap="round" />
          <path d="M112 84 C132 98 142 70 158 62" fill="none" stroke="#74747c" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
          <g transform="translate(158 62)">
            <rect x="0" y="-5" width="9" height="3" rx="1.5" fill="#a1a1aa" />
            <rect x="0" y="2" width="9" height="3" rx="1.5" fill="#a1a1aa" />
            <rect x="-14" y="-8" width="16" height="16" rx="4.5" fill="#e4e4e7" />
          </g>
        </g>

        {/* Plugo */}
        <g transform="translate(82 104)">
          <g className="sp-float">
            <ellipse cx="-17" cy="1" rx="12" ry="4.5" fill="#a1a1aa" />
            <ellipse cx="17" cy="1" rx="12" ry="4.5" fill="#a1a1aa" />
            <rect x="-43" y="-46" width="7" height="16" rx="3.5" fill="#d4d4d8" />
            <rect x="36" y="-46" width="7" height="16" rx="3.5" fill="#d4d4d8" />
            <rect x="-1.5" y="-78" width="3" height="12" rx="1.5" fill="#a1a1aa" />
            <circle cx="0" cy="-81" r="4" fill="currentColor" className="text-accent" opacity=".35" />
            <rect x="-36" y="-66" width="72" height="66" rx="27" fill="#f4f4f5" />
            <path d="M-27 -55 Q-31 -42 -30 -33" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7" />
            <rect x="-28" y="-57" width="56" height="35" rx="15" fill="#0b0b0d" />
            <ellipse cx="-21" cy="-29" rx="4.5" ry="2.8" fill="currentColor" className="text-accent" opacity=".55" />
            <ellipse cx="21" cy="-29" rx="4.5" ry="2.8" fill="currentColor" className="text-accent" opacity=".55" />
            <g className="sp-blink" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" fill="none" opacity=".9">
              <path d="M-19 -41 q6 6 12 0" />
              <path d="M7 -41 q6 6 12 0" />
            </g>
            <circle cx="0" cy="-29" r="2" fill="#fff" opacity=".7" />
            <rect x="-6" y="-13" width="12" height="3" rx="1.5" fill="#6b6b73" />
          </g>
        </g>

        {/* zzz */}
        <g fill="#fff" fontWeight="800" aria-hidden>
          <text x="120" y="34" fontSize="12" className="sp-z">z</text>
          <text x="128" y="24" fontSize="9" className="sp-z" style={{ animationDelay: '1s' }}>z</text>
          <text x="134" y="16" fontSize="7" className="sp-z" style={{ animationDelay: '2s' }}>z</text>
        </g>
      </svg>

      <div className="text-center">
        <h3 className="font-display text-sm font-bold tracking-tight text-white">Server not available</h3>
        <p className="text-[11px] text-white/55">Try another one</p>
        {children && <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 sm:mt-3">{children}</div>}
      </div>
    </div>
  )
}

export default StreamProblem
