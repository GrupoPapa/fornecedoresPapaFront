import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // durante o desenvolvimento o front chama /api e o Vite redireciona para o Spring Boot
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
