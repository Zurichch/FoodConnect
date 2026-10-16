import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The "proxy" forwards every request starting with /api to the Flask backend,
// so the React code can simply call "/api/..." during development.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
