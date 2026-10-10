import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { load, type State } from './lib/data.tsx'
// Self-hosted, so no font service sees a visitor's IP (index.css says what each is for)
import '@fontsource-variable/public-sans'
import '@fontsource-variable/figtree'
import './index.css'

// Pages are prerendered at build time; that HTML stays up until live data has loaded, then the app takes over.
const root = createRoot(document.getElementById('root')!)
const show = (data: State) =>
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App data={data} />
      </BrowserRouter>
    </StrictMode>,
  )
load().then(
  (data) => show({ status: 'ready', ...data }),
  (e: Error) => show({ status: 'error', error: e.message }),
)
