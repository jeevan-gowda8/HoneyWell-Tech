import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { psuKit } from './electrical'
import { createStudio, face, quant } from './studio3d'

/* The dual regulated supply as a working 3D model: keypad, encoder, two LCDs, a rheostat on
   channel A and a fixed power resistor on channel B. Metres. */

const U = { x: -0.18, z: -0.1, ry: 0, w: 0.65, h: 0.26, d: 0.36, x0: 230, y0: 300, W: 1300, H: 520, pw: 0.65 }
const K = U.pw / U.W
const ph = (U.pw * U.H) / U.W
const P = (x, y) => [((x - U.x0) / U.W - 0.5) * U.pw, (0.5 - (y - U.y0) / U.H) * ph]
const RB = 4.907 // channel B's fixed resistor
const RH = { x: 0.42, z: 0.02, len: 0.26 }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const rad = (d) => (d * Math.PI) / 180
const STEPS = [1, 0.1, 0.01]

function drawFace(g, W, H) {
  const k = W / U.W, X = (x) => (x - U.x0) * k, Y = (y) => (y - U.y0) * k
  const t = (s, x, y, z = 15, c = '#E8EBEF', al = 'center', bold = true) => { g.fillStyle = c; g.font = `${bold ? 'bold ' : ''}${z * k}px Arial`; g.textAlign = al; g.fillText(s, X(x), Y(y)) }
  const rr = (x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(X(x), Y(y), w * k, h * k, r * k); g.fill() }
  g.fillStyle = '#D5D8DC'; g.fillRect(0, 0, W, H)
  rr(254, 324, 1252, 472, 8, '#2D323A')
  t('DUAL REGULATED DC POWER SUPPLY', 284, 367, 22, '#F4F6F8', 'left')
  t('2 × 0–30 V / 0–3 A · CV / CC · NUMERIC KEYPAD', 284, 391, 14, '#C6CCD4', 'left', false)
  rr(278, 404, 432, 202, 6, '#090B0F'); rr(718, 404, 432, 202, 6, '#090B0F'); rr(1174, 404, 300, 270, 8, '#22262D')
  ;[[314, 'CV'], [394, 'CC'], [474, 'OCP'], [754, 'CV'], [834, 'CC'], [914, 'OCP']].forEach(([x, s]) => t(s, x + 16, 635, 15, '#E8EBEF', 'left'))
  ;[354, 794].forEach((x) => t('+', x, 702, 20)); [494, 934].forEach((x) => t('GND', x, 702, 16)); [634, 1074].forEach((x) => t('−', x, 702, 20))
  t('CH A OUTPUT · 0–30 V / 0–3 A', 494, 784, 14, '#C6CCD4', 'center', false); t('CH B OUTPUT · 0–30 V / 0–3 A', 934, 784, 14, '#C6CCD4', 'center', false)
  t('NUMERIC KEYPAD · STEP ▲▼', 1324, 693, 14, '#C6CCD4', 'center', false); t('POWER', 1454, 402, 13, '#C6CCD4', 'center', false)
}
function drawLcd(g, w, h, s) {
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0B2A40'); bg.addColorStop(1, '#071A28'); g.fillStyle = bg; g.fillRect(0, 0, w, h)
  if (s.dark) { g.fillStyle = '#04090E'; g.fillRect(0, 0, w, h); return }
  if (s.active) { g.strokeStyle = '#67D0FF'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6) }
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.font = 'bold 30px Arial'; g.fillStyle = '#7FD4FF'; g.fillText(s.name, 28, 50)
  const col = s.mode === 'CV' ? '#2E7D32' : s.mode === 'CC' ? '#E65100' : '#5A6470'
  g.fillStyle = col; g.fillRect(w - 148, 22, 112, 40); g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = 'bold 26px Arial'; g.fillText(s.mode, w - 92, 52)
  g.textAlign = 'right'
  g.font = 'bold 118px "Courier New", monospace'; g.fillStyle = '#F2FBFF'; g.fillText(s.V, 668, 176); g.font = 'bold 48px Arial'; g.fillStyle = '#7FD4FF'; g.fillText('V', 790, 176)
  g.font = 'bold 92px "Courier New", monospace'; g.fillStyle = '#FFD45E'; g.fillText(s.A, 668, 278); g.font = 'bold 40px Arial'; g.fillStyle = '#FFD45E'; g.fillText('A', 790, 278)
  g.font = 'bold 50px "Courier New", monospace'; g.fillStyle = '#A8E6B0'; g.fillText(s.W, 668, 350); g.font = 'bold 34px Arial'; g.fillText('W', 790, 350)
  g.textAlign = 'left'; g.font = 'bold 25px Arial'; g.fillStyle = s.edit ? '#FFC14D' : '#A8DCC0'; g.fillText(s.line, 28, 348)
}
const keyArt = (label, fg) => (g, w, h) => {
  const size = label.length > 2 ? Math.min(h * 0.42, (w * 0.86) / (label.length * 0.64)) : h * 0.6
  g.clearRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'
  if (label === 'ENT') { g.strokeStyle = fg; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(w * 0.72, h * 0.3); g.lineTo(w * 0.72, h * 0.58); g.lineTo(w * 0.3, h * 0.58); g.moveTo(w * 0.42, h * 0.45); g.lineTo(w * 0.3, h * 0.58); g.lineTo(w * 0.42, h * 0.71); g.stroke(); return }
  g.font = `bold ${size}px Arial`; g.fillText(label, w / 2, h / 2 + h * 0.02)
}
function drawLoadTag(g, w, h, text) { g.fillStyle = '#0C0F13'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFD45E'; g.font = 'bold 60px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4) }
const silk = (text, size = 34, col = '#FFF') => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2) }
function drawWood(g, w, h) { g.fillStyle = '#3C434C'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(255,255,255,${0.012 + (i % 4) * 0.008})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 6); g.stroke() } }

