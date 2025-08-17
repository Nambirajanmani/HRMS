import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration with proxy for development
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Backend server
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
