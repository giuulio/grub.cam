import type { ReactNode } from 'react'

/** The page's edges: header, main and footer share them. `wide`: the whole window, as on the front page's tabs (Airbnb's edges). */
export function Container({ className = '', wide = false, children }: { className?: string; wide?: boolean; children: ReactNode }) {
  return <div className={`mx-auto w-full px-4 sm:px-6 ${wide ? 'lg:px-12' : 'max-w-7xl'} ${className}`}>{children}</div>
}