const VIEWS = {
  whole: { p: [0.1, 0.5, 1.5], t: [0.1, 0.15, 0.06] },
  front: { p: [-0.18, 0.28, 1.0], t: [-0.18, 0.13, 0.08] },
  keypad: { p: [0.06, 0.24, 0.5], t: [0.05, 0.12, 0.08] },
  load: { p: [0.42, 0.34, 0.66], t: [0.42, 0.06, 0.02] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xdfe3e7, exposure: 1, env: 0.6, shadow: { left: -1, right: 1, top: 1, bottom: -0.9, far: 7 } })
  const stdM = (color, roughness = 0.45, metalness = 0.25) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const M = { case: stdM(0xdcdfe3, 0.5, 0.15), lid: stdM(0xeef0f2, 0.5, 0.15), black: stdM(0x17181c, 0.42), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }), dark: stdM(0x2a2e35, 0.5), brass: new THREE.MeshStandardMaterial({ color: 0xc98f3f, metalness: 0.8, roughness: 0.35 }), ceramic: stdM(0xe7dcc2, 0.7, 0), coil: new THREE.MeshStandardMaterial({ color: 0xb7763a, metalness: 0.7, roughness: 0.4 }), hit: new THREE.MeshBasicMaterial({ visible: false }) }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 28) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const tubeG = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, r, 8)

  const top = face(1024, 512, drawWood); top.set(1); top.tex.wrapS = top.tex.wrapT = THREE.RepeatWrapping; top.tex.repeat.set(2, 1)
  plain(add(box(4.6, 0.04, 2.6), new THREE.MeshStandardMaterial({ map: top.tex, roughness: 0.68 }), 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xdfe3e7, roughness: 0.95 }), 0, 1.3, -1.25))

  /* case */
  const unit = new THREE.Group(); unit.position.set(U.x, 0.016, U.z); scene.add(unit)
  add(box(U.w, U.h, U.d), M.case, 0, U.h / 2, 0, unit); add(box(U.w * 0.97, 0.006, U.d * 0.95), M.lid, 0, U.h + 0.003, 0, unit)
  for (let i = 0; i < 18; i++) add(box(0.012, 0.0014, 0.07), M.dark, -0.2 + i * 0.0235, U.h + 0.0066, -0.06, unit).rotation.y = 0.32
  ;[-0.25, 0.25].forEach((x) => { add(box(0.07, 0.016, 0.05), M.black, x, -0.008, U.d / 2 - 0.05, unit); add(box(0.07, 0.016, 0.05), M.black, x, -0.008, -U.d / 2 + 0.05, unit) })
  add(tubeG([V(-0.135, U.h, 0.03), V(-0.135, U.h + 0.05, 0.03), V(-0.09, U.h + 0.068, 0.03), V(0.09, U.h + 0.068, 0.03), V(0.135, U.h + 0.05, 0.03), V(0.135, U.h, 0.03)], 0.01), M.dark, 0, 0, 0, unit)

  const panel = new THREE.Group(); panel.position.set(0, U.h / 2, U.d / 2 + 0.0008); unit.add(panel)
  const art = face(2600, 1040, drawFace); art.set(1); art.tex.anisotropy = 12
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(U.pw, ph), new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.62 })))
  const lcd = (x, y) => { const f = face(840, 380, drawLcd), [a, b] = P(x + 210, y + 95), m = new THREE.Mesh(new THREE.PlaneGeometry(420 * K, 190 * K), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false })); m.position.set(a, b, 0.0006); panel.add(m); return f }
  const lcdA = lcd(284, 410), lcdB = lcd(724, 410)
  const led = (x) => { const [a, b] = P(x, 630), m = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 10), new THREE.MeshBasicMaterial({ color: 0x2d3238, toneMapped: false })); m.position.set(a, b, 0.001); panel.add(m); return m }
  const leds = { A: [led(314), led(394), led(474)], B: [led(754), led(834), led(914)] }

  /* terminals */
  scene.updateMatrixWorld(true)
  const term = (x, c, d) => { const [a, b] = P(x, 736); alongZ(add(cyl(0.0135, 0.008), M.chrome, a, b, 0.004, panel)); alongZ(add(cyl(0.0098, 0.012), stdM(c, 0.35), a, b, 0.008, panel)); alongZ(add(cyl(0.0034, 0.0005, 14), new THREE.MeshBasicMaterial({ color: 0x050505 }), a, b, 0.0143, panel)); if (d) hitBox(new THREE.SphereGeometry(0.02, 10, 8), a, b, 0.014, d, panel); return panel.localToWorld(V(a, b, 0.015)) }
  const tA = term(354, 0xd42b24, 'lead'), tAG = term(494, 0x2e9e43), tAM = term(634, 0x1b1c20, 'lead')
  const tB = term(794, 0xd42b24), tBG = term(934, 0x2e9e43), tBM = term(1074, 0x1b1c20)
  void tAG; void tBG

  /* keys */
  const keys = {}
  const key = (x, y, w, h, label, col, id, fg = '#FFF', d = 0.007) => {
    const [a, b] = P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g)
    add(box(w * K, h * K, d), stdM(col, 0.45, 0.2), 0, 0, d / 2, g)
    const f = face(w * 5, h * 5, keyArt(label, fg)); f.set(1)
    plain(add(new THREE.PlaneGeometry(w * K, h * K), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), 0, 0, d + 0.0004, g))
    hitBox(box(w * K * 1.05, h * K * 1.08, 0.02), 0, 0, 0.012, id, g)
    keys[id] = g; return g
  }
  const GRAY = 0x4c525b, SLATE = 0x455a64
  ;[['7', 1220, 441], ['8', 1282, 441], ['9', 1344, 441], ['4', 1220, 503], ['5', 1282, 503], ['6', 1344, 503], ['1', 1220, 565], ['2', 1282, 565], ['3', 1344, 565], ['0', 1220, 627], ['.', 1282, 627]].forEach(([l, x, y]) => key(x, y, 52, 50, l, GRAY, `key:${l}`))
  key(1344, 627, 52, 50, 'ENT', GRAY, 'key:ent')
  key(1422, 441, 76, 50, 'V-SET', 0x1565c0, 'key:V'); key(1422, 503, 76, 50, 'I-SET', 0xe65100, 'key:I'); key(1422, 565, 76, 50, 'STEP', SLATE, 'key:step'); key(1422, 627, 76, 50, 'CH A/B', SLATE, 'key:ch')
  key(1324, 724, 40, 22, '▲', SLATE, 'up', '#FFF', 0.005); key(1324, 750, 40, 22, '▼', SLATE, 'down', '#FFF', 0.005)
  const outKey = key(1409, 734, 90, 48, 'OUTPUT', 0x2e7d32, 'output'), outMat = outKey.children[0].material

  /* encoder */
  const [ea, eb] = P(1254, 734), enc = new THREE.Group(); enc.position.set(ea, eb, 0); panel.add(enc)
  alongZ(add(cyl(0.0155, 0.004, 40), M.chrome, 0, 0, 0.002, enc)); alongZ(add(cyl(0.0122, 0.016, 34), stdM(0x3a3f47, 0.35, 0.5), 0, 0, 0.011, enc))
  add(new THREE.SphereGeometry(0.0023, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.0084, 0.0192, enc)
  alongZ(hitBox(cyl(0.024, 0.04, 12), 0, 0, 0.012, 'enc', enc))
  /* power rocker */
  const [ra, rb] = P(1454, 362); add(box(0.028, 0.022, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(box(0.012, 0.018, 0.005), stdM(0xd92b20, 0.35), ra - 0.0065, rb, 0.004, panel); hitBox(box(0.05, 0.04, 0.03), ra, rb, 0.01, 'pwr', panel)

  /* rheostat on channel A */
  const R0 = 0.102
  add(box(RH.len + 0.1, 0.012, 0.13), M.dark, RH.x, 0.006, RH.z)
  alongX(add(cyl(0.036, RH.len, 40), M.ceramic, RH.x, R0, RH.z)); alongX(add(new THREE.CylinderGeometry(0.0375, 0.0375, RH.len - 0.018, 40, 1, true), M.coil, RH.x, R0, RH.z))
  ;[-1, 1].forEach((s) => { add(box(0.012, R0 + 0.05, 0.11), M.dark, RH.x + (s * (RH.len + 0.022)) / 2, (R0 + 0.05) / 2 + 0.006, RH.z) })
  alongX(add(cyl(0.0045, RH.len + 0.03, 16), M.chrome, RH.x, R0 + 0.064, RH.z))
  const wiper = new THREE.Group(); wiper.position.set(RH.x, 0, RH.z); scene.add(wiper)
  add(box(0.03, 0.024, 0.026), M.black, 0, R0 + 0.064, 0, wiper); add(box(0.008, 0.03, 0.014), M.brass, 0, R0 + 0.041, 0, wiper)
  add(cyl(0.011, 0.012, 20), stdM(0xd42b24, 0.35), 0, R0 + 0.082, 0, wiper)
  hitBox(box(0.06, 0.09, 0.07), 0, R0 + 0.05, 0, 'load', wiper)
  const tagF = face(340, 110, drawLoadTag), tag = plain(add(new THREE.PlaneGeometry(0.1, 0.032), new THREE.MeshBasicMaterial({ map: tagF.tex, toneMapped: false }), RH.x, 0.0126, RH.z + 0.058)); tag.rotation.x = -Math.PI / 2
  const loadLab = face(620, 80, silk('RHEOSTAT LOAD · 1–100 Ω', 40, '#E8EBEF')); loadLab.set(1); plain(add(new THREE.PlaneGeometry(0.16, 0.03), new THREE.MeshBasicMaterial({ map: loadLab.tex, transparent: true }), RH.x, 0.0126, RH.z - 0.05)).rotation.x = -Math.PI / 2

  /* fixed resistor on channel B */
  const FR = { x: 0.04, z: 0.36 }
  add(box(0.13, 0.042, 0.042), M.ceramic, FR.x, 0.021, FR.z)
  ;[-1, 1].forEach((s) => alongX(add(cyl(0.0024, 0.024, 12), M.brass, FR.x + s * 0.075, 0.022, FR.z)))
  const frT = face(380, 80, silk('4.9 Ω · 50 W', 44, '#2B2F35')); frT.set(1); plain(add(new THREE.PlaneGeometry(0.1, 0.022), new THREE.MeshBasicMaterial({ map: frT.tex, transparent: true }), FR.x, 0.0425, FR.z)).rotation.x = -Math.PI / 2

  /* leads */
  const RED = stdM(0xc7221e, 0.5, 0), BLK = stdM(0x0f1013, 0.55, 0)
  const lift = (p) => p.clone().add(V(0, -0.06, 0.09))
  const endL = V(RH.x + RH.len / 2 + 0.024, 0.1, RH.z), rodEnd = V(RH.x - RH.len / 2 - 0.038, R0 + 0.064, RH.z)
  alongX(add(cyl(0.008, 0.012, 16), stdM(0xd42b24, 0.35), rodEnd.x + 0.008, rodEnd.y, rodEnd.z)); alongX(add(cyl(0.008, 0.012, 16), stdM(0x1b1c20, 0.35), endL.x - 0.006, endL.y, endL.z))
  const redC = new THREE.CatmullRomCurve3([tA, lift(tA), V(-0.05, 0.016, 0.28), V(0.16, 0.03, 0.2), V(rodEnd.x - 0.05, rodEnd.y - 0.06, rodEnd.z + 0.06), rodEnd]), blkC = new THREE.CatmullRomCurve3([tAM, lift(tAM), V(-0.02, 0.012, 0.3), V(0.56, 0.05, 0.26), V(0.6, 0.14, 0.1), endL])
  const leadOn = [add(new THREE.TubeGeometry(redC, 120, 0.0045, 8), RED, 0, 0, 0), add(new THREE.TubeGeometry(blkC, 120, 0.0045, 8), BLK, 0, 0, 0)]
  const leadOff = [add(tubeG([tA, lift(tA), V(tA.x + 0.02, 0.02, tA.z + 0.2), V(tA.x + 0.05, 0.006, tA.z + 0.26)], 0.0045), RED, 0, 0, 0), add(tubeG([tAM, lift(tAM), V(tAM.x + 0.02, 0.02, tAM.z + 0.2), V(tAM.x + 0.05, 0.006, tAM.z + 0.26)], 0.0045), BLK, 0, 0, 0)]
  add(tubeG([tB, lift(tB), V(tB.x + 0.04, 0.03, tB.z + 0.18), V(FR.x - 0.087, 0.022, FR.z)], 0.0036), RED, 0, 0, 0)
  add(tubeG([tBM, lift(tBM), V(tBM.x + 0.02, 0.03, tBM.z + 0.18), V(FR.x + 0.087, 0.022, FR.z)], 0.0036), BLK, 0, 0, 0)
  const eMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, toneMapped: false })
  const beads = Array.from({ length: 22 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 6), eMat); m.userData = { ph: i / 22 }; m.visible = false; scene.add(m); return m })

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.18; orbit.maxDistance = 3; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement, hitP = new THREE.Vector3()
  const railPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(R0 + 0.064))
  const pick = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d) }
  const Q = { v: null, drag: null, last: null, ch: 'A', field: 'V', buf: null, step: 1, msg: '', Vb: 15, Ib: 1.5, down: null }
  const c = (k) => ctl.find((q) => q.k === k)
  const redo = () => { if (Q.last) update(...Q.last) }
  const LIM = { V: [0, 30], I: [0.05, 3] }
  const get = (f) => (Q.ch === 'A' ? (f === 'V' ? Q.v.V : Q.v.Ilim) : f === 'V' ? Q.Vb : Q.Ib)
  const put = (f, x) => {
    const [lo, hi] = LIM[f], val = +clamp(x, lo, hi).toFixed(f === 'V' ? 2 : 3)
    if (Q.ch === 'A') api.set(f === 'V' ? 'V' : 'Ilim', quant(c(f === 'V' ? 'V' : 'Ilim'), val))
    else if (f === 'V') Q.Vb = val; else Q.Ib = val
  }
  const bump = (n) => { if (!n) return; Q.buf = null; Q.msg = ''; put(Q.field, get(Q.field) + n * (Q.field === 'I' ? Math.min(STEPS[Q.step], 0.1) : STEPS[Q.step])); redo() }
  const press = (id) => {
    if (id === 'V' || id === 'I') { Q.field = id; Q.buf = ''; Q.msg = ''; return }
    if (id === 'step') { Q.step = (Q.step + 1) % 3; return }
    if (id === 'ch') { Q.ch = Q.ch === 'A' ? 'B' : 'A'; Q.buf = null; Q.msg = ''; return }
    if (id === 'ent') {
      if (Q.buf === null || Q.buf === '') { Q.buf = null; return }
      const x = parseFloat(Q.buf), [lo, hi] = LIM[Q.field]
      if (!Number.isFinite(x) || x < lo || x > hi) { Q.msg = 'OUT OF RANGE'; Q.buf = null; return }
      put(Q.field, x); Q.buf = null; Q.msg = ''; return
    }
    if (Q.buf === null) Q.buf = ''
    if (id === '.' && Q.buf.includes('.')) return
    if (Q.buf.length < 6) Q.buf += id
    Q.msg = ''
  }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d === 'pwr' || d === 'output' || d === 'lead') { api.set(d === 'pwr' ? 'on' : d, !v[d === 'pwr' ? 'on' : d]); if (keys[d]) { keys[d].position.z = -0.003; Q.down = keys[d] } return }
    if (d === 'up' || d === 'down') { keys[d].position.z = -0.0025; Q.down = keys[d]; if (v.on) bump(d === 'up' ? 1 : -1); return }
    if (d.startsWith('key:')) { keys[d].position.z = -0.004; Q.down = keys[d]; if (v.on) { press(d.slice(4)); redo() } return }
    if (d === 'enc') { Q.drag = { enc: true, x: e.clientX, y: e.clientY, acc: 0 }; return }
    if (d === 'load') Q.drag = { load: true }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : d === 'enc' || d === 'load' ? 'grab' : 'pointer'; return }
    if (s.enc) {
      const mv = (e.clientX - s.x) - (e.clientY - s.y), n = Math.trunc((mv - s.acc) / 10)
      if (n && Q.v.on) { s.acc += n * 10; Q.ang = (Q.ang || 0) - n * 0.18; bump(n) }
    }
    if (s.load) { pick(e); const p = ray.ray.intersectPlane(railPlane, hitP); if (p) { const u = clamp((p.x - (RH.x - RH.len / 2)) / RH.len, 0, 1), q = c('RL'); api.set('RL', quant(q, q.min + u * (q.max - q.min))) } }
  }
  const onUp = () => { if (Q.down) { Q.down.position.z = 0; Q.down = null; draw() } Q.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const fmt = (x, n, w) => x.toFixed(n).padStart(w, '0')
  const screen = (name, active, setV, setI, V2, I2, mode, on) => {
    const editing = active && Q.buf !== null, msg = active && Q.msg
    const line = msg ? Q.msg : editing ? `${Q.field === 'V' ? 'V-SET' : 'I-SET'} > ${Q.buf}_` : `SET ${setV.toFixed(2)} V / ${setI.toFixed(3)} A${active ? ` · ${Q.field === 'V' ? 'V' : 'I'} step ${Q.field === 'I' ? Math.min(STEPS[Q.step], 0.1) : STEPS[Q.step]}` : ''}`
    return { name, dark: !on, active, line, edit: editing || !!msg, mode, V: fmt(V2, 2, 5), A: fmt(I2, 3, 5), W: fmt(V2 * I2, 2, 6) }
  }
  function update(v, o, t) {
    Q.last = [v, o, t]; Q.v = v
    const on = v.on, live = on && v.output
    const mA = !live ? 'OFF' : o.cc ? 'CC' : 'CV'
    const sa = screen('CH A', Q.ch === 'A', v.V, v.Ilim, o.V, o.I, mA, on); lcdA.set(JSON.stringify(sa), sa)
    const Icv = Q.Vb / RB, cc = Icv > Q.Ib, Ib = live ? (cc ? Q.Ib : Icv) : 0, Vb = live ? (cc ? Q.Ib * RB : Q.Vb) : 0
    const sb = screen('CH B', Q.ch === 'B', Q.Vb, Q.Ib, Vb, Ib, !live ? 'OFF' : cc ? 'CC' : 'CV', on); lcdB.set(JSON.stringify(sb), sb)
    const lit = (arr, mode, ocp) => { arr[0].material.color.set(live && mode === 'CV' ? 0x4bff78 : 0x2d3238); arr[1].material.color.set(live && mode === 'CC' ? 0xff9a1f : 0x2d3238); arr[2].material.color.set(ocp ? 0xff3b30 : 0x2d3238) }
    lit(leds.A, mA, live && o.cc && v.Ilim >= 3); lit(leds.B, sb.mode, live && cc && Q.Ib >= 3)
    rocker.position.x = ra + (on ? -0.0065 : 0.0065); outMat.color.set(v.output && on ? 0x2e7d32 : 0x4c525b)
    enc.rotation.z = Q.ang || 0
    wiper.position.x = RH.x - RH.len / 2 + RH.len * ((v.RL - 1) / 99); tagF.set(`${v.RL}`, `${v.RL.toFixed(1)} Ω`)
    leadOn.forEach((m) => { m.visible = v.lead }); leadOff.forEach((m) => { m.visible = !v.lead })
    const flow = o.I > 0.0005
    beads.forEach((m, i) => { m.visible = flow; if (flow) { const u = (m.userData.ph + t * 0.12 * (0.6 + o.I)) % 1, cv = i % 2 ? blkC : redC; cv.getPoint(i % 2 ? 1 - u : u, m.position) } })
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

const LABELS = [['whole', 'Whole kit'], ['front', 'Front panel'], ['keypad', 'Keypad'], ['load', 'Load']]

function make(exp) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({})
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, wrapControls(exp.controls), { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
        </div>
        <p className="stage3d-hint">Press V-SET or I-SET, type a value on the keypad and press the Enter key. The encoder and arrows change the value by the STEP size, and CH A/B picks the channel. Drag the rheostat slider to change the load, click the channel A red or black terminal to unplug the leads, and use POWER and OUTPUT to switch.</p>
      </div>
    )
  }
}

const wrapControls = (cs) => cs.map((c) => (c.k === 'V' ? { ...c, step: 0.01 } : c))
export const psu3D = psuKit.map((e) => ({
  ...e,
  wide: true,
  controls: wrapControls(e.controls),
  state: () => ({ on: true, output: true, lead: true }),
  out: (v, t) => {
    if (!v.on || !v.output) return { I: 0, V: 0, P: 0, cc: false, live: false }
    if (!v.lead) return { I: 0, V: v.V, P: 0, cc: false, live: false }
    return { ...e.out(v, t), live: true }
  },
  read: (v, o) => (o.live ? e.read(v, o) : [['Output', o.V.toFixed(2), 'V'], ['Current', o.I.toFixed(3), 'A'], ['Mode', !v.on || !v.output ? 'Output off' : 'No load', '']]),
  sample: (v, o) => {
    if (!v.on) return { error: 'The supply is off. Press POWER.' }
    if (!v.output) return { error: 'The output is off. Press OUTPUT.' }
    if (!v.lead) return { error: 'The load leads are unplugged. Click a channel A terminal.' }
    return e.sample(v, o)
  },
  Stage: make(e),
}))
