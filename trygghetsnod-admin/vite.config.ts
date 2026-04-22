import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8500,
    proxy: {
      '/api': 'http://localhost:8400',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
