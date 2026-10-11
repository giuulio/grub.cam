import type { ReactNode } from 'react'

/** The page's edges, the same on every page: header, main and footer share them. The whole window, as Airbnb's, up to 1920px. */
export function Container({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-[120rem] px-4 sm:px-6 lg:px-12 ${className}`}>{children}</div>
}
