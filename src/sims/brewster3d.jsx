import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { brewsterPanelKit, brewsterPanelPG } from './brewsterpanel'
import { createStudio, face } from './studio3d'

/* The Brewster's law kit as a working 3D model. Metres. The goniometer is at the origin and
   a direction `a` on the bench means (cos a, sin a) in world (x, z), so z comes towards the viewer. */

const HB = 0.135 // beam height
const LASER_DIR = 150, STRAIGHT = -30, ARM_R = 0.2, POL_R = 0.27, LASER_R = 0.4
const GROUND_Y = 0
const UNIT = { x: 0.5, z: 0.2, ry: -0.42, w: 0.25, h: 0.15, d: 0.16, pw: 0.23, ph: 0.13 }
const P = (x, y) => [(x / 920 - 0.5) * UNIT.pw, (0.5 - y / 520) * UNIT.ph]

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const wrap = (d) => ((d + 540) % 360) - 180
const at = (r, a, y) => new THREE.Vector3(r * Math.cos(rad(a)), y, r * Math.sin(rad(a)))
const yaw = (a) => -rad(a) // rotation about y that sends local +x to bench direction a

/* ---- instrument faces ---- */
function drawScale(g, w) {
  const c = w / 2, R = w / 2
  g.clearRect(0, 0, w, w)
  g.fillStyle = '#D9B24C'; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill()
  g.strokeStyle = '#2A1F08'; g.fillStyle = '#21180A'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 30px Arial'
  for (let L = 0; L < 360; L += 1) {
    const a = rad(L - 30), big = L % 30 === 0, mid = L % 10 === 0, five = L % 5 === 0
    g.lineWidth = big ? 4 : mid ? 3 : 1.4
    const q = R * (big ? 0.84 : mid ? 0.88 : five ? 0.91 : 0.94)
    g.beginPath(); g.moveTo(c + R * 0.985 * Math.cos(a), c + R * 0.985 * Math.sin(a)); g.lineTo(c + q * Math.cos(a), c + q * Math.sin(a)); g.stroke()
    if (big) { g.save(); g.translate(c + R * 0.77 * Math.cos(a), c + R * 0.77 * Math.sin(a)); g.rotate(a + Math.PI / 2); g.fillText(String(L), 0, 0); g.restore() }
  }
}
function drawWheel(g, w) {
  const c = w / 2
  g.fillStyle = '#17181C'; g.fillRect(0, 0, w, w)
  g.strokeStyle = '#E9EBEF'; g.fillStyle = '#E9EBEF'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '30px Arial'
  for (let d = -180; d < 180; d += 1) {
    const a = rad(d), big = d % 30 === 0, five = d % 5 === 0
    g.lineWidth = big ? 4 : five ? 2.2 : 1
    const q = c * (big ? 0.82 : five ? 0.87 : 0.9)
    g.beginPath(); g.moveTo(c + c * 0.96 * Math.sin(a), c - c * 0.96 * Math.cos(a)); g.lineTo(c + q * Math.sin(a), c - q * Math.cos(a)); g.stroke()
    if (big && Math.abs(d) <= 90) g.fillText(String(Math.abs(d)), c + c * 0.7 * Math.sin(a), c - c * 0.7 * Math.cos(a))
  }
}
function drawBench(g, w, h) {
  g.fillStyle = '#E4E7EB'; g.fillRect(0, 0, w, h)
  g.strokeStyle = '#26282D'; g.fillStyle = '#26282D'; g.textAlign = 'center'; g.font = 'bold 24px Arial'
  for (let mm = 0; mm <= 300; mm += 5) {
    const x = 20 + (mm / 300) * (w - 40), big = mm % 50 === 0
    g.lineWidth = big ? 3 : 1.4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, big ? 50 : mm % 10 === 0 ? 34 : 22); g.stroke()
    if (big) g.fillText(String(mm / 10), x, 82)
  }
}
function drawPanel(g, w, h) {
  g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, w, h)
  g.textAlign = 'center'; g.fillStyle = '#1D3F66'; g.font = 'bold 40px Arial'; g.fillText('PHOTO DETECTOR OUTPUT UNIT', w / 2, 52)
  g.fillStyle = '#0C0D10'; g.fillRect(60, 76, 800, 210)
  g.fillStyle = '#3F4B5C'; g.font = '28px Arial'; g.fillText('RANGE 0 – 199', w / 2, 330)
  g.font = 'bold 26px Arial'; [[130, 'ZERO'], [340, 'GAIN'], [600, 'INPUT'], [790, 'POWER']].forEach(([x, t]) => g.fillText(t, x, 500))
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' }
function drawDisplay(g, w, h, text) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  const s = 58, step = 112, n = text.replace('.', '').length
  let x = w - 56 - n * step + 40
  g.lineCap = 'round'; g.lineWidth = 11
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - 26, 36 + s * 2, 8, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => {
      g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'
      g.beginPath(); g.moveTo(x + p[0] * s, 36 + p[1] * s); g.lineTo(x + p[2] * s, 36 + p[3] * s); g.stroke()
    })
    x += step
  })
}

