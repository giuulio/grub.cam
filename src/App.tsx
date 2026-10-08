import { useEffect } from 'react'
import { Outlet, Route, Routes, useLocation } from 'react-router'
import { Container } from './components/Container.tsx'
import { Footer } from './components/Footer.tsx'
import { Header } from './components/Header.tsx'
import { DataProvider, useData } from './lib/data.tsx'
import { About } from './pages/About.tsx'
import { Home } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { SitePage } from './pages/Site.tsx'
import { VenuePage } from './pages/Venue.tsx'

function Layout() {
  const data = useData()
  const { pathname, hash } = useLocation()
  // New page starts at the top (pages with a #hash scroll themselves)
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-12">
        <Container>{data.status === 'ready' ? <Outlet /> : data.status === 'error' ? <p className="text-white/50">{data.error}</p> : null}</Container>
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path=":slug" element={<SitePage />} />
          <Route path=":site/:venue" element={<VenuePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
