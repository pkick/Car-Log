import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
    // The repo root, so the dev server can serve `shared/` (PLAN.md D16) next to the app.
    fs: {
      allow: ['..'],
    },
  },
})
