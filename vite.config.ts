import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base relatif : fonctionne sur GitHub Pages (/pokemon-strikers/) comme en local
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
})
