import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))

// The primitives gallery. import.meta.env.DEV is false in production builds, so the import (and the
// gallery chunk) is dropped from dist.
if (import.meta.env.DEV && window.location.pathname === '/dev/ui') {
  import('./dev/UiGallery.jsx').then(({ default: UiGallery }) => {
    root.render(
      <StrictMode>
        <UiGallery />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
