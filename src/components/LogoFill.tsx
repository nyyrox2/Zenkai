/** Dim logo that fills to full colour, left to right (see .zk-logofill in index.css). */
export function LogoFill({ src }: { src: string }) {
  return (
    <div className="zk-logofill" role="status" aria-label="Loading">
      <img src={src} alt="" />
      <img src={src} alt="" aria-hidden className="zk-lit" />
    </div>
  )
}
