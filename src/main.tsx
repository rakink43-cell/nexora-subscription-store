import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initDataSource } from './lib/api'

const root = createRoot(document.getElementById('root')!)

// Resolve whether the Supabase schema is actually applied before the first
// render, so the UI never shows a "live" badge (or silently writes demo data)
// while the database is still uninitialised.
initDataSource()
  .catch(() => 'setup' as const)
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
