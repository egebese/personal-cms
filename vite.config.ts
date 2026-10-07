import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare()],
  // The admin SPA is the only client entry; public pages are rendered by the worker.
  environments: { client: { build: { rollupOptions: { input: { admin: 'admin.html' } } } } },
})
