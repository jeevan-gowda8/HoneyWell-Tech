import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

/* Clean addresses (/kits/air-wedge) are handled in the browser. Hosts that serve 404.html for
   unknown paths (GitHub Pages, Netlify, most static servers) then still open the app. */
const spaFallback = { name: 'spa-fallback', closeBundle() { if (fs.existsSync('dist/index.html')) fs.copyFileSync('dist/index.html', 'dist/404.html') } }

export default defineConfig({
  plugins: [react(), spaFallback],
  base: '/',
  // three.js is only reached through a dynamic import, so the dev server must prepare it up front.
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js', 'three/examples/jsm/environments/RoomEnvironment.js', 'three/examples/jsm/renderers/CSS3DRenderer.js'],
  },
})
