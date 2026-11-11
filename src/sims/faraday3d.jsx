import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { faraday, emf, phi } from './magnetism'
import { tog } from '../lib/math'
import { createStudio, face, quant } from './studio3d'

/* Faraday's law kit as a working 3D model: a magnet falls through a coil, a photogate times it,
   and the voltage sensor and logger capture the EMF pulse. Metres. */

const G = 9.78, TX = -0.3, GATE_Y = 0.32, COIL_Y = 0.2, FOAM_Y = 0.09, H_VIS = 0.8, SLOW = 0.3, WINDOW = 60
const COIL_DIST = (GATE_Y - COIL_Y) / H_VIS
const TIMER = { x: 0.2, z: -0.2, ry: 0, w: 0.3, h: 0.17, d: 0.2, x0: 970, y0: 430, W: 260, H: 130, pw: 0.28 }
const COILS = { 700: 0xe0704a, 900: 0xeaa868, 1150: 0xd85c3e }
const SPARES = [[700, 0.1], [900, 0.24], [1150, 0.6]]
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

function drawTimer(g, W, H) {
  const k = W / TIMER.W, X = (x) => (x - TIMER.x0) * k, Y = (y) => (y - TIMER.y0) * k
  g.fillStyle = '#F4F3EE'; g.fillRect(0, 0, W, H)
  g.fillStyle = '#C43A10'; g.textAlign = 'center'; g.font = `bold ${12 * k}px Arial`; g.fillText('MULTIFUNCTION DIGITAL TIMER', X(1100), Y(447))
  g.fillStyle = '#0C0D10'; g.fillRect(X(978), Y(453), 244 * k, 53 * k)
  g.fillStyle = '#33383F'; g.font = `${8 * k}px Arial`; g.fillText('GATE (RJ11)', X(1054), Y(558)); g.fillText('USB', X(1218), Y(558))
}
function drawLcd(g, w, h, lines) {
  const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, '#B9DE58'); b.addColorStop(1, '#9CC63E'); g.fillStyle = b; g.fillRect(0, 0, w, h)
  g.fillStyle = '#17260A'; g.textAlign = 'left'; g.font = 'bold 40px Consolas, monospace'; lines.forEach((l, i) => g.fillText(l, 18, 50 + i * 52))
}
function drawTrace(g, w, h, s) {
  g.fillStyle = '#081019'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2B3D52'; g.lineWidth = 1
  for (let i = 1; i < 8; i++) { const x = (i * w) / 8; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let i = 1; i < 4; i++) { const y = (i * h) / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) { g.fillStyle = '#FFB0A0'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('Voltage sensor not connected', w / 2, h / 2 + 8); return }
  if (s.ms !== null) {
    g.strokeStyle = '#62C6F2'; g.lineWidth = 3; g.beginPath()
    const stop = Math.min(WINDOW, s.ms), n = 200
    for (let i = 0; i <= n; i++) { const ms = -WINDOW + (i / n) * (stop + WINDOW), E = emf(s.N, s.u, s.u * (ms / 1000)), px = w / 2 + (ms / WINDOW) * (w / 2), py = h / 2 - (E / 3.6) * (h / 2); if (i) g.lineTo(px, py); else g.moveTo(px, py) }
    g.stroke()
  }
  g.fillStyle = '#FFD45E'; g.font = 'bold 22px Arial'; g.textAlign = 'left'
  g.fillText(s.vp !== null ? `peak \u00b1${s.vp.toFixed(2)} V   area ${s.area.toFixed(1)} mV\u00b7s` : 'Waiting for the magnet...', 12, 30)
}
const drawScale = (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#17324C'; g.fillStyle = '#17324C'; g.textAlign = 'right'; g.font = 'bold 30px Arial'
  for (let cm = 0; cm <= 50; cm++) { const y = h - 20 - (cm / 50) * (h - 40), big = cm % 10 === 0, five = cm % 5 === 0; g.lineWidth = big ? 4 : 2; g.beginPath(); g.moveTo(w - 8, y); g.lineTo(w - (big ? 60 : five ? 42 : 26), y); g.stroke(); if (big) g.fillText(String(cm), w - 70, y + 11) }
}
function coilTex(g, w, h) { const b = g.createLinearGradient(0, 0, w, 0); b.addColorStop(0, '#888'); b.addColorStop(0.5, '#fff'); b.addColorStop(1, '#777'); g.fillStyle = b; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,10,0,.32)'; g.lineWidth = 2; for (let y = 0; y < h; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() } }
const tagArt = (a, b) => (g, w, h) => { g.fillStyle = '#FFF'; g.fillRect(0, 0, w, h); g.fillStyle = '#1C1C1C'; g.textAlign = 'center'; g.font = 'bold 42px Arial'; g.fillText(a, w / 2, 56); g.font = '26px Arial'; g.fillText(b, w / 2, 92) }
const board = (a, b, c) => (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = 'bold 30px Arial'; g.fillText(a, w / 2, 48); g.font = '22px Arial'; g.fillText(b, w / 2, 84) }
const label = (t, size, col) => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) }
function drawWood(g, w, h) { g.fillStyle = '#A9794F'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${i % 2 ? '70,40,18' : '205,160,115'},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke() } }

