import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

/** <img> that shows a skeleton until fully loaded, then fades in. The parent must be positioned (relative/absolute). */
export function Img({ className, style, onLoad, onError, ...p }: ImgHTMLAttributes<HTMLImageElement>) {
  const [done, setDone] = useState(false)
  const el = useRef<HTMLImageElement>(null)
  useEffect(() => setDone(!!el.current?.complete && !!el.current.naturalWidth), [p.src])
  return (
    <>
      {!done && <span aria-hidden className="skeleton absolute inset-0 rounded-[inherit]" />}
      <img
        ref={el}
        {...p}
        className={done ? `${className ?? ''} img-in` : className}
        style={done ? style : { ...style, opacity: 0 }}
        onLoad={(e) => (setDone(true), onLoad?.(e))}
        onError={(e) => (setDone(true), onError?.(e))}
      />
    </>
  )
}
