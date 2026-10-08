import { useLocation, useNavigate } from 'react-router'
import { ArrowLeft } from 'reicon-react'
import { Icon } from './Icon.tsx'

/** Back to wherever you came from on the site (a search keeps its filters and scroll); opened directly, up to `up`. */
export function BackButton({ up }: { up: string }) {
  const navigate = useNavigate()
  // The first page of a visit has the "default" key: nothing on the site to go back to.
  const cameFromSite = useLocation().key !== 'default'
  return (
    <button
      type="button"
      aria-label="Back"
      title="Back"
      onClick={() => (cameFromSite ? navigate(-1) : navigate(up))}
      className="-ml-2 mb-4 flex size-9 cursor-pointer items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon of={ArrowLeft} className="size-5" />
    </button>
  )
}
