import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/eval360/',
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/eval360/api': {
        target: 'http://192.168.3.87',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/eval360\/api/, '/eval360/api')
      }
    }
  }
})