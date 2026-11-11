import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // three.js is only reached through a dynamic import, so the dev server must prepare it up front.
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js', 'three/examples/jsm/environments/RoomEnvironment.js', 'three/examples/jsm/renderers/CSS3DRenderer.js'],
  },
})
