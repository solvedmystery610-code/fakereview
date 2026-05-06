import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Charting libraries
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          // Animation & UI
          'ui-vendor': ['framer-motion', 'lucide-react'],
          // PDF generation
          'pdf-vendor': ['jspdf'],
          // Particles
          'particles-vendor': ['tsparticles', 'react-tsparticles'],
        },
      },
    },
  },
})

