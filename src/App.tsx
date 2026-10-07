import { Link, NavLink, Route, Routes } from 'react-router'
import { DataProvider } from './lib/data/useData.tsx'
import { About } from './pages/About.tsx'
import { CollegePage } from './pages/College.tsx'
import { Home } from './pages/Home.tsx'

export default function App() {
  return (
    <DataProvider>
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-3 sm:px-6">
        <header className="flex items-center justify-between py-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-grub-600">Grub</span>
            <span className="hidden text-sm text-stone-500 sm:inline">Cambridge college menus, live</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'font-semibold' : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100')}>
              Now
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => (isActive ? 'font-semibold' : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100')}>
              About
            </NavLink>
          </nav>
        </header>
        <main className="flex-1 pb-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/college/:slug" element={<CollegePage />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<p className="py-10 text-center text-stone-500">Not found.</p>} />
          </Routes>
        </main>
        <footer className="border-t border-stone-200 py-6 text-xs text-stone-500 dark:border-stone-800">
          Menus and hours are re-published from each College's own pages with links to the source. Always check with the College before relying on them.
        </footer>
      </div>
    </DataProvider>
  )
}
