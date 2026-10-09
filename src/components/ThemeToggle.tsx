import { useEffect, useState } from 'react'
import { Moon, Sun } from 'reicon-react'
import { Icon } from './Icon.tsx'

type Theme = 'light' | 'dark'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light'
    const saved = document.documentElement.dataset.theme
    return saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const followSystem = () => {
      if (!document.documentElement.dataset.theme) setTheme(media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', followSystem)
    return () => media.removeEventListener('change', followSystem)
  }, [])

  function change(next: Theme) {
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('grub-theme', next)
    } catch { /* The theme still works when storage is unavailable. */ }
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.content = next === 'dark' ? '#0d1c21' : '#ffffff'
    })
  }

  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={() => change(theme === 'dark' ? 'light' : 'dark')}
      className="icon-btn"
    >
      <Icon of={theme === 'dark' ? Sun : Moon} className="size-5" />
    </button>
  )
}
