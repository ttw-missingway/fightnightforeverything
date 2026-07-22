import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Honor an assigned PORT (e.g. from a preview harness); default stays 5173.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
