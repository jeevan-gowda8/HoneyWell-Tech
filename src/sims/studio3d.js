import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/* Shared set-up for the 3D kits: renderer, lighting, camera and instrument-face textures. */

export const quant = (c, x) => Math.min(c.max, Math.max(c.min, +(c.min + Math.round((x - c.min) / c.step) * c.step).toFixed(6)))

export function createStudio(host, { background = 0xeeeeec, exposure = 0.92, env = 0.5, shadow = {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = exposure
  host.prepend(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(background)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture
  scene.environmentIntensity = env
  const camera = new THREE.PerspectiveCamera(32, 1.6, 0.05, 20)
  const orbit = new OrbitControls(camera, renderer.domElement)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ad98, 0.55))
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.position.set(-1.4, 3, 2.2); sun.castShadow = true
  sun.shadow.mapSize.set(1536, 1536)
  Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 2, bottom: -0.6, near: 0.5, far: 7, ...shadow })
  sun.shadow.radius = 5; sun.shadow.bias = -0.0005
  scene.add(sun)
  const release = () => { envRT.dispose(); pmrem.dispose(); renderer.forceContextLoss() }
  return { renderer, scene, camera, orbit, release }
}

export function face(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
  let last = null
  return { tex, set: (key, ...a) => { if (key === last) return; last = key; draw(c.getContext('2d'), w, h, ...a); tex.needsUpdate = true } }
}
