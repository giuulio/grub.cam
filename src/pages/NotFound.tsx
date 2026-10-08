import { Link } from 'react-router'
import { ArrowLeft } from 'reicon-react'
import { Icon } from '../components/Icon.tsx'
import { SITE_NAME } from '../lib/site.ts'

export function NotFound() {
  return (
    <>
      <title>{`Not found · ${SITE_NAME}`}</title>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Page not found</h1>
      <Link to="/" className="inline-flex items-center gap-2 text-muted hover:text-ink">
        <Icon of={ArrowLeft} />
        Search
      </Link>
    </>
  )
}
