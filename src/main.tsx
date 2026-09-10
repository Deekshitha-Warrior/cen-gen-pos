import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'

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

  const isBenignError = (errorMsg: string) => {
    if (!errorMsg) return false
    return (
      errorMsg.includes('message channel closed before a response was received') ||
      errorMsg.includes('A listener indicated an asynchronous response') ||
      errorMsg.includes('ResizeObserver loop completed with undelivered notifications') ||
      errorMsg.includes('ResizeObserver loop limit exceeded') ||
      errorMsg.includes('Non-Error promise rejection captured') ||
      errorMsg.includes('Permissions policy violation: unload') ||
      errorMsg.includes('unload is not allowed in this document') ||
      errorMsg.includes('Using DEFAULT root logger')
    )
  }

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const errorMsg =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === 'string'
          ? event.reason
          : event.reason && typeof event.reason === 'object' && 'message' in event.reason
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

      if (isBenignError(errorMsg)) {
        event.preventDefault()
        event.stopImmediatePropagation?.()
      }
    },
    true
  )

  window.addEventListener(
    'error',
    (event) => {
      const errorMsg =
        event.message ||
        (event.error instanceof Error ? event.error.message : String(event.error || ''))
      if (isBenignError(errorMsg)) {
        event.preventDefault()
        event.stopImmediatePropagation?.()
      }
    },
    true
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)


