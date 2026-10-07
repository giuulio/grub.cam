import { useEffect, useState } from 'react'
import { toLocalNow, type LocalNow } from './time/clock.ts'

/** Europe/London "now", refreshed every 30 s. */
export function useNow(): LocalNow {
  const [now, setNow] = useState(() => toLocalNow())
  useEffect(() => {
    const id = setInterval(() => setNow(toLocalNow()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}
