import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Footer } from './components/Footer.tsx'
import { Header } from './components/Header.tsx'
import { Container } from './components/Container.tsx'
import { DataProvider, useData, type State } from './lib/data.tsx'
import { SCOPES } from './lib/finder.ts'
import { useScrollMemory } from './lib/useScrollMemory.ts'
import { About } from './pages/About.tsx'
import { CoveragePage } from './pages/Coverage.tsx'
import { FromExplore, Home } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { SitePage } from './pages/Site.tsx'
import { VenuePage } from './pages/Venue.tsx'
import { Terms } from './pages/Terms.tsx'
import { Credits } from './pages/Credits.tsx'
import { Send } from './pages/Send.tsx'

function Layout() {
  const data = useData()
  const { pathname } = useLocation()
  useScrollMemory()
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className={`flex-1 ${SCOPES.some((s) => s.path === pathname) ? 'pt-8 sm:pt-14' : 'pt-10 sm:pt-12'}`}>
        <Container>{data.status === 'ready' ? <Outlet /> : data.status === 'error' ? <p className="text-muted">{data.error}</p> : null}</Container>
      </main>
      <Footer />
    </div>
  )
}

export default function App({ data }: { data: State }) {
  return (
    <DataProvider value={data}>
      <Routes>
        <Route element={<Layout />}>
          {/* The front page's tabs, each its own address */}
          {SCOPES.map((s) => (s.path === '/' ? <Route key={s.scope} index element={<Home scope={s.scope} />} /> : <Route key={s.scope} path={s.path.slice(1)} element={<Home scope={s.scope} />} />))}
          <Route path="about" element={<About />} />
          <Route path="coverage" element={<CoveragePage />} />
          <Route path="terms" element={<Terms />} />
          <Route path="credits" element={<Credits />} />
          <Route path="send" element={<Send />} />
          {/* Pages the front page replaced (public/_redirects does the same for links from outside) */}
          <Route path="explore" element={<FromExplore />} />
          {['directory', 'colleges', 'university'].map((p) => <Route key={p} path={p} element={<Navigate to="/" replace />} />)}
          <Route path=":slug" element={<SitePage />} />
          <Route path=":site/:venue" element={<VenuePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