const VIEWS = {
  whole: { p: [0.04, 0.74, 2.26], t: [0.04, 0.36, 0] },
  tube: { p: [-0.22, 0.44, 0.92], t: [TX, 0.33, 0] },
  timer: { p: [0.22, 0.3, 0.42], t: [TIMER.x, 0.09, TIMER.z] },
  coils: { p: [0.22, 0.34, 0.92], t: [0.2, 0.04, 0.32] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xdfe2e5, exposure: 1, env: 0.55, shadow: { left: -1.3, right: 1.3, top: 1.1, bottom: -1, far: 7 } })
  const M = {
    iron: new THREE.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.5, metalness: 0.45 }), black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0f8, transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe8661e, roughness: 0.45 }), orangeLid: new THREE.MeshStandardMaterial({ color: 0xffae5c, roughness: 0.45 }), gate: new THREE.MeshStandardMaterial({ color: 0x1560bd, roughness: 0.45 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const tube = (pts, col, r = 0.003) => { const c = new THREE.CatmullRomCurve3(pts); return add(new THREE.TubeGeometry(c, 70, r, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }), 0, 0, 0) }

  const wood = face(1024, 512, drawWood); wood.set(1); wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(2, 1)
  plain(add(box(4.8, 0.04, 2.6), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.62 }), 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xe0e3e6, roughness: 0.95 }), 0, 1.3, -1.25))

  /* stand and drop tube */
  add(box(0.46, 0.028, 0.24), M.iron, -0.38, 0.014, 0)
  add(cyl(0.009, 0.82, 22), M.chrome, -0.54, 0.42, 0)
  ;[0.74, 0.12].forEach((y) => { add(box(0.034, 0.034, 0.034), M.black, -0.54, y, 0); alongX(add(cyl(0.005, 0.2, 14), M.chrome, -0.43, y, 0)); add(cyl(0.022, 0.028, 26), M.black, TX, y, 0) })
  const glass = plain(add(new THREE.CylinderGeometry(0.0165, 0.0165, 0.72, 32, 1, true), M.glass, TX, 0.41, 0)); glass.renderOrder = 3
  add(cyl(0.014, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0xf0d36a, roughness: 0.85 }), TX, 0.058, 0)
  const scaleF = face(220, 1040, drawScale); scaleF.set(1)
  const scale = plain(add(new THREE.PlaneGeometry(0.0846, 0.4 * 1.0404), new THREE.MeshBasicMaterial({ map: scaleF.tex, transparent: true, depthWrite: false }), TX + 0.056, GATE_Y + 0.2, 0.002)); scale.renderOrder = 4

  /* photogate */
  add(box(0.13, 0.016, 0.1), M.gate, TX, GATE_Y + 0.016, -0.01)
  ;[-1, 1].forEach((sg) => add(box(0.02, 0.05, 0.036), M.gate, TX + sg * 0.058, GATE_Y, 0.0))
  const beam = add(cyl(0.0009, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), TX, GATE_Y, 0); beam.rotation.z = Math.PI / 2; beam.castShadow = false
  add(box(0.034, 0.024, 0.024), M.black, TX + 0.084, GATE_Y, 0)
  hitBox(box(0.05, 0.05, 0.05), TX + 0.086, GATE_Y, 0, 'cG')
  const gf = face(380, 56, label('PHOTOGATE (IR)', 32, '#FFF')); gf.set(1); plain(add(new THREE.PlaneGeometry(0.1, 0.0145), new THREE.MeshBasicMaterial({ map: gf.tex, transparent: true }), TX, GATE_Y + 0.016, 0.0406))

  /* coil on the stand */
  const coilF = face(256, 256, coilTex); coilF.set(1)
  const coilMat = new THREE.MeshStandardMaterial({ map: coilF.tex, roughness: 0.55, metalness: 0.12, color: COILS[900] })
  add(new THREE.CylinderGeometry(0.052, 0.052, 0.14, 48, 1, true), coilMat, TX, COIL_Y, 0)
  ;[0.073, -0.073].forEach((d) => add(cyl(0.06, 0.006, 48), M.black, TX, COIL_Y + d, 0))
  const tagFaces = {}
  ;[700, 900, 1150].forEach((n) => { const swg = n === 700 ? 26 : n === 900 ? 28 : 30; const f = face(240, 110, tagArt(`${n} T`, `SWG ${swg}`)); f.set(1); tagFaces[n] = new THREE.MeshBasicMaterial({ map: f.tex }) })
  const coilTag = plain(add(new THREE.PlaneGeometry(0.052, 0.024), tagFaces[900], TX, COIL_Y, 0.0525))
  scene.updateMatrixWorld(true)
  const coilSock = [[0.009, 0xd92b20], [-0.021, 0x15161a]].map(([dy, c]) => { alongX(add(cyl(0.0095, 0.012, 18), M.chrome, TX + 0.058, COIL_Y + dy, 0)); alongX(add(cyl(0.006, 0.014, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), TX + 0.06, COIL_Y + dy, 0)); return V(TX + 0.067, COIL_Y + dy, 0) })
  hitBox(box(0.05, 0.07, 0.06), TX + 0.066, COIL_Y - 0.006, 0, 'cS')

  /* magnet */
  const mag = new THREE.Group(); mag.position.set(TX, 0.6, 0); scene.add(mag)
  add(cyl(0.0085, 0.026, 22), new THREE.MeshStandardMaterial({ color: 0xc12629, roughness: 0.4, metalness: 0.2 }), 0, 0.013, 0, mag); add(cyl(0.0085, 0.026, 22), new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.32, metalness: 0.75 }), 0, -0.013, 0, mag)
  hitBox(cyl(0.035, 0.1, 12), 0, 0, 0.01, 'mag', mag)

  /* spare coils and magnet */
  SPARES.forEach(([n, x]) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0.36); scene.add(g); g.userData.n = n
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 40, 1, true), new THREE.MeshStandardMaterial({ map: coilF.tex, color: COILS[n], roughness: 0.55, metalness: 0.12 }), 0, 0.045, 0, g)
    add(cyl(0.056, 0.005, 40), M.black, 0, 0.09, 0, g); add(cyl(0.056, 0.005, 40), M.black, 0, 0.0025, 0, g); add(cyl(0.018, 0.006, 24), new THREE.MeshBasicMaterial({ color: 0xd6ebf5 }), 0, 0.094, 0, g)
    plain(add(new THREE.PlaneGeometry(0.056, 0.026), tagFaces[n], 0, 0.046, 0.0505, g))
    hitBox(cyl(0.06, 0.11, 12), 0, 0.05, 0, `N:${n}`, g)
    SPARES[SPARES.findIndex((q) => q[0] === n)][2] = g
  })
  add(cyl(0.0085, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.7, roughness: 0.3 }), 0.74, 0.0085, 0.38).rotation.z = Math.PI / 2

  /* timer */
  const tGroup = new THREE.Group(); tGroup.position.set(TIMER.x, 0, TIMER.z); scene.add(tGroup)
  add(box(TIMER.w, TIMER.h, TIMER.d), M.orange, 0, TIMER.h / 2, 0, tGroup); add(box(TIMER.w * 0.9, 0.01, TIMER.d * 0.82), M.orangeLid, 0, TIMER.h + 0.005, 0, tGroup)
  const panel = new THREE.Group(); panel.position.set(0, TIMER.h / 2, TIMER.d / 2 + 0.0008); tGroup.add(panel)
  const ph = (TIMER.pw * TIMER.H) / TIMER.W, P = (x, y) => [((x - TIMER.x0) / TIMER.W - 0.5) * TIMER.pw, (0.5 - (y - TIMER.y0) / TIMER.H) * ph]
  const af = face(1040, 520, drawTimer); af.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(TIMER.pw, ph), new THREE.MeshStandardMaterial({ map: af.tex, roughness: 0.55 })))
  const lcdF = face(760, 130, drawLcd), [la, lb] = P(1100, 480)
  const lcdM = new THREE.Mesh(new THREE.PlaneGeometry((236 / TIMER.W) * TIMER.pw, (45 / TIMER.H) * ph), new THREE.MeshBasicMaterial({ map: lcdF.tex, toneMapped: false })); lcdM.position.set(la, lb, 0.0006); panel.add(lcdM)
  ;[[1000, '◀', 'prev'], [1060, 'MODE', 'mode'], [1120, '▶', 'next'], [1180, 'RESET', 'reset']].forEach(([x, t, d]) => {
    const [a, b] = P(x, 529), w = 0.046, h = 0.022
    add(box(w, h, 0.005), new THREE.MeshStandardMaterial({ color: 0x33414c, roughness: 0.45 }), a, b, 0.0025, panel)
    const f = face(184, 88, label(t, 34, '#FFF')); f.set(1); plain(add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), a, b, 0.0054, panel))
    hitBox(box(w * 1.1, h * 1.4, 0.02), a, b, 0.008, d, panel)
  })
  const [ga, gb] = P(1000, 553)
  add(box(0.03, 0.016, 0.003), M.black, ga, gb, 0.0016, panel)
  scene.updateMatrixWorld(true)
  const gateIn = panel.localToWorld(V(ga, gb, 0.004))

  /* voltage sensor and logger */
  const pcb = (x, z, w, d, a, b, c, h = 0.022) => { add(box(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }), x, h / 2, z); const f = face(320, 110, board(a, b, `#${c.toString(16).padStart(6, '0')}`)); f.set(1); const m = plain(add(new THREE.PlaneGeometry(w * 0.98, d * 0.98), new THREE.MeshBasicMaterial({ map: f.tex }), x, h + 0.0004, z)); m.rotation.x = -Math.PI / 2 }
  pcb(-0.04, 0.2, 0.13, 0.07, 'VOLTAGE SENSOR', '±2.5 V · >1 MΩ', 0x2e7d32); pcb(0.42, 0.2, 0.16, 0.09, 'DATA LOGGER', '100 kS/s · 800 k', 0x1f3f70, 0.04)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4bff78, toneMapped: false })); led.position.set(0.35, 0.044, 0.165); scene.add(led)

  /* cables */
  const sIn = [V(-0.075, 0.024, 0.2), V(-0.055, 0.024, 0.2)]
  const sensorLeads = coilSock.map((s, i) => ({ on: tube([s, s.clone().add(V(0.05, -0.06 - i * 0.02, 0.03)), V(-0.14, 0.03, 0.17 + i * 0.03), sIn[i]], i ? 0x101114 : 0xc42a26), off: tube([s, s.clone().add(V(0.05, -0.08, 0.04)), V(TX + 0.16 + i * 0.02, 0.012, 0.16), V(TX + 0.24 + i * 0.02, 0.0065, 0.18 + i * 0.02)], i ? 0x101114 : 0xc42a26) }))
  const gs = V(TX + 0.1, GATE_Y, 0)
  const gateOn = tube([gs, V(-0.1, GATE_Y - 0.02, -0.02), V(gateIn.x - 0.1, 0.1, gateIn.z + 0.1), gateIn.clone().add(V(0, 0, 0.002))], 0x9a9fa8)
  const gateOff = tube([gs, V(-0.14, 0.24, 0.02), V(-0.08, 0.05, 0.06), V(-0.02, 0.0065, 0.07)], 0x9a9fa8)
  tube([V(0.025, 0.012, 0.2), V(0.15, 0.02, 0.26), V(0.28, 0.02, 0.26), V(0.34, 0.024, 0.2)], 0x101114)

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3.4; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3(), el = renderer.domElement, facing = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const pick = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d) }
  const Q = { v: null, o: null, drag: null, phase: 'hold', tau: 0, wait: 0, lastT: 0, page: 0, gate: null, drops: 0, gated: false, doneFor: null, trace: null }
  const cH = ctl.find((q) => q.k === 'h')
  const hold = () => { Q.phase = 'hold'; Q.tau = 0; Q.gated = false; Q.wait = 0 }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d.startsWith('N:')) { api.set('N', +d.slice(2)); return }
    if (d === 'cS' || d === 'cG') { api.set(d, !v[d]); return }
    if (d === 'mode' || d === 'next') { Q.page = (Q.page + 1) % 3; return }
    if (d === 'prev') { Q.page = (Q.page + 2) % 3; return }
    if (d === 'reset') { Q.gate = null; Q.drops = 0; return }
    if (d === 'mag') { if (v.rep) { api.set('rep', false); hold(); return } Q.drag = { mag: true, x: e.clientX, y: e.clientY, moved: false } }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : 'pointer'; return }
    if (s.mag && Q.phase === 'hold') {
      if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 5) s.moved = true
      if (s.moved) { pick(e); const p = ray.ray.intersectPlane(facing, hitP); if (p) api.set('h', quant(cH, (p.y - GATE_Y) / H_VIS)) }
    }
  }
  const onUp = () => {
    const s = Q.drag
    if (s?.mag && !s.moved) { if (Q.phase === 'hold') { Q.phase = 'fall'; Q.tau = 0; Q.gated = false; Q.trace = null } else if (Q.phase === 'land') hold() }
    Q.drag = null; orbit.enabled = true
  }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  function update(v, o, t, tc) {
    Q.v = v; Q.o = o
    const dt = Math.max(0, Math.min(0.2, t - Q.lastT)); Q.lastT = t
    const u = o.u, top = GATE_Y + v.h * H_VIS, tG = Math.sqrt((2 * v.h) / G), tC = tG + COIL_DIST / u
    let y = top
    if (Q.phase === 'hold' && v.rep) { Q.wait += dt; if (Q.wait > 0.7) { Q.phase = 'fall'; Q.tau = 0; Q.gated = false; Q.trace = null } }
    if (Q.phase === 'fall') {
      Q.tau += dt * SLOW
      y = top - H_VIS * 0.5 * G * Q.tau * Q.tau
      if (!Q.gated && Q.tau >= tG) { Q.gated = true; Q.drops += 1; if (v.cG) Q.gate = { ms: (0.05 / u) * 1000, u, h: v.h } }
      if (y <= FOAM_Y) { y = FOAM_Y; Q.phase = 'land'; Q.wait = 0 }
    } else if (Q.phase === 'land') { y = FOAM_Y; Q.tau += dt * SLOW; Q.wait += dt; if (v.rep && Q.wait > 0.6) hold() }
    if (Q.phase !== 'hold') {
      /* the logger keeps recording for a moment after the magnet has landed */
      const now = (Q.tau - tC) * 1000, tag = `${v.h}|${v.N}|${Q.drops}`
      if (now > -WINDOW) Q.trace = { ms: now, N: v.N, u }
      if (now > WINDOW && Q.doneFor !== tag && v.cS && v.cG) { Q.doneFor = tag; api.set('done', `${v.h}|${v.N}`) }
    }
    mag.position.y = y
    const b = Math.abs(y - GATE_Y) < 0.03
    beam.material.color.set(b ? 0xffffff : 0xff2a1a)
    coilMat.color.set(COILS[v.N]); coilTag.material = tagFaces[v.N]
    SPARES.forEach((q) => { q[2].visible = q[0] !== v.N })
    sensorLeads.forEach((l) => { l.on.visible = v.cS; l.off.visible = !v.cS }); gateOn.visible = v.cG; gateOff.visible = !v.cG
    let lines
    if (!v.cG) lines = ['NO GATE SIGNAL', 'CHECK RJ11 CABLE']
    else if (!Q.gate) lines = ['t = ---.- ms GATE', 'v = -.-- m/s SPEED']
    else if (Q.page === 0) lines = [`t = ${Q.gate.ms.toFixed(1)} ms GATE`, `v = ${Q.gate.u.toFixed(2)} m/s SPEED`]
    else if (Q.page === 1) lines = [`a = ${((Q.gate.u * Q.gate.u) / (2 * Q.gate.h)).toFixed(2)} m/s2 ACC`, `h = ${Q.gate.h.toFixed(2)} m`]
    else lines = [`DROPS: ${Q.drops}`, 'COUNT MODE']
    lcdF.set(lines.join('|'), lines)
    const tr = Q.trace
    const key = v.cS ? (tr ? `${tr.N}|${tr.u}|${Math.round(tr.ms / 2)}` : 'w') : 'off'
    if (tc && key !== Q.tKey) { Q.tKey = key; drawTrace(tc.getContext('2d'), tc.width, tc.height, v.cS ? { ms: tr ? tr.ms : null, N: tr?.N ?? v.N, u: tr?.u ?? u, vp: tr && tr.ms > 0 ? o.Vp : null, area: v.N * phi(0) * 1000 } : null) }
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

const LABELS = [['whole', 'Whole kit'], ['tube', 'Drop tube'], ['timer', 'Timer'], ['coils', 'Coil set']]

function make(exp) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({}), tr = useRef(null)
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, exp.controls, { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t, tr.current) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
          <div className="trace-view"><canvas ref={tr} width={520} height={260} aria-label="Induced EMF against time" role="img" /><span>Data logger: induced EMF</span></div>
        </div>
        <p className="stage3d-hint">Click the magnet to hold it, drag it up or down to set the height, and click again to drop it. Click a coil on the bench to fit it. Click the coil sockets or the photogate plug to unplug them. Drag the background to look around.</p>
      </div>
    )
  }
}

export const faraday3D = faraday.map((e) => {
  const controls = [...e.controls, tog('rep', 'Repeat drops automatically', true)]
  const c = e.controls.find((q) => q.k === 'h')
  const list = e.sweep.list ? e.sweep.list.map((p) => ({ ...p, rep: true })) : Array.from({ length: e.sweep.n }, (_, i) => ({ h: +(Math.round((c.min + ((c.max - c.min) * i) / (e.sweep.n - 1)) / c.step) * c.step).toFixed(3), rep: true }))
  const live = { ...e, controls }
  return {
    ...e,
    wide: true,
    controls,
    state: () => ({ cS: true, cG: true, done: '' }),
    read: (v, o) => (v.cS && v.cG ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: (v, o) => {
      if (!v.cS) return { error: 'The coil is not connected to the voltage sensor. Click its sockets.' }
      if (!v.cG) return { error: 'The photogate is unplugged. Click its plug.' }
      if (!v.rep && v.done !== `${v.h}|${v.N}`) return { error: 'Drop the magnet at this height with this coil first.' }
      return e.sample(v, o)
    },
    sweep: { list },
    Stage: make(live),
  }
})
