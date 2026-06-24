import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from "@vercel/analytics/react"
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New version available. Refresh?')) {
      updateSW(true);
    }
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
