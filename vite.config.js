import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Honor an assigned PORT (e.g. from a preview harness); default stays 5173.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    // Fighter-pack sprites are never inlined. Vite base64s anything under 4KB
    // by default, and a pack is dozens of small PNGs — the first one added
    // 110KB to the JS bundle (76KB gzipped) for art that most sessions never
    // display. As separate files the browser fetches only the sprites actually
    // put on screen. Everything else keeps the default behaviour.
    assetsInlineLimit: (filePath) => (filePath.includes('/assets/packs/') ? false : undefined),
  },
})
