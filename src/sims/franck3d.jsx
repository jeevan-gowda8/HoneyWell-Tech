import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { franckHertz, fh, EX, V0 } from './thermal'
import { createStudio, face, quant } from './studio3d'

/* The Franck-Hertz kit as a working 3D model: unit with a real glass neon tube in its window,
   voltage and current sensors, data logger and power supply. Metres. */

const U = { x: -0.32, z: -0.2, ry: 0.1, w: 0.66, h: 0.27, d: 0.28, x0: 120, y0: 310, W: 840, H: 340, pw: 0.62 }
U.ph = (U.pw * U.H) / U.W
const K = U.pw / U.W
const P = (x, y) => [((x - U.x0) / U.W - 0.5) * U.pw, (0.5 - (y - U.y0) / U.H) * U.ph]
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const rad = (d) => (d * Math.PI) / 180

function drawPanel(g, W, H) {
  const k = W / U.W, X = (x) => (x - U.x0) * k, Y = (y) => (y - U.y0) * k
  const t = (s, x, y, z = 10.5, bold = true, c = '#1F2B3A') => { g.fillStyle = c; g.font = `${bold ? 'bold ' : ''}${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#F2F4F7'); bg.addColorStop(1, '#E3E7EC'); g.fillStyle = bg; g.fillRect(0, 0, W, H)
  t('FRANCK-HERTZ EXPERIMENT · NEON', 540, 340, 20, true, '#1D3F66')
  g.fillStyle = '#0C0D10'; g.fillRect(X(140), Y(360), 300 * k, 150 * k); [[470, 362], [705, 362], [470, 454], [705, 454]].forEach(([a, b]) => g.fillRect(X(a), Y(b), 220 * k, 62 * k))
  t('K', 187, 383, 9, false, '#C9CDD4'); t('G1', 210, 383, 9, false, '#C9CDD4'); t('G2', 370, 383, 9, false, '#C9CDD4'); t('A', 391, 383, 9, false, '#C9CDD4'); t('Ne tube 130 × 26 mm · ignition layers visible', 290, 498, 9.5, false, '#C9CDD4')
  t('0–9 V', 580, 439, 8.5, false); t('0–10 V', 815, 439, 8.5, false); t('0–80 V', 580, 531, 8.5, false); t('1.2–12 V', 815, 531, 8.5, false)
  ;[[180, 'FILAMENT'], [280, 'CONTROL'], [380, 'ACCEL.'], [480, 'COUNTER']].forEach(([x, s]) => t(s, x, 606))
  g.strokeStyle = '#AEB5C1'; g.lineWidth = 2; g.strokeRect(X(560), Y(551), 170 * k, 42 * k); t('MODE', 645, 612)
  t('U_A', 770, 600, 9); t('I_A', 825, 600, 9); t('GND', 880, 600, 9); t('4 mm SAFETY SOCKETS', 825, 622, 8.5, false, '#444')
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' }
function drawRed(g, w, h, text, tag) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#FF6B5E'; g.font = 'bold 22px Arial'; g.textAlign = 'left'; g.fillText(tag, 14, 32)
  g.textAlign = 'right'; g.font = 'bold 30px Arial'; g.fillText('V', w - 14, h - 22)
  if (text === null) return
  const s = 46, step = 78, n = text.replace('.', '').length
  let x = w - 60 - n * step + 26
  g.lineCap = 'round'; g.lineWidth = 9.5
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - 18, 34 + s * 2, 7, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, 34 + p[1] * s); g.lineTo(x + p[2] * s, 34 + p[3] * s); g.stroke() })
    x += step
  })
}
const board = (a, b, c) => (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = 'bold 30px Arial'; g.fillText(a, w / 2, 48); g.font = '22px Arial'; g.fillText(b, w / 2, 84) }
const label = (t, size, col) => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) }
const drawLogger = (g, w, h) => { g.fillStyle = '#26292F'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = 'bold 34px Arial'; g.fillText('DATA LOGGER · 12-bit · 100 ksps', w / 2, 44); g.font = 'bold 24px Arial'; [0, 1, 2, 3].forEach((i) => g.fillText(`CH${i + 1}`, 130 + i * 160, 226)) }
function drawWood(g, w, h) { g.fillStyle = '#A9794F'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${i % 2 ? '70,40,18' : '205,160,115'},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke() } }
function drawTrace(g, w, h, s) {
  g.fillStyle = '#081019'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2B3D52'; g.lineWidth = 1
  for (let i = 1; i < 8; i++) { const x = (i * w) / 8; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let i = 1; i < 4; i++) { const y = (i * h) / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) { g.fillStyle = '#FFB0A0'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('Sensors not connected', w / 2, h / 2 + 8); return }
  const pts = Array.from({ length: 321 }, (_, i) => [i / 4, fh(i / 4, s.Vf, s.Vr)]), top = Math.max(...pts.map((q) => q[1])) * 1.06
  const map = (V, I) => [(V / 80) * w, h - 8 - (I / top) * (h - 16)]
  g.strokeStyle = '#62C6F2'; g.lineWidth = 2.5; g.beginPath()
  pts.forEach(([a, b], i) => { const [x, y] = map(a, b); if (i) g.lineTo(x, y); else g.moveTo(x, y) })
  g.stroke()
  const [x, y] = map(s.V, s.I); g.fillStyle = '#FFD45E'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill()
}

const VIEWS = {
  whole: { p: [0.14, 0.62, 1.9], t: [0.14, 0.17, 0.02] },
  tube: { p: [-0.42, 0.26, 0.3], t: [-0.46, 0.16, -0.06] },
  unit: { p: [-0.26, 0.32, 0.76], t: [U.x, 0.14, U.z] },
  logger: { p: [0.38, 0.38, 0.92], t: [0.34, 0.03, 0.26] },
}

function createScene(host, kind, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xdee1e4, exposure: 1, env: 0.55, shadow: { left: -1.1, right: 1.1, top: 1, bottom: -0.9, far: 7 } })
  const M = {
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }), brass: new THREE.MeshStandardMaterial({ color: 0xe0ba5c, metalness: 0.85, roughness: 0.3 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x29507c, roughness: 0.45, metalness: 0.25 }), lid: new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.45, metalness: 0.25 }), orange: new THREE.MeshStandardMaterial({ color: 0xe8661e, roughness: 0.45 }), orangeLid: new THREE.MeshStandardMaterial({ color: 0xff9a5c, roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe8e4dc, transparent: true, opacity: 0.2, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const tube = (pts, col, r = 0.003) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, r, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }), 0, 0, 0)

  const wood = face(1024, 512, drawWood); wood.set(1); wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(2, 1)
  plain(add(box(4.8, 0.04, 2.6), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.62 }), 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xdfe2e5, roughness: 0.95 }), 0, 1.3, -1.25))

  /* unit */
  const unit = new THREE.Group(); unit.position.set(U.x, 0, U.z); unit.rotation.y = U.ry; scene.add(unit)
  add(box(U.w, U.h, U.d), M.blue, 0, U.h / 2, 0, unit); add(box(U.w * 0.93, 0.012, U.d * 0.86), M.lid, 0, U.h + 0.006, 0, unit)
  const panel = new THREE.Group(); panel.position.set(0, U.h / 2, U.d / 2 + 0.0008); unit.add(panel)
  const af = face(1680, 680, drawPanel); af.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(U.pw, U.ph), new THREE.MeshStandardMaterial({ map: af.tex, roughness: 0.55 })))
  const disp = (x, y) => { const f = face(440, 124, drawRed), [a, b] = P(x + 110, y + 31), m = new THREE.Mesh(new THREE.PlaneGeometry(208 * K, 54 * K), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false })); m.position.set(a, b, 0.0006); panel.add(m); return f }
  const dF = { Vf: disp(470, 362), Vg: disp(705, 362), V: disp(470, 454), Vr: disp(705, 454) }

  /* neon tube in its window */
  const X0 = 170, X1 = 410, [ca, cb] = P(290, 437), r = 22 * K, half = ((X1 - X0) * K) / 2 - r
  const gtube = new THREE.Group(); gtube.position.set(ca, cb, 0.022); panel.add(gtube)
  const g1 = plain(alongX(add(new THREE.CylinderGeometry(r, r, half * 2, 32, 1, true), M.glass, 0, 0, 0, gtube))); g1.renderOrder = 3
  ;[-1, 1].forEach((sg) => { const c = plain(add(new THREE.SphereGeometry(r, 24, 16), M.glass, sg * half, 0, 0, gtube)); c.renderOrder = 3 })
  const px = (x) => (x - 290) * K
  add(box(0.005, r * 1.5, r * 1.1), M.brass, px(187), 0, 0, gtube)
  ;[210, 230, 370].forEach((x) => { for (let i = -2; i <= 2; i++) add(box(0.0012, 0.004, r * 1.2), M.chrome, px(x), i * 0.006, 0, gtube) })
  add(box(0.006, r * 1.5, r * 1.1), M.chrome, px(391), 0, 0, gtube)
  const soft = face(128, 128, (g, w) => { const q = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); q.addColorStop(0, 'rgba(255,190,110,1)'); q.addColorStop(0.45, 'rgba(255,130,40,.8)'); q.addColorStop(1, 'rgba(255,110,30,0)'); g.clearRect(0, 0, w, w); g.fillStyle = q; g.fillRect(0, 0, w, w) }); soft.set(1)
  const glows = Array.from({ length: 5 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(0.05, 0.05, 1); s.visible = false; gtube.add(s); return s })
  const eMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff })
  const electrons = Array.from({ length: 16 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 8, 6), eMat); m.userData = { ph: i / 16, y: Math.sin(i * 2.4) * r * 0.5, z: Math.cos(i * 1.7) * r * 0.5 }; m.visible = false; gtube.add(m); return m })
  const hotK = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a30 })); hotK.position.set(px(187) + 0.003, 0, r * 0.3); gtube.add(hotK)

  const knob = (x, y, name) => { const [a, b] = P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g); alongZ(add(cyl(0.0225, 0.002, 34), M.chrome, 0, 0, 0.001, g)); alongZ(add(cyl(0.017, 0.016, 30), M.black, 0, 0, 0.009, g)); add(box(0.0024, 0.014, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.01, 0.0175, g); alongZ(hitBox(cyl(0.03, 0.04, 12), 0, 0, 0.012, name, g)); return g }
  const kn = { Vf: knob(180, 570, 'Vf'), Vg: knob(280, 570, 'Vg'), V: knob(380, 570, 'V'), Vr: knob(480, 570, 'Vr') }
  const keys = [[605, 'MANUAL', 'manual'], [687, 'DATA LOG', 'log']].map(([x, t, m]) => { const [a, b] = P(x, 572), w = 0.055, h = 0.023, mat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.45 }); add(box(w, h, 0.005), mat, a, b, 0.0025, panel); const f = face(220, 92, label(t, 28, '#26303C')); f.set(1); plain(add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), a, b, 0.0054, panel)); hitBox(box(w * 1.05, h * 1.4, 0.02), a, b, 0.008, `mode:${m}`, panel); return { mat, m } })
  scene.updateMatrixWorld(true)
  const sock = (x, y, c, d) => { const [a, b] = P(x, y); alongZ(add(cyl(0.0115, 0.004, 22), M.chrome, a, b, 0.002, panel)); alongZ(add(cyl(0.0075, 0.006, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), a, b, 0.004, panel)); if (d) hitBox(new THREE.SphereGeometry(0.018, 10, 8), a, b, 0.012, d, panel); return panel.localToWorld(V(a, b, 0.008)) }
  const sU = sock(770, 570, 0xe8c53a, 'cS'), sI = sock(825, 570, 0xe8c53a, 'cS'), sG = sock(880, 570, 0x15161a)

  /* sensors */
  const pcb = (x, z, a, b, c) => { add(box(0.15, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }), x, 0.015, z); const f = face(320, 170, board(a, b, `#${c.toString(16).padStart(6, '0')}`)); f.set(1); const m = plain(add(new THREE.PlaneGeometry(0.148, 0.078), new THREE.MeshBasicMaterial({ map: f.tex }), x, 0.0304, z)); m.rotation.x = -Math.PI / 2 }
  pcb(-0.22, 0.22, 'VOLTAGE SENSOR', '±10 V · auto-ID', 0x1565c0); pcb(0.02, 0.22, 'CURRENT SENSOR', '±100 nA · auto-ID', 0x6a1b9a)

  /* logger and supply */
  const LOG = { x: 0.42, z: 0.26, w: 0.34, h: 0.08, d: 0.18 }
  const lg = new THREE.Group(); lg.position.set(LOG.x, 0, LOG.z); scene.add(lg)
  add(box(LOG.w, LOG.h, LOG.d), M.orange, 0, LOG.h / 2, 0, lg); add(box(LOG.w * 0.9, 0.008, LOG.d * 0.8), M.orangeLid, 0, LOG.h + 0.004, 0, lg)
  const lp = new THREE.Group(); lp.position.set(0, LOG.h / 2, LOG.d / 2 + 0.0008); lg.add(lp)
  const lf = face(800, 270, drawLogger); lf.set(1); lp.add(new THREE.Mesh(new THREE.PlaneGeometry(LOG.w * 0.94, LOG.h * 0.86), new THREE.MeshStandardMaterial({ map: lf.tex, roughness: 0.55 })))
  scene.updateMatrixWorld(true)
  const ch = [0, 1, 2, 3].map((i) => { const x = ((130 + i * 160) / 800 - 0.5) * LOG.w * 0.94; alongZ(add(cyl(0.0105, 0.004, 20), M.chrome, x, 0.002, 0.002, lp)); alongZ(add(cyl(0.007, 0.006, 16), M.black, x, 0.002, 0.004, lp)); if (i < 2) hitBox(new THREE.SphereGeometry(0.018, 10, 8), x, 0.002, 0.012, 'cL', lp); return lp.localToWorld(V(x, 0.002, 0.008)) })
  const chLeds = [0, 1, 2, 3].map((i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3a3a3a, toneMapped: false })); m.position.set(((168 + i * 160) / 800 - 0.5) * LOG.w * 0.94, 0.014, 0.001); lp.add(m); return m })
  add(box(0.16, 0.05, 0.11), new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.5 }), 0.74, 0.025, 0.26)
  const pf = face(320, 170, board('POWER SUPPLY', '220 V AC → ±12 V', '#2A3440')); pf.set(1); plain(add(new THREE.PlaneGeometry(0.158, 0.09), new THREE.MeshBasicMaterial({ map: pf.tex }), 0.74, 0.0504, 0.26)).rotation.x = -Math.PI / 2
  const psLed = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 10), new THREE.MeshBasicMaterial({ color: 0x4bff78, toneMapped: false })); psLed.position.set(0.68, 0.053, 0.29); scene.add(psLed)
  hitBox(box(0.17, 0.08, 0.12), 0.74, 0.03, 0.26, 'pwr')

  /* cables */
  const sV1 = V(-0.22, 0.03, 0.19), sI1 = V(0.02, 0.03, 0.19), s = (x) => V(x, 0.03, 0.26)
  const cS = [[sU, sV1], [sI, sI1]].map(([a, b]) => ({ on: tube([a, a.clone().add(V(0, -0.05, 0.1)), V((a.x + b.x) / 2, 0.08, (a.z + b.z) / 2 + 0.03), b], 0xf5a623), off: tube([a, a.clone().add(V(0, -0.05, 0.1)), V(a.x + 0.02, 0.03, a.z + 0.2), V(a.x + 0.04, 0.0065, a.z + 0.22)], 0xf5a623) }))
  const cL = [[s(-0.22), ch[0]], [s(0.02), ch[1]]].map(([a, b]) => { const c = b.clone().add(V(0, -0.02, 0.09)); return { on: tube([a.clone().setZ(0.255), V(a.x + 0.02, 0.08, 0.38), V((a.x + b.x) / 2, 0.05, 0.46), c, b], 0x101114), off: tube([b, c, V(b.x, 0.012, 0.5), V(b.x + 0.02, 0.0065, 0.54)], 0x101114) } })
  tube([sG, sG.clone().add(V(0, -0.05, 0.1)), V(0.2, 0.17, 0.05), V(LOG.x + 0.14, 0.12, LOG.z + 0.02), V(LOG.x + 0.15, 0.052, LOG.z + 0.09)], 0xc42a26)
  tube([V(0.59, 0.04, 0.26), V(0.62, 0.012, 0.32), V(0.66, 0.02, 0.36), V(0.7, 0.05, 0.3)], 0x101114)

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.14; orbit.maxDistance = 3; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement
  const pick = (e) => { const r2 = el.getBoundingClientRect(); ndc.set(((e.clientX - r2.left) / r2.width) * 2 - 1, -((e.clientY - r2.top) / r2.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d) }
  const Q = { v: null, drag: null, Vg: 9, trace: null }
  const c = (k) => ctl.find((q) => q.k === k)
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d.startsWith('mode:')) { api.set('mode', d.slice(5)); return }
    if (d === 'pwr' || d === 'cS' || d === 'cL') { api.set(d, !v[d]); return }
    Q.drag = { d, x: e.clientX, y: e.clientY, val: d === 'Vg' ? Q.Vg : v[d] }
  }
  const onMove = (e) => {
    const s2 = Q.drag
    if (!s2) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : ['Vf', 'Vg', 'V', 'Vr'].includes(d) ? 'grab' : 'pointer'; return }
    if (s2.none) return
    const mv = ((e.clientX - s2.x) - (e.clientY - s2.y)) * (e.shiftKey ? 0.1 : 1)
    if (s2.d === 'Vg') Q.Vg = clamp(s2.val + (mv / 240) * 10, 0, 10)
    else { const q = c(s2.d); api.set(s2.d, quant(q, s2.val + (mv / 240) * (q.max - q.min))) }
  }
  const onUp = () => { Q.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const ang = (u) => rad(135 - clamp(u, 0, 1) * 270), un = (k, x) => { const q = c(k); return (x - q.min) / (q.max - q.min) }
  function update(v, o, t, tc) {
    Q.v = v
    const on = v.pwr
    dF.Vf.set(`${v.Vf}${on}`, on ? v.Vf.toFixed(2) : null, 'FILAMENT'); dF.Vg.set(`${Q.Vg.toFixed(2)}${on}`, on ? Q.Vg.toFixed(2) : null, 'CONTROL G1'); dF.V.set(`${v.V}${on}`, on ? v.V.toFixed(1) : null, 'ACCEL. G2'); dF.Vr.set(`${v.Vr}${on}`, on ? v.Vr.toFixed(2) : null, 'COUNTER')
    kn.Vf.rotation.z = ang(un('Vf', v.Vf)); kn.Vg.rotation.z = ang(Q.Vg / 10); kn.V.rotation.z = ang(un('V', v.V)); kn.Vr.rotation.z = ang(un('Vr', v.Vr))
    keys.forEach((q) => q.mat.color.set(v.mode === q.m ? 0x1565c0 : 0xdfe3e8))
    psLed.material.color.set(on ? 0x4bff78 : 0x0f3a1c); hotK.visible = on
    const bands = on ? Math.max(0, Math.floor((v.V - V0) / EX + 0.25)) : 0
    glows.forEach((s2, i) => {
      s2.visible = i < bands
      if (s2.visible) { s2.position.set(px(210) + ((i + 1) / (bands + 0.4)) * (px(370) - px(210)), 0, 0); s2.material.opacity = clamp(0.55 + (v.Vf - 6) * 0.15, 0.3, 1) }
    })
    electrons.forEach((m) => {
      m.visible = on && v.V > V0
      if (m.visible) { const u = (m.userData.ph + t * (0.3 + v.V * 0.02)) % 1; m.position.set(px(190) + u * (px(388) - px(190)), m.userData.y, m.userData.z) }
    })
    cS.forEach((q) => { q.on.visible = v.cS; q.off.visible = !v.cS }); cL.forEach((q) => { q.on.visible = v.cL; q.off.visible = !v.cL })
    chLeds.forEach((l, i) => l.material.color.set(on && v.cL && i < 2 ? 0x4bff78 : 0x3a3a3a))
    const live = on && v.cS && v.cL
    const key = live ? `${v.Vf}|${v.Vr}|${v.V}` : 'off'
    if (tc && key !== Q.trace) { Q.trace = key; drawTrace(tc.getContext('2d'), tc.width, tc.height, live ? { Vf: v.Vf, Vr: v.Vr, V: v.V, I: o.I } : null) }
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

const LABELS = [['whole', 'Whole kit'], ['tube', 'Neon tube'], ['unit', 'Control unit'], ['logger', 'Sensors and logger']]

function make(exp, kind) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({}), tr = useRef(null)
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, kind, exp.controls, { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t, tr.current) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
          <div className="trace-view"><canvas ref={tr} width={520} height={260} aria-label="Plate current against accelerating voltage" role="img" /><span>Data logger: I_A against U_A</span></div>
        </div>
        <p className="stage3d-hint">Turn ACCEL. and watch new glow layers appear in the tube. Hold Shift while dragging for fine steps. Press MODE, click the U_A, I_A or logger sockets to unplug, and click the power supply to switch off. Drag the background to look around.</p>
      </div>
    )
  }
}

export const franck3D = franckHertz.map((e) => {
  const kind = e.id === 'manual-curve' ? 'manual' : 'log'
  return {
    ...e,
    wide: true,
    state: () => ({ pwr: true, cS: true, cL: true, mode: kind }),
    out: (v, t) => (v.pwr ? e.out(v, t) : { I: 0 }),
    read: (v, o) => (v.pwr && v.cS && v.cL ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: (v, o) => {
      if (!v.pwr) return { error: 'The power supply is off. Click it to switch it on.' }
      if (v.mode !== kind) return { error: `Set MODE to ${kind === 'manual' ? 'MANUAL' : 'DATA LOG'} first.` }
      if (!v.cS) return { error: 'The sensors are unplugged from U_A and I_A. Click either socket.' }
      if (!v.cL) return { error: 'The sensors are unplugged from the logger. Click CH1 or CH2.' }
      return e.sample(v, o)
    },
    Stage: make(e, kind),
  }
})
