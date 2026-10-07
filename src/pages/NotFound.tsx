import { Link } from 'react-router'
import { SITE_NAME } from '../lib/site.ts'

export function NotFound() {
  return (
    <>
      <title>{`Not found · ${SITE_NAME}`}</title>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Page not found</h1>
      <Link to="/" className="text-white/60 hover:text-white">
        ← Search
      </Link>
    </>
  )
}
