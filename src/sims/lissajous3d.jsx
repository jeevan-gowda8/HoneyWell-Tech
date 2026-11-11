import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { lissajous } from './electrical'
import { createStudio, face, quant } from './studio3d'

/* The Lissajous trainer as a working 3D model: a sloped trainer console with a CRO behind it.
   Patch cords drag between the CRO inputs and the console sockets. Metres. */

const TAU = Math.PI * 2
const T = { x0: 90, y0: 560, W: 1620, H: 500, pw: 1.3, d: 0.36, front: 0.04, top: 0.26 }
T.ph = (T.pw * T.H) / T.W
const C = { x: -0.34, z: -0.48, w: 0.64, h: 0.4, d: 0.3, x0: 100, y0: 130, W: 580, H: 360, pw: 0.6, base: 0.27 }
C.ph = (C.pw * C.H) / C.W
const PT = (x, y) => [((x - T.x0) / T.W - 0.5) * T.pw, (0.5 - (y - T.y0) / T.H) * T.ph]
const PC = (x, y) => [((x - C.x0) / C.W - 0.5) * C.pw, (0.5 - (y - C.y0) / C.H) * C.ph]
const SRC = { gen: [660, 790], unk: [926, 820], vin: [1122, 760], vr: [1362, 800], phi: [1447, 720], pho: [1652, 750] }
const WIRE = { lissa: ['gen', 'unk'], unknown: ['gen', 'unk'], rlc: ['vin', 'vr'], phase: ['phi', 'pho'] }
const KIND = { 'lissajous-figures': 'lissa', 'unknown-frequency': 'unknown', 'rlc-lissajous': 'rlc', 'phase-difference': 'phase' }
const RANGE_FACTOR = [0.1, 0.35, 1, 1.6]
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

