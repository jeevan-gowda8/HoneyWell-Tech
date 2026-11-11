import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { angstrom } from './thermal'
import { createStudio, face, quant } from './studio3d'

/* Angstrom's kit as a working 3D model: lagged copper rod with heater and four thermocouples,
   heater supply and 4-channel thermometer. Metres; the rod is drawn at twice true length. */

const K = 0.00095, S = 2.5, SHELF = 0.12, INST_Z = -0.42, ROD_Y = 0.17, ROD_Z = 0.08, X0 = -0.4, MM = 0.002
const INST = { heat: { x0: 119, y0: 339, W: 452, H: 232, wx: -0.52 }, therm: { x0: 1159, y0: 339, W: 522, H: 232, wx: 0.5 } }
const TIME_RATE = 24, COLS = [0xe53935, 0xfb8c00, 0x43a047, 0x1e88e5]
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

const art = (c, paint) => (g, w, h) => {
  g.fillStyle = '#F1F3F6'; g.fillRect(0, 0, w, h)
  const X = (x) => (x - c.x0) * S, Y = (y) => (y - c.y0) * S
  paint((t, x, y, s = 10, bold = true, col = '#1F2B3A') => { g.fillStyle = col; g.font = `${bold ? 'bold ' : ''}${s * S}px Arial`; g.textAlign = 'center'; g.fillText(t, X(x), Y(y)) }, (a, b, c2, d) => { g.fillStyle = '#0C0D10'; g.fillRect(X(a), Y(b), (c2 - a) * S, (d - b) * S) }, g, X, Y)
}
const paintHeat = (t, well) => { t('HEATER POWER SUPPLY', 345, 364, 14, true, '#5A1416'); t('periodic heating · ON / OFF cycle', 345, 382, 9, false, '#555'); well(138, 396, 328, 462); well(350, 396, 540, 462); t('HALF-PERIOD TIMER', 233, 479, 9.5); t('HEATER POWER', 445, 479, 9.5); t('POWER', 170, 554); t('PERIOD', 250, 554); t('HEAT ON', 320, 546, 9.5); t('TO HEATER', 415, 556, 9) }
const paintTherm = (t, well, g, X, Y) => {
  t('4-CHANNEL DIGITAL THERMOMETER', 1420, 364, 14, true, '#1D3F66')
  ;[0, 1, 2, 3].forEach((i) => {
    const cx = 1233 + i * 124, c = `#${COLS[i].toString(16).padStart(6, '0')}`
    well(cx - 57, 382, cx + 57, 446)
    g.fillStyle = c; g.fillRect(X(cx - 17), Y(455), 34 * S, 15 * S); t(`T${i + 1}`, cx, 467, 10, true, '#FFF')
    t(`TC ${i + 1} (K)`, cx, 533, 8.5)
  })
  t('THERMOCOUPLE INPUTS · INBUILT POWER SUPPLY', 1298, 561, 8.5, false, '#444')
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '-': 'g' }
function drawRed(g, w, h, text, unit) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  if (text === null) return
  const s = 0.3 * h, step = s * 1.72, n = [...text].filter((c) => c !== '.' && c !== ':').length, top = h * 0.17
  let x = w - w * 0.17 - n * step + step * 0.3
  g.lineCap = 'round'; g.lineWidth = s * 0.2
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - step * 0.22, top + s * 2, s * 0.12, 0, 7); g.fill(); return }
    if (ch === ':') { g.fillStyle = '#FF3B30'; [0.6, 1.4].forEach((q) => { g.beginPath(); g.arc(x - step * 0.2, top + s * q, s * 0.12, 0, 7); g.fill() }); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, top + p[1] * s); g.lineTo(x + p[2] * s, top + p[3] * s); g.stroke() })
    x += step
  })
  g.fillStyle = '#FF6B5E'; g.font = `bold ${h * 0.16}px Arial`; g.textAlign = 'right'; g.fillText(unit, w - 8, h - h * 0.14)
}
function drawBoard(g, w, h) {
  g.fillStyle = '#7A5A3A'; g.fillRect(0, 0, w, h); g.strokeStyle = '#EFE3CF'; g.fillStyle = '#EFE3CF'; g.textAlign = 'center'; g.font = 'bold 26px Arial'
  for (let mm = 0; mm <= 400; mm += 10) { const x = 60 + (mm / 400) * (w - 120), big = mm % 80 === 0; g.lineWidth = big ? 3 : 1.4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, big ? 34 : mm % 50 === 0 ? 26 : 16); g.stroke(); if (big) g.fillText(String(mm), x, 68) }
}
const label = (t, size, col) => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) }

