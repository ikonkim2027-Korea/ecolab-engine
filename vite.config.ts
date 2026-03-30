import { defineConfig } from 'vite'
import path from 'path'

// GitHub Actions sets GITHUB_ACTIONS=true; use repo name as base path for Pages.
const base = process.env.GITHUB_ACTIONS ? '/ecolab-engine/' : '/'

export default defineConfig({
  root: '.',
  base,
  resolve: {
    extensions: ['.ts', '.js'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