function drawConsole(g, W, H) {
  const k = W / T.W, X = (x) => (x - T.x0) * k, Y = (y) => (y - T.y0) * k
  const GR = '#1F4D3A', t = (s, x, y, z = 11, bold = true, col = '#1F2B3A', al = 'center') => { g.fillStyle = col === '#555' ? '#20262E' : col; g.font = `${bold ? 'bold ' : ''}${Math.max(z * 1.3, 15) * k}px Arial`; g.textAlign = al; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#E9EBE7'; g.fillRect(0, 0, W, H)
  g.fillStyle = GR; g.fillRect(X(114), Y(578), 1572 * k, 46 * k)
  t('LISSAJOUS FIGURES TRAINER', 136, 609, 22, true, '#FFF', 'left'); t('Unknown frequency · RLC resonance · Phase difference', 1664, 608, 12.5, false, '#D5E4DB', 'right')
  ;[[114, 231, 'POWER SUPPLY'], [360, 360, 'SIGNAL GENERATOR (to 100 kHz, 0–5 Vpp)'], [736, 260, 'UNKNOWN FREQUENCY f_y'], [1012, 380, 'RLC RESONANCE (series)'], [1408, 278, 'PHASE SHIFT NETWORK']].forEach(([x, w, s]) => {
    g.strokeStyle = GR; g.lineWidth = 2.4; g.strokeRect(X(x), Y(640), w * k, 400 * k); g.fillStyle = GR; g.fillRect(X(x), Y(640), w * k, 26 * k); t(s, x + w / 2, 659, 12, true, '#FFF')
  })
  t('MAINS 230 V AC', 228, 760, 10); t('+12 V', 240, 798, 11, true, '#1F2B3A', 'left'); t('500 mA', 240, 818, 9.5, false, '#555', 'left'); t('+15 V', 240, 868, 11, true, '#1F2B3A', 'left'); t('1 A', 240, 888, 9.5, false, '#555', 'left')
  g.fillStyle = '#0C0D10'; g.fillRect(X(380), Y(680), 320 * k, 72 * k)
  t('RANGE', 420, 856); t('FREQ', 510, 856); t('AMPL', 600, 856); t('OUT', 698, 794, 10); t('GND', 698, 844, 10); t('×10 Hz · ×100 Hz · ×1 kHz · ×10 kHz', 475, 878, 9, false, '#555')
  g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(390), Y(915)); g.bezierCurveTo(X(405), Y(885), X(415), Y(945), X(430), Y(915)); g.bezierCurveTo(X(445), Y(885), X(455), Y(945), X(470), Y(915)); g.stroke(); t('sine output (known frequency f_x)', 480, 920, 9.5, false, '#555', 'left')
  g.fillStyle = '#26384F'; g.fillRect(X(766), Y(690), 200 * k, 90 * k); t('f = ?', 866, 732, 22, true, '#FFC14D'); t('internal oscillator', 866, 757, 9.5, false, '#DDE3EA'); t('SELECT', 806, 884); t('OUT', 962, 824, 10)
  g.strokeStyle = '#141A22'; g.lineWidth = 3.6
  const pth = (...p) => { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke() }
  const zig = (x0, y) => { g.beginPath(); g.moveTo(X(x0), Y(y)); for (let i = 0; i <= 6; i++) g.lineTo(X(x0 + 6 + i * 7), Y(y + (i % 2 ? -9 : 9))); g.lineTo(X(x0 + 54), Y(y)); g.stroke() }
  const src = (x, y) => { g.beginPath(); g.arc(X(x), Y(y), 18 * k, 0, 7); g.stroke(); g.beginPath(); g.moveTo(X(x - 11), Y(y)); g.bezierCurveTo(X(x - 5), Y(y - 15), X(x), Y(y - 15), X(x), Y(y)); g.bezierCurveTo(X(x), Y(y + 15), X(x + 5), Y(y + 15), X(x + 11), Y(y)); g.stroke() }
  pth([1074, 720], [1096, 720]); zig(1096, 720); pth([1150, 720], [1194, 720]); g.beginPath(); for (let i = 0; i < 4; i++) g.arc(X(1201 + i * 14), Y(720), 7 * k, Math.PI, 0); g.stroke(); pth([1250, 720], [1296, 720]); pth([1296, 704], [1296, 736]); pth([1308, 704], [1308, 736]); pth([1308, 720], [1332, 720], [1332, 880], [1074, 880])
  pth([1062, 732], [1062, 782]); pth([1062, 818], [1062, 868]); src(1062, 800)
  t('R', 1122, 706, 11, false); t('1 kΩ', 1122, 742, 10, false); t('L', 1222, 704, 11, false); t('100 mH', 1222, 740, 10, false); t('C', 1302, 700, 11, false); t('0.01 µF', 1302, 750, 10, false); t('SIG', 1028, 804, 10.5, false); t('V_in → X', 1122, 787, 9.5, false); t('V_R → Y', 1362, 827, 9.5, false); t('ellipse closes to a straight line at f₀ = 5.03 kHz', 1202, 914, 10, false, '#555')
  pth([1459, 720], [1482, 720]); zig(1482, 720); pth([1536, 720], [1636, 720]); pth([1606, 720], [1606, 785]); pth([1590, 785], [1622, 785]); pth([1590, 795], [1622, 795]); pth([1606, 795], [1606, 860]); pth([1459, 860], [1636, 860]); pth([1447, 732], [1447, 772]); pth([1447, 808], [1447, 848]); src(1447, 790)
  t('R', 1508, 706, 11, false); t('10 kΩ', 1508, 742, 10, false); t('C', 1630, 786, 11, false); t('var.', 1636, 802, 9.5, false); t('SIG', 1412, 794, 10.5, false); t('PHASE', 1547, 954)
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' }
function drawLed(g, w, h, text) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#FF6B5E'; g.font = 'bold 30px Arial'; g.textAlign = 'right'; g.fillText('kHz', w - 12, h - 26)
  if (text === null) return
  const s = 46, step = 80, n = text.replace('.', '').length
  let x = w - 100 - n * step + 28
  g.lineCap = 'round'; g.lineWidth = 9.5
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - 18, 22 + s * 2, 7, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, 22 + p[1] * s); g.lineTo(x + p[2] * s, 22 + p[3] * s); g.stroke() })
    x += step
  })
}
function drawCroPanel(g, W, H) {
  const k = W / C.W, X = (x) => (x - C.x0) * k, Y = (y) => (y - C.y0) * k, t = (s, x, y, z = 11) => { g.fillStyle = '#26303C'; g.font = `bold ${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#E7E8E2'; g.fillRect(0, 0, W, H); g.fillStyle = '#17181C'; g.fillRect(X(116), Y(146), 340 * k, 270 * k)
  t('INTEN', 500, 240); t('FOCUS', 580, 240); t('X POS', 500, 332); t('Y POS', 580, 332); t('DUAL TRACE CRO · X-Y MODE', 568, 382, 10); t('CH1 V/DIV', 170, 486, 10); t('CH2 V/DIV', 320, 486, 10); t('CH1 (X)', 500, 470, 9.5); t('CH2 (Y)', 580, 470, 9.5)
}
function drawCro(g, w, h, s) {
  g.fillStyle = '#071410'; g.fillRect(0, 0, w, h)
  for (let i = 0; i <= 10; i++) { g.strokeStyle = i === 5 ? '#1E4D3B' : '#102E24'; g.lineWidth = 1.4; const x = (i * w) / 10, y = (i * h) / 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) return
  const scale = w / 624
  g.globalAlpha = clamp(s.alpha, 0.08, 1); g.strokeStyle = '#D8FFE4'; g.shadowColor = '#5CFF8F'; g.shadowBlur = 16 * scale; g.lineWidth = s.width * 1.25 * scale; g.lineJoin = 'round'; g.beginPath()
  for (let i = 0; i <= 900; i++) { const [a, b] = s.f(i / 900); const px = w / 2 + (a * s.gx + s.ox) * (w / 2) * 0.9, py = h / 2 - (b * s.gy + s.oy) * (h / 2) * 0.9; if (i) g.lineTo(px, py); else g.moveTo(px, py) }
  g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1
}
function drawWood(g, w, h) { g.fillStyle = '#7A5A42'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${i % 2 ? '40,24,12' : '160,120,90'},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke() } }

const VIEWS = {
  whole: { p: [0, 1.3, 1.98], t: [0, 0.27, -0.16] },
  cro: { p: [-0.32, 0.66, 0.5], t: [C.x, 0.47, C.z] },
  gen: { p: [-0.26, 0.74, 0.58], t: [-0.3, 0.15, 0] },
  rlc: { p: [0.24, 0.74, 0.58], t: [0.2, 0.15, 0] },
  phase: { p: [0.5, 0.72, 0.58], t: [0.5, 0.15, 0] },
}

function createScene(host, kind, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xeceef1, exposure: 1.05, env: 0.65, shadow: { left: -1.2, right: 1.2, top: 1, bottom: -1, far: 7 } })
  const M = {
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }), body: new THREE.MeshStandardMaterial({ color: 0x323842, roughness: 0.5, metalness: 0.35 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xc9cbc4, roughness: 0.48, metalness: 0.15 }), lid: new THREE.MeshStandardMaterial({ color: 0xdcddd6, roughness: 0.48 }), hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)

  const wood = face(1024, 512, drawWood); wood.set(1); wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(2, 1)
  plain(add(box(4.8, 0.04, 3), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.62 }), 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xeceef1, roughness: 0.95 }), 0, 1.3, -1.4))

  /* sloped console */
  const s2 = new THREE.Shape([[T.d / 2, 0], [T.d / 2, T.front], [-T.d / 2, T.top], [-T.d / 2, 0]].map(([a, b]) => new THREE.Vector2(a, b)))
  const g2 = new THREE.ExtrudeGeometry(s2, { depth: T.pw + 0.05, bevelEnabled: false }); g2.rotateY(-Math.PI / 2); g2.translate((T.pw + 0.05) / 2, 0, 0)
  const body = new THREE.Mesh(g2, M.body); body.castShadow = true; body.receiveShadow = true; scene.add(body)
  const tilt = Math.atan2(T.d, T.top - T.front)
  const panel = new THREE.Group(); panel.position.set(0, (T.top + T.front) / 2, 0); panel.rotation.x = -tilt; panel.translateZ(0.001); scene.add(panel)
  const af = face(2268, 700, drawConsole); af.set(1); af.tex.anisotropy = 12
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(T.pw, T.ph), new THREE.MeshStandardMaterial({ map: af.tex, roughness: 0.9 })))
  const ledF = face(640, 148, drawLed), [la, lb] = PT(540, 716), led = new THREE.Mesh(new THREE.PlaneGeometry((304 / T.W) * T.pw, (62 / T.H) * T.ph), new THREE.MeshBasicMaterial({ map: ledF.tex, toneMapped: false })); led.position.set(la, lb, 0.0006); panel.add(led)
  const knob = (par, P2, x, y, name, r = 0.018) => { const [a, b] = P2(x, y), g = new THREE.Group(); g.position.set(a, b, 0); par.add(g); alongZ(add(cyl(r * 1.3, 0.002, 32), M.chrome, 0, 0, 0.001, g)); alongZ(add(cyl(r, 0.018, 30), M.black, 0, 0, 0.01, g)); add(box(0.0024, r * 0.82, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.55, 0.0195, g); alongZ(hitBox(cyl(r * 1.6, 0.04, 12), 0, 0, 0.012, name, g)); return g }
  const kT = { range: knob(panel, PT, 420, 800, 'range'), freq: knob(panel, PT, 510, 800, 'freq'), ampl: knob(panel, PT, 600, 800, 'ampl'), select: knob(panel, PT, 806, 830, 'select'), phase: knob(panel, PT, 1547, 905, 'phase') }
  const [ra, rb] = PT(230, 712)
  add(box(0.052, 0.04, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(box(0.024, 0.032, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.013, rb, 0.004, panel); hitBox(box(0.07, 0.06, 0.03), ra, rb, 0.01, 'pwr', panel)
  const powerLeds = [800, 870].map((y) => { const [a, b] = PT(314, y), m = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 12, 10), new THREE.MeshBasicMaterial({ color: 0x4bff78, toneMapped: false })); m.position.set(a, b, 0.001); panel.add(m); return m })
  scene.updateMatrixWorld(true)
  const sockOn = (par, a, b, c, d) => { alongZ(add(cyl(0.0125, 0.004, 22), M.chrome, a, b, 0.002, par)); alongZ(add(cyl(0.0082, 0.006, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), a, b, 0.004, par)); if (d) hitBox(new THREE.SphereGeometry(0.022, 10, 8), a, b, 0.012, d, par); return par.localToWorld(V(a, b, 0.008)) }
  ;[[164, 800, 0xd92b20], [214, 800, 0x15161a], [164, 870, 0xd92b20], [214, 870, 0x15161a], [660, 840, 0x15161a], [926, 870, 0x15161a], [1062, 720, 0xd92b20], [1062, 880, 0x15161a], [1447, 860, 0x15161a]].forEach(([x, y, c]) => sockOn(panel, ...PT(x, y), c))
  const srcPos = Object.fromEntries(Object.entries(SRC).map(([k, [x, y]]) => [k, sockOn(panel, ...PT(x, y), k === 'phi' ? 0xd92b20 : 0xe8c53a, `src:${k}`)]))

  /* CRO */
  add(box(0.76, C.base, 0.42), M.body, C.x, C.base / 2, C.z)
  const cro = new THREE.Group(); cro.position.set(C.x, C.base, C.z); scene.add(cro)
  add(box(C.w, C.h, C.d), M.cream, 0, C.h / 2, 0, cro); add(box(C.w * 0.9, 0.012, C.d * 0.84), M.lid, 0, C.h + 0.006, 0, cro)
  const cp = new THREE.Group(); cp.position.set(0, C.h / 2, C.d / 2 + 0.0008); cro.add(cp)
  const cf = face(1160, 720, drawCroPanel); cf.set(1); cp.add(new THREE.Mesh(new THREE.PlaneGeometry(C.pw, C.ph), new THREE.MeshStandardMaterial({ map: cf.tex, roughness: 0.55 })))
  const scrF = face(1040, 806, drawCro), [sa, sb] = PC(286, 281), scr = new THREE.Mesh(new THREE.PlaneGeometry((312 / C.W) * C.pw, (242 / C.H) * C.ph), new THREE.MeshBasicMaterial({ map: scrF.tex, toneMapped: false })); scr.position.set(sa, sb, 0.0006); cp.add(scr)
  const kC = { inten: knob(cp, PC, 500, 190, 'inten', 0.017), focus: knob(cp, PC, 580, 190, 'focus', 0.017), xpos: knob(cp, PC, 500, 282, 'xpos', 0.017), ypos: knob(cp, PC, 580, 282, 'ypos', 0.017), gx: knob(cp, PC, 170, 450, 'gx', 0.02), gy: knob(cp, PC, 320, 450, 'gy', 0.02) }
  const [ca, cb] = PC(647, 440); add(box(0.028, 0.044, 0.003), M.black, ca, cb, 0.0015, cp); const rockC = add(box(0.024, 0.02, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ca, cb + 0.01, 0.004, cp); hitBox(box(0.05, 0.06, 0.03), ca, cb, 0.01, 'croOn', cp)
  scene.updateMatrixWorld(true)
  const chPos = { x: sockOn(cp, ...PC(500, 440), 0xe8c53a, 'ch:x'), y: sockOn(cp, ...PC(580, 440), 0x22a899, 'ch:y') }

  /* patch cords, rebuilt when they move */
  const COL = { x: 0xf5b92e, y: 0x22a899 }
  const tubeOf = (a, b) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().add(V(0, -0.03, 0.09)), V((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.02, (a.z + b.z) / 2 + 0.02), b.clone().add(V(0, 0.07, 0.04)), b]), 70, 0.0042, 8)
  const offOf = (a) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().add(V(0, -0.06, 0.08)), V(a.x + 0.03, C.base + 0.01, a.z + 0.12), V(a.x + 0.05, C.base + 0.006, a.z + 0.16)]), 40, 0.0042, 8)
  const cords = { x: add(offOf(chPos.x), new THREE.MeshStandardMaterial({ color: COL.x, roughness: 0.5 }), 0, 0, 0), y: add(offOf(chPos.y), new THREE.MeshStandardMaterial({ color: COL.y, roughness: 0.5 }), 0, 0, 0) }
  const plugKey = { x: null, y: null }
  const syncCord = (k, src) => { if (plugKey[k] === (src ?? 'none')) return; plugKey[k] = src ?? 'none'; cords[k].geometry.dispose(); cords[k].geometry = src ? tubeOf(chPos[k], srcPos[src]) : offOf(chPos[k]) }
  const preview = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0x4fc3ff })); preview.visible = false; scene.add(preview)

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3.4; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3(), el = renderer.domElement
  const facing = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt)), V(0, (T.top + T.front) / 2, 0))
  const pick = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d) }
  const K2 = { ampl: 0.65, inten: 0.75, focus: 0.6, xpos: 0.5, ypos: 0.5, gx: 0.5, gy: 0.5 }
  const Q = { v: null, drag: null, range: 2 }
  const c = (k) => ctl.find((q) => q.k === k)
  const MAP = { lissa: { freq: 'p', select: 'q', phase: 'ph' }, unknown: { freq: 'fx', select: 'r' }, rlc: { freq: 'f' }, phase: { freq: 'f', phase: 'R' } }[kind]
  const uOf = (k, val) => { const q = c(k); if (q.type === 'select') return q.options.findIndex((o) => o[0] === val) / (q.options.length - 1); return (val - q.min) / (q.max - q.min) }
  const setU = (k, u) => { const q = c(k); if (q.type === 'select') api.set(k, q.options[Math.round(clamp(u, 0, 1) * (q.options.length - 1))][0]); else api.set(k, quant(q, q.min + clamp(u, 0, 1) * (q.max - q.min))) }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d === 'pwr' || d === 'croOn') { api.set(d, !v[d]); return }
    if (d === 'range') { Q.range = (Q.range + 1) % 4; return }
    if (d.startsWith('ch:')) { Q.drag = { ch: d.slice(3), x: e.clientX, y: e.clientY, moved: false }; preview.visible = true; const a = chPos[Q.drag.ch]; preview.geometry.setFromPoints([a, a]); return }
    if (d.startsWith('src:')) { const src = d.slice(4), ch = v.x === src ? 'x' : v.y === src ? 'y' : null; Q.drag = { src, ch, x: e.clientX, y: e.clientY, moved: false }; return }
    if (K2[d] !== undefined) { Q.drag = { k: d, x: e.clientX, y: e.clientY, val: K2[d] }; return }
    const key = MAP[d]; if (key) Q.drag = { ctl: key, x: e.clientX, y: e.clientY, val: uOf(key, v[key]), f: d === 'freq' ? RANGE_FACTOR[Q.range] : 1 }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : d.startsWith('ch:') || d.startsWith('src:') ? 'crosshair' : ['pwr', 'croOn', 'range'].includes(d) ? 'pointer' : 'grab'; return }
    if (s.none) return
    if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 4) s.moved = true
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (s.k) { K2[s.k] = clamp(s.val + mv / 240, 0, 1); Q.dirty = true }
    if (s.ctl) setU(s.ctl, s.val + (mv / 240) * s.f)
    if (s.ch) { pick(e); const p = ray.ray.intersectPlane(facing, hitP); if (p) preview.geometry.setFromPoints([chPos[s.ch], p.clone()]); draw() }
  }
  const onUp = (e) => {
    const s = Q.drag
    if (s?.ch) {
      preview.visible = false
      const d = pick(e)?.object.userData.d
      if (s.moved && d?.startsWith('src:')) api.set(s.ch, d.slice(4))
      else if (!s.moved) api.set(s.ch, null)
    }
    if (s?.src && s.ch && !s.moved) api.set(s.ch, null)
    Q.drag = null; orbit.enabled = true
  }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const ang = (u) => rad(135 - clamp(u, 0, 1) * 270)
  function figure(v, o) {
    if (kind === 'lissa') return { f: (s) => [Math.sin(TAU * v.p * s + o.ph), Math.sin(TAU * v.q * s)], t: `X-Y CH1(X): ${v.p.toFixed(2)} kHz CH2(Y): ?`, khz: v.p }
    if (kind === 'unknown') { const b = v.r === 1.5 ? [2, 3] : v.r === 2 ? [1, 2] : v.r === 0.5 ? [2, 1] : [1, 1]; return { f: (s) => [Math.sin(TAU * b[0] * s), Math.sin(TAU * b[1] * s + o.ph + 0.7)], t: Math.abs(o.mis) < 0.004 ? 'FIGURE STATIONARY' : 'FIGURE DRIFTING', khz: v.fx } }
    if (kind === 'rlc') return { f: (s) => [Math.sin(TAU * s), Math.cos(o.phi) * Math.sin(TAU * s - o.phi)], t: 'X: V_in  Y: V_R', khz: v.f }
    return { f: (s) => [Math.sin(TAU * s), Math.sin(TAU * s - o.phi)], t: 'X: V_in  Y: V_C', khz: v.f }
  }
  function update(v, o, t, tc) {
    Q.v = v
    const fig = figure(v, o), ok = WIRE[kind], xOk = v.x === ok[0], yOk = v.y === ok[1], live = v.pwr && v.croOn
    syncCord('x', v.x); syncCord('y', v.y)
    ledF.set(`${fig.khz}${v.pwr}`, v.pwr ? fig.khz.toFixed(3) : null)
    const amp = 0.25 + K2.ampl * 1.15, gx = 0.4 + K2.gx * 1.2, gy = 0.4 + K2.gy * 1.2
    const scrS = v.croOn ? { title: fig.t, f: v.pwr ? (s) => { const [a, b] = fig.f(s); return [xOk ? a * amp : 0, yOk ? b * amp : 0] } : () => [0, 0], gx, gy, ox: (K2.xpos - 0.5) * 0.8, oy: (K2.ypos - 0.5) * 0.8, alpha: K2.inten / 0.7, width: 2.6 + Math.abs(K2.focus - 0.6) * 14 } : null
    scrF.set(`${Math.random()}`, scrS)
    if (tc) drawCro(tc.getContext('2d'), tc.width, tc.height, scrS)
    rocker.position.x = ra + (v.pwr ? -0.013 : 0.013); rockC.position.y = cb + (v.croOn ? 0.01 : -0.01); powerLeds.forEach((m) => m.material.color.set(v.pwr ? 0x4bff78 : 0x14401f)); void live
    kT.range.rotation.z = rad(135 - (Q.range / 3) * 270); kT.ampl.rotation.z = ang(K2.ampl)
    ;['freq', 'select', 'phase'].forEach((d) => { kT[d].rotation.z = MAP[d] ? ang(uOf(MAP[d], v[MAP[d]])) : ang(0.5) })
    Object.entries(kC).forEach(([k, g]) => { g.rotation.z = ang(K2[k]) })
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

const LABELS = [['whole', 'Whole kit'], ['cro', 'Oscilloscope'], ['gen', 'Signal generator'], ['rlc', 'RLC network'], ['phase', 'Phase network']]
const HINTS = {
  lissa: 'Turn FREQ for the X input, SELECT for the Y input and PHASE to change the figure. Drag from a CRO input to a socket to patch, and click a plug to remove it.',
  unknown: 'Turn FREQ until the figure stands still, and SELECT for the ratio. RANGE sets how fast FREQ moves. Drag from a CRO input to a socket to patch.',
  rlc: 'Turn FREQ and watch the ellipse close at resonance. RANGE sets how fast FREQ moves. Patch X to V_in and Y to V_R.',
  phase: 'Turn FREQ and PHASE to change the ellipse. Patch X to the red SIG socket and Y to the yellow socket.',
}

function make(exp, kind) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({}), tr = useRef(null)
    const [failed, setFailed] = useState(false), [cur, setCur] = useState('whole')
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
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => { sim.current?.applyView(k); setCur(k) }}>{l}</button>)}</div>
          <div className={`trace-view xy${cur === 'whole' ? '' : ' small'}`}><canvas ref={tr} width={624} height={484} aria-label="Lissajous figure on the X-Y display" role="img" /><span>Oscilloscope: X-Y display</span></div>
        </div>
        <p className="stage3d-hint">{HINTS[kind]} Drag the background to look around.</p>
      </div>
    )
  }
}

export const lissajous3D = lissajous.map((e) => {
  const kind = KIND[e.id], [x, y] = WIRE[kind]
  return {
    ...e,
    wide: true,
    state: () => ({ pwr: true, croOn: true, x, y }),
    read: (v, o) => (v.pwr && v.croOn ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: (v, o) => {
      if (!v.pwr) return { error: 'The trainer is off. Press its MAINS switch.' }
      if (!v.croOn) return { error: 'The oscilloscope is off. Press its power switch.' }
      if (v.x !== x || v.y !== y) return { error: 'Patch the CRO inputs to the correct sockets for this experiment.' }
      return e.sample(v, o)
    },
    Stage: make(e, kind),
  }
})