const VIEWS = {
  whole: { p: [0, 0.66, 1.72], t: [0, 0.18, -0.04] },
  rod: { p: [0.02, 0.34, 0.86], t: [0.02, 0.15, 0.08] },
  heater: { p: [-0.4, 0.3, 0.46], t: [-0.42, 0.17, 0.08] },
  heat: { p: [-0.52, 0.72, 0.16], t: [INST.heat.wx, 0.24, INST_Z] },
  therm: { p: [0.5, 0.74, 0.2], t: [INST.therm.wx, 0.24, INST_Z] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xe2e0db, exposure: 1, env: 0.55, shadow: { left: -1.2, right: 1.2, top: 1, bottom: -1, far: 7 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.74 }), shelf: new THREE.MeshStandardMaterial({ color: 0x4e565f, roughness: 0.65 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    red: new THREE.MeshStandardMaterial({ color: 0x7e2226, roughness: 0.45, metalness: 0.25 }), redLid: new THREE.MeshStandardMaterial({ color: 0xb24448, roughness: 0.45, metalness: 0.2 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x29507c, roughness: 0.45, metalness: 0.25 }), blueLid: new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.45, metalness: 0.25 }),
    lag: new THREE.MeshStandardMaterial({ color: 0xd8cfb4, roughness: 0.82, side: THREE.DoubleSide }), lagIn: new THREE.MeshStandardMaterial({ color: 0x6e624e, roughness: 0.9, side: THREE.DoubleSide }), wood: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7 }),
    beige: new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.5 }), hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)

  plain(add(box(4.6, 0.04, 2.6), M.table, 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xe3e1dc, roughness: 0.95 }), 0, 1.3, -1.25))
  add(box(1.8, SHELF, 0.32), M.shelf, 0, SHELF / 2, INST_Z)

  const instrument = (c, body, lid, paint) => {
    const g = new THREE.Group(); g.position.set(c.wx, SHELF, INST_Z); scene.add(g)
    const w = c.W * K, h = c.H * K
    add(box(w + 0.02, h + 0.024, 0.2), body, 0, (h + 0.024) / 2, 0, g); add(box((w + 0.02) * 0.94, 0.012, 0.18), lid, 0, h + 0.03, 0, g)
    const panel = new THREE.Group(); panel.position.set(0, (h + 0.024) / 2, 0.101); g.add(panel)
    const f = face(c.W * S, c.H * S, art(c, paint)); f.set(1)
    panel.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.55 })))
    return { panel, P: (x, y) => [(x - (c.x0 + c.W / 2)) * K, ((c.y0 + c.H / 2) - y) * K] }
  }
  const H = instrument(INST.heat, M.red, M.redLid, paintHeat), T = instrument(INST.therm, M.blue, M.blueLid, paintTherm)
  const screen = (I, x1, y1, x2, y2, tw, th) => { const f = face(tw, th, drawRed), [a, b] = I.P((x1 + x2) / 2, (y1 + y2) / 2), m = new THREE.Mesh(new THREE.PlaneGeometry((x2 - x1) * K, (y2 - y1) * K), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false })); m.position.set(a, b, 0.0006); I.panel.add(m); return f }
  const timerF = screen(H, 144, 401, 322, 457, 480, 150), wattF = screen(H, 356, 401, 534, 457, 480, 150)
  const tF = [0, 1, 2, 3].map((i) => { const cx = 1233 + i * 124; return screen(T, cx - 53, 386, cx + 53, 442, 320, 170) })
  const knob = (I, x, y, name, r = 0.018) => { const [a, b] = I.P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); I.panel.add(g); alongZ(add(cyl(r * 1.32, 0.002, 32), M.chrome, 0, 0, 0.001, g)); alongZ(add(cyl(r, 0.016, 28), M.black, 0, 0, 0.009, g)); add(box(0.0022, r * 0.8, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.55, 0.0175, g); alongZ(hitBox(cyl(r * 1.6, 0.04, 12), 0, 0, 0.012, name, g)); return g }
  const rocker = (I, x, y, name) => { const [a, b] = I.P(x, y); add(box(0.042, 0.03, 0.003), M.black, a, b, 0.0015, I.panel); const m = add(box(0.019, 0.024, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), a - 0.01, b, 0.004, I.panel); hitBox(box(0.06, 0.05, 0.03), a, b, 0.01, name, I.panel); return { m, a } }
  const kP = knob(H, 170, 520, 'w'), kT = knob(H, 250, 520, 'P'), rH = rocker(H, 522, 518, 'pwr'), rT = rocker(T, 1642, 551, 'tOn')
  const [la, lb] = H.P(320, 516), heatLed = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 14, 10), new THREE.MeshBasicMaterial({ color: 0x5a2410, toneMapped: false })); heatLed.position.set(la, lb, 0.001); H.panel.add(heatLed)
  scene.updateMatrixWorld(true)
  const sock = (I, x, y, c) => { const [a, b] = I.P(x, y); alongZ(add(cyl(0.012, 0.004, 22), M.chrome, a, b, 0.002, I.panel)); alongZ(add(cyl(0.0078, 0.006, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), a, b, 0.004, I.panel)); return I.panel.localToWorld(V(a, b, 0.01)) }
  const hR = sock(H, 390, 520, 0xd92b20), hB = sock(H, 440, 520, 0x15161a)
  const tcEnds = [0, 1, 2, 3].map((i) => {
    const [a, b] = T.P(1233 + i * 124, 503)
    add(box(0.046, 0.025, 0.008), M.beige, a, b, 0.004, T.panel); add(box(0.009, 0.012, 0.002), M.chrome, a - 0.011, b, 0.0088, T.panel); add(box(0.009, 0.012, 0.002), M.chrome, a + 0.011, b, 0.0088, T.panel)
    hitBox(box(0.06, 0.04, 0.03), a, b, 0.012, `tc:${i}`, T.panel)
    return T.panel.localToWorld(V(a, b - 0.012, 0.01))
  })

  /* rod, lagging and board */
  add(box(1.28, 0.03, 0.16), M.wood, 0.02, 0.015, ROD_Z)
  const board = face(1800, 100, drawBoard); board.set(1)
  plain(add(new THREE.PlaneGeometry(1.0, 0.03), new THREE.MeshStandardMaterial({ map: board.tex, roughness: 0.7 }), 0, 0.016, ROD_Z + 0.0806))
  ;[-0.36, 0.42].forEach((x) => { add(cyl(0.012, 0.11, 20), M.chrome, x, 0.085, ROD_Z); })
  const rodC = document.createElement('canvas'); rodC.width = 8; rodC.height = 128
  const rodT = new THREE.CanvasTexture(rodC); rodT.colorSpace = THREE.SRGBColorSpace
  alongX(add(cyl(0.0185, 0.92, 40), new THREE.MeshStandardMaterial({ map: rodT, metalness: 0.45, roughness: 0.35 }), 0.02, ROD_Y, ROD_Z))
  const LR = 0.052, LL = 0.8
  const half = (r, m) => { const c = plain(add(new THREE.CylinderGeometry(r, r, LL, 48, 1, true, Math.PI / 2, Math.PI), m, 0.02, ROD_Y, ROD_Z)); c.rotation.z = Math.PI / 2; return c }
  half(LR, M.lag); half(LR - 0.008, M.lagIn)
  ;[-0.38, 0.42].forEach((x) => alongX(add(cyl(LR + 0.002, 0.016, 48), M.lag, x, ROD_Y, ROD_Z)))

  /* heater */
  alongX(add(cyl(0.036, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x7c828c, metalness: 0.7, roughness: 0.4 }), -0.5, ROD_Y, ROD_Z))
  for (let i = 0; i < 6; i++) alongX(add(cyl(0.0385, 0.005, 32), M.black, -0.54 + i * 0.016, ROD_Y, ROD_Z))
  const glowF = face(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,120,50,.85)'); r.addColorStop(1, 'rgba(255,90,30,0)'); g.clearRect(0, 0, w, w); g.fillStyle = r; g.fillRect(0, 0, w, w) }); glowF.set(1)
  const heaterGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowF.tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); heaterGlow.scale.setScalar(0.17); heaterGlow.position.set(-0.45, ROD_Y, ROD_Z + 0.03); scene.add(heaterGlow)
  const sg = face(240, 60, label('HEATER', 40, '#E9EBEF')); sg.set(1); plain(add(new THREE.PlaneGeometry(0.08, 0.02), new THREE.MeshBasicMaterial({ map: sg.tex, transparent: true }), -0.5, 0.11, ROD_Z + 0.04))

  /* thermocouples */
  const tags = [0, 1, 2, 3].map((i) => {
    const x = X0 + (i + 1) * 80 * MM
    add(cyl(0.005, 0.06, 12), M.beige, x, ROD_Y + 0.04, ROD_Z)
    const tag = add(box(0.036, 0.018, 0.012), new THREE.MeshStandardMaterial({ color: COLS[i], roughness: 0.4 }), x, ROD_Y + 0.078, ROD_Z)
    const f = face(150, 76, label(`T${i + 1}`, 52, '#FFF')); f.set(1); plain(add(new THREE.PlaneGeometry(0.036, 0.018), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), x, ROD_Y + 0.078, ROD_Z + 0.0065))
    hitBox(box(0.06, 0.05, 0.04), x, ROD_Y + 0.08, ROD_Z, `sep:${i}`)
    return { tag, top: V(x, ROD_Y + 0.088, ROD_Z) }
  })
  const select = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0024, 8, 30), new THREE.MeshBasicMaterial({ color: 0xffffff })); select.position.y = ROD_Y + 0.078; select.position.z = ROD_Z + 0.008; scene.add(select)
  const ring0 = select.clone(); ring0.position.x = tags[0].top.x; scene.add(ring0)

  const tube = (pts, col, r = 0.003) => { const c = new THREE.CatmullRomCurve3(pts); return add(new THREE.TubeGeometry(c, 70, r, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }), 0, 0, 0) }
  const hE = V(-0.5, ROD_Y + 0.036, ROD_Z)
  tube([hR, hR.clone().add(V(0, -0.08, 0.1)), V(-0.56, 0.22, -0.12), hE.clone().add(V(-0.02, 0, 0))], 0xc22a26); tube([hB, hB.clone().add(V(0, -0.09, 0.1)), V(-0.5, 0.23, -0.12), hE.clone().add(V(0.02, 0, 0))], 0x101114)
  const leads = tags.map((q, i) => {
    const s = tcEnds[i], on = tube([q.top, q.top.clone().add(V(0, 0.05, -0.02)), V((q.top.x + s.x) / 2, 0.16 + i * 0.008, -0.17), s.clone().add(V(0, -0.045, 0.08)), s], COLS[i])
    const off = tube([q.top, q.top.clone().add(V(0, 0.05, -0.02)), V(q.top.x + 0.05, 0.08, -0.12), V(q.top.x + 0.08, 0.0065, -0.1)], COLS[i])
    return { on, off }
  })

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement
  const pick = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d) }
  const Q = { v: null, drag: null }
  const cP = ctl.find((q) => q.k === 'P')
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d.startsWith('tc:')) { const i = +d.slice(3), c = v.tc.slice(); c[i] = !c[i]; api.set('tc', c); return }
    if (d.startsWith('sep:')) { const i = +d.slice(4); if (i > 0) api.set('sep', i * 80); return }
    if (d === 'pwr' || d === 'tOn') { api.set(d, !v[d]); return }
    Q.drag = { d, x: e.clientX, y: e.clientY, w: v.w, P: v.P }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : d === 'w' || d === 'P' ? 'grab' : 'pointer'; return }
    if (s.none) return
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (s.d === 'w') api.set('w', Math.round(clamp(s.w + (mv / 240) * 43, 5, 48)))
    if (s.d === 'P') api.set('P', quant(cP, s.P + (mv / 240) * (cP.max - cP.min)))
  }
  const onUp = () => { Q.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const tempAt = (v, o, xm, tm) => {
    if (!v.pwr) return 28
    const scale = v.w / 24
    return 28 + scale * (50 * Math.exp(-5.9 * xm) + 8 * Math.exp(-o.a * xm) * Math.sin(o.w * tm - o.b * xm))
  }
  const ang = (u) => rad(135 - clamp(u, 0, 1) * 270)
  function update(v, o, t) {
    Q.v = v
    const tm = t * TIME_RATE, phase = (o.w * tm) % (Math.PI * 2), on = v.pwr && phase < Math.PI
    const remain = v.pwr ? Math.max(0, v.P / 2 - (tm % (v.P / 2))) : 0
    const mm = String(Math.floor(remain / 60)).padStart(2, '0'), ss = String(Math.floor(remain % 60)).padStart(2, '0')
    timerF.set(`${v.pwr}${mm}${ss}`, v.pwr ? `${mm}:${ss}` : null, 'min')
    wattF.set(`${v.pwr}${v.w}`, v.pwr ? v.w.toFixed(1) : null, 'W')
    tF.forEach((f, i) => {
      const text = !v.tOn ? null : v.tc[i] ? tempAt(v, o, 0.08 * (i + 1), tm).toFixed(1) : '---'
      f.set(`${text}`, text, '°C')
    })
    const g = rodC.getContext('2d')
    for (let y = 0; y < 128; y++) {
      const xm = Math.max(0, ((y / 127) * 0.92 - 0.06) * 0.5), T0 = tempAt(v, o, xm, tm), u = clamp((T0 - 28) / 55, 0, 1)
      g.fillStyle = `rgb(${Math.round(176 + 79 * u)},${Math.round(100 + 75 * u)},${Math.round(52 + 52 * u)})`; g.fillRect(0, y, 8, 1)
    }
    rodT.needsUpdate = true
    heaterGlow.material.opacity = on ? 0.35 * (v.w / 24) : 0
    heatLed.material.color.set(on ? 0xff6a3a : 0x5a2410)
    rH.m.position.x = rH.a + (v.pwr ? -0.01 : 0.01); rT.m.position.x = rT.a + (v.tOn ? -0.01 : 0.01)
    kP.rotation.z = ang((v.w - 5) / 43); kT.rotation.z = ang((v.P - cP.min) / (cP.max - cP.min))
    select.position.x = tags[v.sep / 80].top.x
    leads.forEach((l, i) => { l.on.visible = v.tc[i]; l.off.visible = !v.tc[i] })
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

const LABELS = [['whole', 'Whole kit'], ['rod', 'Copper rod'], ['heater', 'Heater'], ['heat', 'Heater supply'], ['therm', 'Thermometer']]

function make(exp) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({})
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, exp.controls, { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
        </div>
        <p className="stage3d-hint">Turn POWER and PERIOD on the heater supply. Click T2, T3 or T4 on the rod to choose the second sensor of the pair. Click a TC plug on the thermometer to unplug it. Drag the background to look around.</p>
      </div>
    )
  }
}

export const angstrom3D = angstrom.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ pwr: true, tOn: true, w: 24, tc: [true, true, true, true] }),
  read: (v, o) => (v.pwr && v.tOn ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
  sample: (v, o) => {
    if (!v.pwr) return { error: 'The heater supply is off. Press its power switch.' }
    if (!v.tOn) return { error: 'The thermometer is off. Press its power switch.' }
    if (!v.tc[0] || !v.tc[v.sep / 80]) return { error: `Plug in thermocouples T1 and T${v.sep / 80 + 1} first.` }
    return e.sample(v, o)
  },
  Stage: make(e),
}))
