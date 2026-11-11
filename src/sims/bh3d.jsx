import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { bhCro, MAT, loop, loopStats } from './magnetism'
import { createStudio, face } from './studio3d'

/* The B-H curve kit as a working 3D model: oscilloscope in X-Y mode, curve tracer with the specimen
   in its solenoid, voltage and current sensors and a data logger. Metres. */

const CRO = { x: -0.66, z: -0.12, ry: 0.14, w: 0.5, h: 0.34, d: 0.3, x0: 100, y0: 340, W: 500, H: 300, pw: 0.46 }
const TR = { x: -0.02, z: -0.12, ry: 0, w: 0.46, h: 0.24, d: 0.26, x0: 670, y0: 430, W: 440, H: 210, pw: 0.42 }
const LOG = { x: 0.46, z: 0.34, ry: -0.05, w: 0.33, h: 0.075, d: 0.17 }
const panelH = (c) => (c.pw * c.H) / c.W
const SX = 1 / 620, SY = 1 / 1.7
const DEMAG_STEP = 0.35
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const hOf = (v) => (v.n !== undefined ? Math.max(2, 600 * 0.8 ** v.n) : v.I * 600)
const ROD = { soft: 0xd5d9df, hard: 0x6b727d }

function plot(g, x, y, w, h, m, Hm, opt) {
  const { gain = [1, 1], off = [0, 0], width = 2.5, alpha = 1, colours = ['#7CFF9E', '#7CFF9E'], scale = 1 } = opt
  const L = loop(m, Hm)
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip()
  ;[L.up, L.down].forEach((fn, k) => {
    g.strokeStyle = colours[k]; g.globalAlpha = alpha; g.lineWidth = width * scale; g.lineJoin = 'round'; g.beginPath()
    for (let i = 0; i <= 160; i++) {
      const H = -Hm + (i / 160) * 2 * Hm
      const px = x + w / 2 + (H * SX * gain[0] + off[0]) * (w / 2) * 0.92, py = y + h / 2 - (fn(H) * SY * gain[1] + off[1]) * (h / 2) * 0.92
      if (i) g.lineTo(px, py); else g.moveTo(px, py)
    }
    g.stroke()
  })
  g.restore(); g.globalAlpha = 1
}
function drawScreen(g, w, h, s) {
  g.fillStyle = '#071410'; g.fillRect(0, 0, w, h)
  for (let i = 0; i <= 10; i++) { g.strokeStyle = i === 5 ? '#2F7A58' : '#1A4635'; g.lineWidth = i === 5 ? 2.2 : 1.2; const x = (i * w) / 10, y = (i * h) / 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) return
  g.fillStyle = '#7CFF9E'; g.font = 'bold 20px monospace'; g.fillText('X-Y MODE CH1: H  CH2: B', 18, 30)
  plot(g, 0, 0, w, h, s.m, s.Hm, s)
}
function art(c, paint, bg) {
  return (g, w, h) => {
    const k = w / c.W, X = (x) => (x - c.x0) * k, Y = (y) => (y - c.y0) * k
    g.fillStyle = bg; g.fillRect(0, 0, w, h)
    paint((t, x, y, s = 10.5, bold = true, col = '#26303C') => { g.fillStyle = col; g.font = `${bold ? 'bold ' : ''}${s * k}px Arial`; g.textAlign = 'center'; g.fillText(t, X(x), Y(y)) }, g, X, Y, k)
  }
}
const paintCro = (t) => { t('INTEN', 442, 424); t('FOCUS', 512, 424); t('X POS', 442, 504); t('Y POS', 512, 504); t('CH1 V/DIV', 170, 636, 9.5); t('CH2 V/DIV', 300, 636, 9.5); t('CH1 (X)', 450, 628); t('CH2 (Y)', 520, 628); t('DUAL TRACE OSCILLOSCOPE', 492, 570, 9.5, true, '#5B6068') }
const paintTr = (t, g, X, Y, k) => {
  t('B-H CURVE TRACER', 890, 454, 16, true, '#1D3F66'); t('Hysteresis loop of ferromagnetic material', 890, 472, 9.5, false, '#566273')
  t('AMPLITUDE (H)', 720, 564); t('FREQUENCY', 810, 564); t('AUTO MODE', 915, 561, 9); t('X (H)', 1030, 538); t('Y (B)', 1080, 538); t('GND', 1055, 588); t('PRIMARY', 720, 626); t('SECONDARY', 840, 626)
  g.fillStyle = '#C8282A'; g.fillRect(X(865), Y(506), 100 * k, 36 * k); g.fillStyle = '#FFF'; g.font = `bold ${10.5 * k}px Arial`; g.fillText('DEMAGNETIZE', X(915), Y(528))
}
const paintLogger = (g, w, h) => {
  g.fillStyle = '#26292F'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = 'bold 34px Arial'; g.fillText('DATA LOGGER · 4 CH', w / 2, 44)
  g.font = 'bold 24px Arial'; [0, 1, 2, 3].forEach((i) => g.fillText(`CH${i + 1}`, 130 + i * 160, 226))
  
}
const sign = (a, b, c) => (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = 'bold 30px Arial'; g.fillText(a, w / 2, 60); g.font = '24px Arial'; g.fillText(b, w / 2, 100) }
function drawCoil(g, w, h) { const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, '#5E2412'); b.addColorStop(0.5, '#E08A5E'); b.addColorStop(1, '#5A1E0E'); g.fillStyle = b; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,12,4,.3)'; g.lineWidth = 2; for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() } }
function drawWood(g, w, h) { g.fillStyle = '#A9794F'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${i % 2 ? '70,40,18' : '205,160,115'},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke() } }

