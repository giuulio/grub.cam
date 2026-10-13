import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const positions = new Map<string, number>()

/** New pages start at the top, or at the part a link's #hash names; going back (or forward) returns to where that page was scrolled. Filter changes (replace) don't move. */
export function useScrollMemory() {
  const { key, hash } = useLocation()
  const type = useNavigationType()
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    // A page first opened (from outside, too) or new: at its #hash's part (once the header has measured itself, which
    // the part's scroll margin clears), else the top
    const start = () => {
      const part = hash && document.getElementById(decodeURIComponent(hash.slice(1)))
      if (part) requestAnimationFrame(() => part.scrollIntoView())
      else window.scrollTo(0, 0)
    }
    if (type === 'POP') {
      const saved = positions.get(key)
      if (saved != null) window.scrollTo(0, saved)
      else start()
    } else if (type === 'PUSH') start()
    const save = () => positions.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key, type, hash])
}
