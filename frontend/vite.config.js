import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800
  },
  server: {
    port: 5173,
    proxy: {
      '/admin-api': {
        target: 'http://localhost:8004',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://localhost:8004',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
