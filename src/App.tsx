import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Footer } from './components/Footer.tsx'
import { Header } from './components/Header.tsx'
import { Container } from './components/Container.tsx'
import { DataProvider, useData, type State } from './lib/data.tsx'
import { useScrollMemory } from './lib/useScrollMemory.ts'
import { About } from './pages/About.tsx'
import { CoveragePage } from './pages/Coverage.tsx'
import { Home } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { SitePage } from './pages/Site.tsx'
import { VenuePage } from './pages/Venue.tsx'
import { Directory } from './pages/Directory.tsx'
import { Terms } from './pages/Terms.tsx'

function Layout() {
  const data = useData()
  const explore = useLocation().pathname === '/'
  useScrollMemory()
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className={`flex-1 ${explore ? 'pt-0 sm:pt-6' : 'pt-10 sm:pt-12'}`}>
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
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="coverage" element={<CoveragePage />} />
          <Route path="terms" element={<Terms />} />
          <Route path="directory" element={<Directory />} />
          {/* The two directories became one (public/_redirects does the same for links from outside) */}
          <Route path="colleges" element={<Navigate to="/directory?kind=college" replace />} />
          <Route path="university" element={<Navigate to="/directory?kind=university" replace />} />
          <Route path=":slug" element={<SitePage />} />
          <Route path=":site/:venue" element={<VenuePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
