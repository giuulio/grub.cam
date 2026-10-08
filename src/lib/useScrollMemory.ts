import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const positions = new Map<string, number>()

/** New pages start at the top; going back (or forward) returns to where that page was scrolled. Filter changes (replace) don't move. */
export function useScrollMemory() {
  const { key } = useLocation()
  const type = useNavigationType()
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    if (type === 'POP') window.scrollTo(0, positions.get(key) ?? 0)
    else if (type === 'PUSH') window.scrollTo(0, 0)
    const save = () => positions.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key, type])
}