const VIEWS = {
  whole: { p: [-0.08, 0.52, 1.3], t: [0.05, 0.09, 0.04] },
  gonio: { p: [0.02, 0.3, 0.46], t: [0, 0.11, 0] },
  pol: { p: [-0.5, 0.24, 0.62], t: [-0.28, 0.13, 0.14] },
  unit: { p: [0.3, 0.24, 0.78], t: [UNIT.x, 0.075, UNIT.z] },
}

function createScene(host, malus, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xeceef1, exposure: 0.95, env: 0.55, shadow: { left: -0.9, right: 0.9, top: 0.9, bottom: -0.9, far: 6 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0xc4c9d0, roughness: 0.72 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.3 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.36 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.16 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xe0ba5c, metalness: 0.9, roughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.5, metalness: 0.4 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x2f5075, roughness: 0.45, metalness: 0.25 }),
    det: new THREE.MeshStandardMaterial({ color: 0x203a5f, roughness: 0.42 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe6f4, transparent: true, opacity: 0.42, roughness: 0.06, metalness: 0, clearcoat: 1, side: THREE.DoubleSide }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const hitBox = (geo, x, y, z, d, parent) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }

  const floor = add(new THREE.BoxGeometry(3.4, 0.04, 2.4), M.table, 0, GROUND_Y - 0.02, 0); floor.castShadow = false
  const wall = add(new THREE.PlaneGeometry(6, 3), new THREE.MeshStandardMaterial({ color: 0xeceef1, roughness: 0.95 }), 0, 1.3, -1.1); wall.castShadow = false

  /* goniometer */
  add(cyl(0.11, 0.05, 72), M.alu, 0, 0.025, 0)
  const scaleFace = face(1400, 1400, drawScale); scaleFace.set(1)
  const ring = add(new THREE.RingGeometry(0.066, 0.0875, 96), new THREE.MeshStandardMaterial({ map: scaleFace.tex, transparent: true, metalness: 0.25, roughness: 0.45 }), 0, 0.0505, 0)
  ring.rotation.x = -Math.PI / 2; ring.castShadow = false
  /* map the texture square on to the ring's real radius */
  ring.geometry.attributes.uv.array.forEach((_, i, arr) => { if (i % 2 === 0) { const px = ring.geometry.attributes.position.getX(i / 2), py = ring.geometry.attributes.position.getY(i / 2); arr[i] = px / 0.175 + 0.5; arr[i + 1] = py / 0.175 + 0.5 } })
  ring.geometry.attributes.uv.needsUpdate = true
  add(cyl(0.066, 0.002, 72), M.dark, 0, 0.051, 0)
  ;[[-0.1, 0.06], [0.06, 0.1]].forEach(([x, z]) => { const k = add(cyl(0.006, 0.012, 20), M.black, x * 1.02, 0.03, z * 1.02); k.rotation.z = Math.PI / 2 })
  add(cyl(0.016, 0.05, 32), M.chrome, 0, 0.078, 0)

  const table = new THREE.Group(); scene.add(table)
  add(cyl(0.042, 0.006, 56), M.alu, 0, 0.104, 0, table)
  ;[0, 120, 240].forEach((a) => add(cyl(0.004, 0.012, 14), M.black, 0.034 * Math.cos(rad(a)), 0.113, 0.034 * Math.sin(rad(a)), table))
  ;[0, 90, 180, 270].forEach((a) => add(new THREE.BoxGeometry(0.018, 0.002, 0.012), M.brass, 0.077 * Math.cos(rad(a)), 0.0525, 0.077 * Math.sin(rad(a)), table).rotation.y = -rad(a))
  if (!malus) {
    add(new THREE.BoxGeometry(0.078, 0.004, 0.012), M.black, 0, 0.108, 0, table)
    const plate = add(new THREE.BoxGeometry(0.07, 0.056, 0.004), M.glass, 0, HB, 0, table); plate.castShadow = false
  }
  hitBox(cyl(0.05, 0.08, 16), 0, 0.14, 0, 'table', table)

  /* optical bench running towards the laser */
  const bench = new THREE.Group(); bench.rotation.y = yaw(LASER_DIR); scene.add(bench)
  const prismGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.33, 3); prismGeo.rotateY(rad(30))
  const prism = add(prismGeo, M.alu, 0.31, 0.024, 0, bench); prism.rotation.z = Math.PI / 2
  const tickFace = face(1200, 100, drawBench); tickFace.set(1)
  const tick = add(new THREE.PlaneGeometry(0.31, 0.024), new THREE.MeshStandardMaterial({ map: tickFace.tex, roughness: 0.5, metalness: 0.2 }), 0.31, 0.0375, 0, bench)
  tick.rotation.x = -Math.PI / 2; tick.castShadow = false
  add(new THREE.BoxGeometry(0.035, 0.012, 0.04), M.black, POL_R, 0.044, 0, bench); add(new THREE.BoxGeometry(0.035, 0.012, 0.04), M.black, LASER_R, 0.044, 0, bench)
  add(cyl(0.005, HB - 0.05), M.chrome, LASER_R, (HB + 0.05) / 2, 0, bench)
  const laser = add(new THREE.CylinderGeometry(0.015, 0.015, 0.09, 28), M.black, LASER_R + 0.012, HB, 0, bench); laser.rotation.z = Math.PI / 2
  const nose = add(cyl(0.009, 0.016, 20), M.chrome, LASER_R - 0.04, HB, 0, bench); nose.rotation.z = Math.PI / 2

  /* polarizer wheel, facing the laser */
  const wheelStand = add(cyl(0.005, HB - 0.05 - 0.06), M.chrome, POL_R, 0, 0, bench); wheelStand.position.y = (HB + 0.05 - 0.06) / 2
  const wheel = new THREE.Group(); wheel.position.copy(at(POL_R, LASER_DIR, HB)); wheel.rotation.y = rad(90 - LASER_DIR); scene.add(wheel)
  const WR = 0.065
  const rim = add(cyl(WR, 0.01, 64), M.black, 0, 0, -0.002, wheel); rim.rotation.x = Math.PI / 2
  const wheelFace = face(900, 900, drawWheel); wheelFace.set(1)
  const disc = add(new THREE.CircleGeometry(WR * 0.98, 64), new THREE.MeshStandardMaterial({ map: wheelFace.tex, roughness: 0.6 }), 0, 0, 0.0035, wheel); disc.castShadow = false
  const rotor = new THREE.Group(); rotor.position.z = 0.0042; wheel.add(rotor)
  const film = add(new THREE.CircleGeometry(0.0225, 36), new THREE.MeshStandardMaterial({ color: 0x96283a, transparent: true, opacity: 0.55 }), 0, 0, 0.0006, rotor); film.castShadow = false
  for (let i = -3; i <= 3; i++) add(new THREE.PlaneGeometry(0.0007, 0.042), new THREE.MeshBasicMaterial({ color: 0xffb4a8 }), i * 0.006, 0, 0.0009, rotor).castShadow = false
  add(new THREE.ConeGeometry(0.006, 0.012, 3), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 0, WR + 0.002, 0, rotor).rotation.z = Math.PI
  const wheelHit = hitBox(new THREE.CircleGeometry(WR * 1.06, 20), 0, 0, 0.008, 'pol', wheel); wheelHit.material = M.hit

  /* telescope, in line with the undeviated beam */
  if (!malus) {
    const tele = new THREE.Group(); tele.rotation.y = yaw(STRAIGHT); scene.add(tele)
    add(new THREE.BoxGeometry(0.22, 0.012, 0.04), M.dark, 0.25, 0.012, 0, tele)
    ;[0.17, 0.32].forEach((x) => add(cyl(0.005, HB - 0.018, 16), M.chrome, x, (HB + 0.018) / 2, 0, tele))
    const body = add(cyl(0.017, 0.2), M.black, 0.24, HB, 0, tele); body.rotation.z = Math.PI / 2
    const objective = add(cyl(0.02, 0.022), M.chrome, 0.135, HB, 0, tele); objective.rotation.z = Math.PI / 2
    const eye = add(cyl(0.012, 0.05), M.dark, 0.365, HB, 0, tele); eye.rotation.z = Math.PI / 2
  }

  /* detector arm: local +x points along the arm */
  const arm = new THREE.Group(); scene.add(arm)
  add(new THREE.BoxGeometry(0.15, 0.012, 0.03), M.black, 0.14, 0.018, 0, arm)
  add(cyl(0.005, HB - 0.03, 16), M.chrome, ARM_R, (HB + 0.024) / 2, 0, arm)
  add(new THREE.BoxGeometry(0.036, 0.036, 0.036), M.det, ARM_R + 0.012, HB, 0, arm)
  const pinhole = add(cyl(0.006, 0.002, 20), new THREE.MeshBasicMaterial({ color: 0x111111 }), ARM_R - 0.0065, HB, 0, arm); pinhole.rotation.z = Math.PI / 2
  hitBox(new THREE.BoxGeometry(0.06, 0.08, 0.07), ARM_R + 0.012, HB - 0.01, 0, 'arm', arm)
  hitBox(new THREE.BoxGeometry(0.15, 0.03, 0.05), 0.14, 0.02, 0, 'arm', arm)

  /* output unit */
  const unit = new THREE.Group(); unit.position.set(UNIT.x, 0, UNIT.z); unit.rotation.y = UNIT.ry; scene.add(unit)
  add(new THREE.BoxGeometry(UNIT.w, UNIT.h, UNIT.d), M.blue, 0, UNIT.h / 2, 0, unit)
  add(new THREE.BoxGeometry(UNIT.w * 0.94, 0.008, UNIT.d * 0.9), new THREE.MeshStandardMaterial({ color: 0x4a6e96, roughness: 0.45 }), 0, UNIT.h + 0.004, 0, unit)
  const panel = new THREE.Group(); panel.position.set(0, UNIT.h / 2, UNIT.d / 2 + 0.0008); unit.add(panel)
  const art = face(920, 520, drawPanel); art.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(UNIT.pw, UNIT.ph), new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.55 })))
  const dispFace = face(640, 210, drawDisplay)
  const [dx, dy] = P(460, 181)
  const disp = new THREE.Mesh(new THREE.PlaneGeometry((780 / 920) * UNIT.pw, (190 / 520) * UNIT.ph), new THREE.MeshBasicMaterial({ map: dispFace.tex, toneMapped: false }))
  disp.position.set(dx, dy, 0.0006); panel.add(disp)
  const knob = (px, name) => {
    const [a, b] = P(px, 408)
    const g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g)
    const k = add(cyl(0.0105, 0.012, 28), M.black, 0, 0, 0.006, g); k.rotation.x = Math.PI / 2
    add(new THREE.BoxGeometry(0.0016, 0.008, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.0065, 0.0125, g)
    hitBox(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 12), 0, 0, 0.01, name, g).rotation.x = Math.PI / 2
    return g
  }
  const zeroKnob = knob(130, 'zero'), gainKnob = knob(340, 'gain')
  const [ja, jb] = P(600, 408)
  const jack = add(cyl(0.0075, 0.008, 20), M.chrome, ja, jb, 0.004, panel); jack.rotation.x = Math.PI / 2
  const [ra, rb] = P(790, 408)
  add(new THREE.BoxGeometry(0.032, 0.02, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(new THREE.BoxGeometry(0.014, 0.016, 0.005), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.007, rb, 0.004, panel)
  hitBox(new THREE.BoxGeometry(0.05, 0.04, 0.03), ra, rb, 0.01, 'power', panel)

  /* cables */
  scene.updateMatrixWorld(true)
  const tubeOf = (pts, r = 0.0026) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, r, 8)
  const lt = at(LASER_R + 0.06, LASER_DIR, HB), unitIn = unit.localToWorld(new THREE.Vector3(-UNIT.w / 2, 0.04, 0))
  add(tubeOf([lt, new THREE.Vector3(lt.x - 0.06, 0.05, lt.z + 0.08), new THREE.Vector3(-0.3, 0.005, 0.5), new THREE.Vector3(0.2, 0.005, 0.46), unitIn]), M.cable, 0, 0, 0)
  const socket = panel.localToWorld(new THREE.Vector3(ja, jb, 0.008))
  const detCable = add(tubeOf([socket, socket]), M.cable, 0, 0, 0)
  const routeCable = (a) => {
    const h = at(ARM_R + 0.03, a, HB - 0.01)
    detCable.geometry.dispose()
    detCable.geometry = tubeOf([h, new THREE.Vector3(h.x + 0.04, 0.06, h.z + 0.05), new THREE.Vector3((h.x + socket.x) / 2 + 0.04, 0.006, (h.z + socket.z) / 2 + 0.1), new THREE.Vector3(socket.x, 0.01, socket.z + 0.07), socket])
  }

  /* light: thin beams with travelling photons */
  const beamMat = () => new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 1, depthWrite: false })
  const beams = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(cyl(0.0013, 1, 8), beamMat()); scene.add(m); return m })
  const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3()
  const setBeam = (m, a, b, op) => {
    const len = a.distanceTo(b)
    m.visible = op > 0.005 && len > 0.001
    if (!m.visible) return
    m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, len, 1)
    m.quaternion.setFromUnitVectors(UP, tmp.copy(b).sub(a).normalize()); m.material.opacity = op
  }
  const beadGeo = new THREE.SphereGeometry(0.0027, 10, 8), beadMats = [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ color: 0xfff1e0, transparent: true, depthWrite: false }))
  const beads = Array.from({ length: 70 }, () => { const m = new THREE.Mesh(beadGeo, beadMats[0]); m.visible = false; scene.add(m); return m })
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffb0a0, transparent: true, depthWrite: false })); spot.position.set(0, HB, 0); scene.add(spot)
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff6b5e })); scene.add(glow)

  /* view */
  function draw() { renderer.render(scene, camera) }
  const applyView = (name) => { const w = VIEWS[name]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.22; orbit.maxDistance = 2; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.3; orbit.maxAzimuthAngle = 1.3
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  /* pointer */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3()
  const pick = (e) => {
    const r = el.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d)
  }
  const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const wheelPlane = new THREE.Plane()
  const rayTo = (e, plane) => { pick(e); return ray.ray.intersectPlane(plane, hitP) }
  const benchAngle = (e, y) => { planeY.constant = -y; const p = rayTo(e, planeY); return p ? deg(Math.atan2(p.z, p.x)) : null }
  const wheelAngle = (e) => { const p = rayTo(e, wheelPlane); if (!p) return null; const q = wheel.worldToLocal(p.clone()); return deg(Math.atan2(q.x, q.y)) }

  const S = { v: null, o: null, drag: null, lastArm: null, lastT: 0 }
  const el = renderer.domElement
  const usable = (d) => !(malus && (d === 'table' || d === 'arm'))
  const onDown = (e) => {
    const h = pick(e), d = h?.object.userData.d
    if (!d || !usable(d)) return
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    if (d === 'power') { api.set('on', !S.v.on); S.drag = { none: true }; return }
    S.drag = { d, x: e.clientX, y: e.clientY, a: d === 'pol' ? wheelAngle(e) : benchAngle(e, d === 'table' ? 0.12 : HB), th: S.v.th, phi: S.v.phi, gain: S.v.gain, zero: S.v.zero }
  }
  const onMove = (e) => {
    const s = S.drag
    if (!s) {
      const d = pick(e)?.object.userData.d
      el.style.cursor = !d || !usable(d) ? 'move' : d === 'power' ? 'pointer' : 'grab'
      return
    }
    if (s.d === 'table') { const a = benchAngle(e, 0.12); if (a !== null) api.set('th', clamp(Math.round((s.th - wrap(a - s.a)) * 2) / 2, 40, 75)) }
    if (s.d === 'arm') { const a = benchAngle(e, HB); if (a !== null) { api.set('link', false); api.set('arm', clamp(Math.round(a * 2) / 2, -15, 85)) } }
    if (s.d === 'pol') { const a = wheelAngle(e); if (a !== null) api.set('phi', clamp(Math.round(s.phi + wrap(a - s.a)), malus ? -90 : 0, 90)) }
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (s.d === 'gain') api.set('gain', +clamp(s.gain + mv * 0.002, 0.8, 1.2).toFixed(3))
    if (s.d === 'zero') api.set('zero', +clamp(s.zero + mv * 0.04, -5, 5).toFixed(1))
  }
  const onUp = () => { S.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const A = at(LASER_R - 0.05, LASER_DIR, HB), B = at(POL_R, LASER_DIR, HB), C = new THREE.Vector3(0, HB, 0)
  wheel.updateMatrixWorld(true)
  wheelPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).applyQuaternion(wheel.quaternion), B)

  function update(v, o, t) {
    S.v = v; S.o = o; S.lastT = t
    const th = malus ? 56 : v.th
    const N = LASER_DIR - th
    table.rotation.y = rad(90 - N)
    const R = malus ? STRAIGHT : LASER_DIR - 2 * th
    const armA = malus ? STRAIGHT : v.link ? R : v.arm
    arm.rotation.y = yaw(armA)
    if (armA !== S.lastArm) { S.lastArm = armA; routeCable(armA) }
    rotor.rotation.z = -rad(v.phi)
    zeroKnob.rotation.z = rad(135 - ((v.zero + 5) / 10) * 270); gainKnob.rotation.z = rad(135 - ((v.gain - 0.8) / 0.4) * 270)
    rocker.position.x = ra + (v.on ? -0.007 : 0.007)
    const text = v.on ? (o.I > 199.9 ? '1' : o.I.toFixed(1).padStart(4, '0')) : ''
    dispFace.set(text, text)

    /* beams */
    const refl = clamp(0.12 + o.raw / 40, 0.12, 1), through = malus ? clamp(o.raw / 150 + 0.05, 0.05, 1) : 0.55
    const reflEnd = at(ARM_R, R, HB), scope = at(0.125, STRAIGHT, HB), straightEnd = at(ARM_R, STRAIGHT, HB)
    const segs = [[A, B, 1], [B, C, malus ? through : 1], malus ? [C, straightEnd, through] : [C, scope, through], malus ? [C, C, 0] : [C, reflEnd, refl]]
    segs.forEach(([a, b, op], i) => setBeam(beams[i], a, b, v.on ? op : 0))
    let n = 0
    segs.forEach(([a, b, op], i) => {
      if (!v.on || op < 0.005) return
      beadMats[i].opacity = Math.min(1, op + 0.15)
      const len = a.distanceTo(b), gap = 0.028, off = (t * 0.14) % gap
      for (let d = off; d < len && n < beads.length; d += gap) { const m = beads[n++]; m.visible = true; m.material = beadMats[i]; m.position.lerpVectors(a, b, d / len) }
    })
    for (let i = n; i < beads.length; i++) beads[i].visible = false
    spot.visible = v.on && !malus
    glow.visible = v.on && o.align > 0.6
    glow.position.copy(at(ARM_R - 0.008, armA, HB))
    draw()
  }

  const dispose = () => {
    ro.disconnect(); orbit.dispose()
    el.removeEventListener('pointerdown', onDown, cap); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp)
    scene.traverse((q) => { q.geometry?.dispose(); const m = q.material; if (m) { m.map?.dispose(); m.dispose() } })
    release(); renderer.dispose(); el.remove()
  }
  applyView('whole'); size()
  return { update, dispose, applyView }
}

const LABELS = [['whole', 'Whole kit'], ['gonio', 'Goniometer'], ['pol', 'Laser and polarizer'], ['unit', 'Output unit']]
const HINTS = {
  brewster: 'Drag the turntable to rotate the glass. Drag the polarizer wheel to set its angle. Drag the detector or its arm to align it by hand. ZERO, GAIN and POWER work on the output unit. Drag the background to look around.',
  malus: 'Drag the polarizer wheel to rotate it. ZERO, GAIN and POWER work on the output unit. Drag the background to look around.',
}

function make(exp) {
  const malus = exp.id === 'malus-law', Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({})
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, malus, exp.controls, { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
        </div>
        <p className="stage3d-hint">{HINTS[malus ? 'malus' : 'brewster']}</p>
      </div>
    )
  }
}

export const brewster3D = brewsterPanelKit.map((e) => ({ ...e, Stage: make(e) }))
export const brewster3DPG = brewsterPanelPG.map((e) => ({ ...e, Stage: make(e) }))
