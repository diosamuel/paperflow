import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  // Read .env from the repo root so config stays in one place.
  envDir: fileURLToPath(new URL('../../../..', import.meta.url)),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
