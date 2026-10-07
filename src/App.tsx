import { Route, Routes } from 'react-router'
import { DataProvider, useData } from './lib/data/useData.tsx'

// Placeholder shell. The UI is intentionally unstyled until the brand identity is approved;
// the data layer (src/lib/data), time logic (src/lib/time) and ranking (src/lib/filters.ts) are final.
function Status() {
  const data = useData()
  if (data.status === 'loading') return <p>Loading…</p>
  if (data.status === 'error') return <p>Error: {data.error}</p>
  const dishes = data.bundle.menus.reduce((n, m) => n + m.days.reduce((k, d) => k + d.items.length, 0), 0)
  return (
    <p>
      Data loaded from {data.source}: {data.bundle.colleges.length} colleges, {data.venues.length} venues, {data.bundle.slots.length} service slots, {dishes} dishes.
    </p>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route path="*" element={<Status />} />
      </Routes>
    </DataProvider>
  )
}