const VIEWS = {
  whole: { p: [-0.12, 0.72, 2.02], t: [-0.1, 0.18, 0.02] },
  cro: { p: [-0.58, 0.3, 0.66], t: [CRO.x, 0.17, CRO.z] },
  tracer: { p: [-0.02, 0.42, 0.72], t: [TR.x, 0.2, TR.z] },
  sensors: { p: [0.26, 0.42, 0.98], t: [0.26, 0.04, 0.34] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xdfe2e5, exposure: 1, env: 0.55, shadow: { left: -1.3, right: 1.3, top: 1, bottom: -1, far: 6 } })
  const M = {
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xc9cbc4, roughness: 0.48, metalness: 0.15 }),
    creamLid: new THREE.MeshStandardMaterial({ color: 0xdcddd6, roughness: 0.48 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x29507c, roughness: 0.45, metalness: 0.25 }),
    blueLid: new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.45, metalness: 0.25 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe8661e, roughness: 0.45 }),
    orangeLid: new THREE.MeshStandardMaterial({ color: 0xff9a5c, roughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.8, roughness: 0.35 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.6 }),
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

  const wood = face(1024, 512, drawWood); wood.set(1); wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(2, 1)
  plain(add(box(4.8, 0.04, 2.6), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.62 }), 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xe0e3e6, roughness: 0.95 }), 0, 1.3, -1.25))

  const instrument = (c, bodyM, lidM, paint, bg) => {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = c.ry; scene.add(g)
    add(box(c.w, c.h, c.d), bodyM, 0, c.h / 2, 0, g); add(box(c.w * 0.92, 0.012, c.d * 0.86), lidM, 0, c.h + 0.006, 0, g)
    const panel = new THREE.Group(); panel.position.set(0, c.h / 2, c.d / 2 + 0.0008); g.add(panel)
    const ph = panelH(c), f = face(c.W * 2, c.H * 2, art(c, paint, bg)); f.set(1)
    panel.add(new THREE.Mesh(new THREE.PlaneGeometry(c.pw, ph), new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.55 })))
    const P = (x, y) => [((x - c.x0) / c.W - 0.5) * c.pw, (0.5 - (y - c.y0) / c.H) * ph]
    return { g, panel, P }
  }
  const C = instrument(CRO, M.cream, M.creamLid, paintCro, '#E7E8E2'), T = instrument(TR, M.blue, M.blueLid, paintTr, '#F1F3F6')
  const knob = (I, x, y, name, r = 0.0165) => {
    const [a, b] = I.P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); I.panel.add(g)
    alongZ(add(cyl(r * 1.3, 0.002, 32), M.chrome, 0, 0, 0.001, g)); alongZ(add(cyl(r, 0.016, 28), M.black, 0, 0, 0.009, g))
    add(box(0.0022, r * 0.8, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.55, 0.0175, g)
    alongZ(hitBox(cyl(r * 1.6, 0.04, 12), 0, 0, 0.012, name, g))
    return g
  }
  const sock = (panel, a, b, col, d) => {
    alongZ(add(cyl(0.0105, 0.004, 20), M.chrome, a, b, 0.002, panel)); alongZ(add(cyl(0.007, 0.006, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), a, b, 0.004, panel))
    if (d) hitBox(new THREE.SphereGeometry(0.018, 10, 8), a, b, 0.012, d, panel)
    return panel.localToWorld(V(a, b, 0.008))
  }
  const rockerOf = (I, x, y, d) => {
    const [a, b] = I.P(x, y)
    add(box(0.024, 0.036, 0.003), M.black, a, b, 0.0015, I.panel)
    const m = add(box(0.02, 0.016, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), a, b + 0.008, 0.004, I.panel)
    if (d) hitBox(box(0.045, 0.055, 0.03), a, b, 0.01, d, I.panel)
    return { m, b }
  }

  /* screen */
  const screenF = face(532, 412, drawScreen), [sa, sb] = C.P(259, 469), sw = (266 / CRO.W) * CRO.pw, sh = (206 / CRO.H) * panelH(CRO)
  const [fa, fb] = C.P(259, 469)
  add(box(sw * 1.09, sh * 1.1, 0.002), M.black, fa, fb, 0.001, C.panel)
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: screenF.tex, toneMapped: false })); scr.position.set(sa, sb, 0.0024); C.panel.add(scr)
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); C.panel.add(dot)
  const croK = { inten: knob(C, 442, 390, 'inten'), focus: knob(C, 512, 390, 'focus'), xpos: knob(C, 442, 470, 'xpos'), ypos: knob(C, 512, 470, 'ypos'), chx: knob(C, 170, 607, 'chx', 0.0155), chy: knob(C, 300, 607, 'chy', 0.0155) }

  scene.updateMatrixWorld(true)
  const croSock = [sock(C.panel, ...C.P(450, 600), 0xe8c53a, 'cS'), sock(C.panel, ...C.P(520, 600), 0xe8c53a, 'cS')]
  const croRock = rockerOf(C, 575, 600, 'pwr')

  /* tracer */
  const trK = { amp: knob(T, 720, 525, 'amp', 0.021), freq: knob(T, 810, 525, 'freq', 0.021) }
  const [dx, dy] = T.P(915, 524); hitBox(box(0.1, 0.04, 0.02), dx, dy, 0.008, 'demag', T.panel)
  const [lx, ly] = T.P(985, 524), demagLed = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 14, 10), new THREE.MeshBasicMaterial({ color: 0x14401f, toneMapped: false })); demagLed.position.set(lx, ly, 0.001); T.panel.add(demagLed)
  const trX = sock(T.panel, ...T.P(1030, 510), 0xe8c53a, 'cS'), trY = sock(T.panel, ...T.P(1080, 510), 0xe8c53a, 'cS')
  sock(T.panel, ...T.P(1055, 560), 0x15161a)
  const prim = [sock(T.panel, ...T.P(706, 600), 0xd92b20), sock(T.panel, ...T.P(734, 600), 0x15161a)], sec = [sock(T.panel, ...T.P(826, 600), 0xd92b20), sock(T.panel, ...T.P(854, 600), 0x15161a)]
  const trRock = rockerOf(T, 970, 604, 'pwr')

  /* solenoid and specimen rod */
  const solY = TR.h + 0.075, coilF = face(512, 256, drawCoil); coilF.set(1)
  const sol = new THREE.Group(); sol.position.set(TR.x, solY, TR.z); scene.add(sol)
  alongX(add(cyl(0.05, 0.25, 48), new THREE.MeshStandardMaterial({ map: coilF.tex, roughness: 0.5, metalness: 0.4 }), 0, 0, 0, sol))
  alongX(add(cyl(0.052, 0.058, 48), M.green, 0, 0, 0, sol))
  ;[-0.128, 0.128].forEach((x) => { alongX(add(cyl(0.056, 0.006, 40), M.black, x, 0, 0, sol)); add(box(0.024, 0.075, 0.05), M.black, x, -0.0635, 0, sol) })
  const rod = alongX(add(cyl(0.018, 0.34, 28), new THREE.MeshStandardMaterial({ color: ROD.hard, metalness: 0.9, roughness: 0.3 }), 0, 0, 0, sol))
  alongX(hitBox(cyl(0.06, 0.36, 12), 0, 0, 0, 'rod', sol))

  /* sensors */
  const sensor = (x, c, a, b) => {
    add(box(0.13, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }), x, 0.015, 0.34)
    const f = face(320, 180, sign(a, b, `#${c.toString(16).padStart(6, '0')}`)); f.set(1)
    const top = plain(add(new THREE.PlaneGeometry(0.128, 0.078), new THREE.MeshBasicMaterial({ map: f.tex }), x, 0.0304, 0.34)); top.rotation.x = -Math.PI / 2
    return V(x, 0.03, 0.31)
  }
  const sV = sensor(-0.08, 0x1565c0, 'VOLTAGE SENSOR', 'auto-ID · 6-pin'), sI = sensor(0.09, 0x6a1b9a, 'CURRENT SENSOR', 'auto-ID · 6-pin')

  /* data logger */
  const lg = new THREE.Group(); lg.position.set(LOG.x, 0, LOG.z); lg.rotation.y = LOG.ry; scene.add(lg)
  add(box(LOG.w, LOG.h, LOG.d), M.orange, 0, LOG.h / 2, 0, lg); add(box(LOG.w * 0.9, 0.008, LOG.d * 0.8), M.orangeLid, 0, LOG.h + 0.004, 0, lg)
  const lp = new THREE.Group(); lp.position.set(0, LOG.h / 2, LOG.d / 2 + 0.0008); lg.add(lp)
  const lf = face(800, 270, paintLogger); lf.set(1)
  lp.add(new THREE.Mesh(new THREE.PlaneGeometry(LOG.w * 0.94, LOG.h * 0.86), new THREE.MeshStandardMaterial({ map: lf.tex, roughness: 0.55 })))
  scene.updateMatrixWorld(true)
  const ch = [0, 1, 2, 3].map((i) => {
    const x = ((130 + i * 160) / 800 - 0.5) * LOG.w * 0.94
    return sock(lp, x, 0.002, 0x101114, i < 2 ? 'cL' : null)
  })
  const chLeds = [0, 1, 2, 3].map((i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3a3a3a, toneMapped: false })); m.position.set(((168 + i * 160) / 800 - 0.5) * LOG.w * 0.94, 0.014, 0.001); lp.add(m); return m })

  /* cables */
  const tube = (pts, col, r = 0.003) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, r, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }), 0, 0, 0)
  const pair = (a, b, midOn, offEnd, col) => {
    const near = b.clone().add(V(0, -0.03, 0.08)); near.y = Math.max(near.y, 0.012)
    const on = tube([a, a.clone().add(V(0, -0.03, 0.08)), midOn, near, b], col)
    const off = tube([a, a.clone().add(V(0, -0.04, 0.09)), V((a.x + offEnd.x) / 2, 0.03, (a.z + offEnd.z) / 2 + 0.05), offEnd], col)
    return { on, off }
  }
  const cS = [pair(trX, croSock[0], V(-0.36, 0.02, 0.18), V(trX.x - 0.04, 0.006, 0.16), 0x101114), pair(trY, croSock[1], V(-0.34, 0.03, 0.22), V(trY.x + 0.02, 0.006, 0.17), 0x101114)]
  const cL = [pair(ch[0], V(sI.x + 0.02, 0.026, 0.382), V(0.26, 0.05, 0.53), V(ch[0].x, 0.006, 0.56), 0x101114), pair(ch[1], V(sV.x + 0.02, 0.026, 0.382), V(0.14, 0.06, 0.58), V(ch[1].x, 0.006, 0.57), 0x101114)]
  tube([sI, V(sI.x + 0.02, 0.08, 0.2), V(trX.x, trX.y - 0.04, trX.z + 0.14), trX.clone().add(V(0, -0.004, 0.002))], 0xf5a623)
  tube([sV, V(sV.x + 0.05, 0.09, 0.2), V(trY.x, trY.y - 0.05, trY.z + 0.15), trY.clone().add(V(0, -0.004, 0.002))], 0xf5a623)
  const leftE = V(TR.x - 0.1, solY - 0.05, TR.z + 0.02), midE = V(TR.x + 0.012, solY - 0.05, TR.z + 0.02)
  tube([leftE, V(prim[0].x, prim[0].y + 0.04, prim[0].z + 0.03), prim[0]], 0xc42a26); tube([midE, V(sec[0].x, sec[0].y + 0.04, sec[0].z + 0.03), sec[0]], 0x2a7a3a)

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3.2; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement
  const pick = (e) => {
    const r = el.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d)
  }
  const K = { inten: 0.7, focus: 0.6, xpos: 0.5, ypos: 0.5, chx: 0.5, chy: 0.5, freq: 0.4 }
  const S = { v: null, drag: null, lastT: 0, acc: 0, ph: 0, shrink: 0, running: false }
  const cI = ctl.find((q) => q.k === 'I'), cMat = ctl.find((q) => q.k === 'mat')
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    const v = S.v
    S.drag = { none: true }
    if (K[d] !== undefined) { S.drag = { k: d, x: e.clientX, y: e.clientY, val: K[d] }; return }
    if (d === 'amp') { if (cI) S.drag = { amp: true, x: e.clientX, y: e.clientY, val: v.I }; else api.set('n', 0); return }
    if (d === 'rod') { if (cMat) api.set('mat', v.mat === 'hard' ? 'soft' : 'hard'); return }
    if (d === 'demag') { if (v.n !== undefined) S.running = !S.running && v.n < 24; else S.shrink = 1; return }
    api.set(d, !v[d])
  }
  const onMove = (e) => {
    const s = S.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : K[d] !== undefined || d === 'amp' ? 'grab' : 'pointer'; return }
    if (s.none) return
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (s.k) { K[s.k] = clamp(s.val + mv / 240, 0, 1); S.dirty = true }
    if (s.amp) api.set('I', +clamp(Math.round((s.val + (mv / 240) * (cI.max - cI.min)) / cI.step) * cI.step, cI.min, cI.max).toFixed(3))
  }
  const onUp = () => { S.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const ang = (u) => rad(135 - u * 270)
  function update(v, o, t) {
    S.v = v
    const dt = Math.max(0, Math.min(0.2, t - S.lastT)); S.lastT = t
    if (S.running && dt > 0) {
      S.acc += dt / DEMAG_STEP
      if (S.acc >= 1) { S.acc = 0; if (v.n >= 24) S.running = false; else api.set('n', v.n + 1) }
    }
    if (S.shrink > 0) S.shrink = Math.max(0, S.shrink - dt / 3)
    const m = MAT[v.mat], live = v.pwr
    const envelope = S.shrink > 0 ? Math.max(0.03, Math.abs(S.shrink * 2 - 1)) : 1
    const Hm = hOf(v) * envelope
    const gain = [0.5 + K.chx, 0.5 + K.chy], off = [(K.xpos - 0.5) * 0.8, (K.ypos - 0.5) * 0.8]
    const cro = live && v.cS, scrKey = cro ? `${v.mat}|${Hm.toFixed(1)}|${gain}|${off}|${K.inten.toFixed(2)}|${K.focus.toFixed(2)}` : 'off'
    screenF.set(scrKey, cro ? { m, Hm, gain, off, alpha: clamp(K.inten / 0.7, 0.08, 1), width: 2.5 + Math.abs(K.focus - 0.6) * 22 } : null)
    S.ph += dt * (0.2 + K.freq * 1.2)
    dot.visible = cro
    if (cro) {
      const L = loop(m, Hm), p = S.ph * Math.PI * 2, H = Hm * Math.sin(p), B = Math.cos(p) > 0 ? L.up(H) : L.down(H)
      const px = clamp((H * SX * gain[0] + off[0]) * 0.92, -1, 1), py = clamp((B * SY * gain[1] + off[1]) * 0.92, -1, 1)
      dot.position.set(sa + (px * sw) / 2, sb + (py * sh) / 2, 0.0034)
    }
    rod.material.color.set(ROD[v.mat])
    Object.entries(croK).forEach(([k, g]) => { g.rotation.z = ang(K[k]) })
    trK.freq.rotation.z = ang(K.freq)
    trK.amp.rotation.z = ang(cI ? (v.I - cI.min) / (cI.max - cI.min) : 0.8 ** v.n)
    demagLed.material.color.set(live && (S.running || S.shrink > 0) ? 0x4bff78 : 0x14401f)
    croRock.m.position.y = croRock.b + (v.pwr ? 0.008 : -0.008); trRock.m.position.y = trRock.b + (v.pwr ? 0.008 : -0.008)
    cS.forEach((c) => { c.on.visible = v.cS; c.off.visible = !v.cS }); cL.forEach((c) => { c.on.visible = v.cL; c.off.visible = !v.cL })
    chLeds.forEach((l, i) => l.material.color.set(live && v.cL && i < 2 ? 0x4bff78 : 0x3a3a3a))
    draw()
  }
  const dispose = () => {
    ro.disconnect(); orbit.dispose()
    el.removeEventListener('pointerdown', onDown, cap); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp)
    scene.traverse((q) => { q.geometry?.dispose(); const mt = q.material; if (mt) { mt.map?.dispose(); mt.dispose() } })
    release(); renderer.dispose(); el.remove()
  }
  applyView('whole'); size()
  return { update, dispose, applyView }
}

const LABELS = [['whole', 'Whole kit'], ['cro', 'Oscilloscope'], ['tracer', 'Curve tracer'], ['sensors', 'Sensors and logger']]

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
        <p className="stage3d-hint">Turn the knobs on the tracer and oscilloscope, and press DEMAGNETIZE. Click the solenoid to swap the specimen rod. Click CH1 or CH2 on the data logger or oscilloscope to unplug those cables. Drag the background to look around.</p>
      </div>
    )
  }
}

export const bh3D = bhCro.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ pwr: true, cS: true, cL: true }),
  read: (v, o) => (v.pwr && v.cL ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
  sample: (v, o) => {
    if (!v.pwr) return { error: 'The curve tracer is off. Press its power switch.' }
    if (!v.cL) return { error: 'The sensors are unplugged from the data logger. Click CH1 or CH2 on the logger.' }
    return e.sample(v, o)
  },
  Stage: make(e),
}))
