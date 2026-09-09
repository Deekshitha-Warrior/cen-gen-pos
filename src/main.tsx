import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global deployment chunk recovery & benign error suppression
if (typeof window !== 'undefined') {
  // Vite official event when dynamic chunk fails to preload (e.g. after new deployment)
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Preload error detected after new deployment, reloading...', event)
    const lastReload = sessionStorage.getItem('chunk_reload_ts')
    const now = Date.now()
    if (!lastReload || now - Number(lastReload) > 10000) {
      sessionStorage.setItem('chunk_reload_ts', String(now))
      window.location.reload()
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg =
      event.reason instanceof Error
        ? event.reason.message
        : typeof event.reason === 'string'
        ? event.reason
        : (event.reason && typeof event.reason === 'object' && 'message' in event.reason)
        ? String((event.reason as { message?: unknown }).message)
        : ''

    // Handle stale deployment chunk 404/MIME errors by gracefully reloading the page once
    if (
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('Expected a JavaScript-or-Wasm module script') ||
      errorMsg.includes('error loading dynamically imported module') ||
      errorMsg.includes('Importing a module script failed')
    ) {
      console.warn('[App] Dynamic chunk load error detected, refreshing page for updated assets:', errorMsg)
      const lastReload = sessionStorage.getItem('chunk_reload_ts')
      const now = Date.now()
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem('chunk_reload_ts', String(now))
        window.location.reload()
        return
      }
    }

    if (
      errorMsg.includes('message channel closed before a response was received') ||
      errorMsg.includes('A listener indicated an asynchronous response') ||
      errorMsg.includes('ResizeObserver loop completed with undelivered notifications')
    ) {
      event.preventDefault()
      event.stopImmediatePropagation?.()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

