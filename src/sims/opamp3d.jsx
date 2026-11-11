import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { opAmp, wave, VSAT } from './electrical'
import { createStudio, face, quant } from './studio3d'

/* The op-amp trainer as a working 3D model: a sloped board with supply, generator, two uA741s
   and a component bank. Patch cords show each circuit and the resistor plugs can be moved. Metres. */

const TAU = Math.PI * 2
const B = { x0: 72, y0: 72, W: 1656, H: 906, pw: 1.25, L: 0.54, h: 0.43 }
B.ph = (B.pw * B.H) / B.W
const K = B.pw / B.W, A = Math.atan2(B.L, B.h), CY = B.h / 2 + 0.004
const P = (x, y) => [((x - B.x0) / B.W - 0.5) * B.pw, (0.5 - (y - B.y0) / B.H) * B.ph]
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const rad = (d) => (d * Math.PI) / 180
const ROW = { 1: 630, 10: 682, 100: 734 }, CAPX = { 1: 296, 10: 426, 100: 556 }
const P2 = [1104, 325], P3 = [1104, 355], P6 = [1236, 355], P4 = [1104, 385], P7 = [1236, 325], GND = [190, 250], GEN = [725, 442], V1 = [250, 430], V2 = [475, 430]
const rs = (c, val) => [[202 + 100 * c, ROW[val]], [278 + 100 * c, ROW[val]]]
const O = 0xf5a623, G = 0x22a899, Y = 0xe8c53a, KK = 0x17181c, V_ = 0x8e5bd0

function cordsFor(id, v) {
  const list = []
  if (v.rp) list.push([[160, 250], P7, 0xd42b24])
  if (v.rn) list.push([[264, 250], P4, 0x1f62c4])
  const ri = rs(0, v.Ri ?? v.R ?? 10), rf = rs(1, v.Rf ?? 10), r1 = rs(0, v.R ?? 10), r2 = rs(2, v.R ?? 10), r3 = rs(3, v.Rf ?? 10), c0 = [CAPX[v.C ?? 10], 800], c1 = [CAPX[v.C ?? 10] + 68, 800]
  const fb = [[P2, rf[0], Y], [rf[1], P6, Y]]
  const map = {
    'voltage-follower': [[GEN, P3, O], [P6, P2, G]],
    inverting: [[GEN, ri[0], O], [ri[1], P2, G], ...fb, [P3, GND, KK]],
    'non-inverting': [[GEN, P3, O], [GND, ri[0], KK], [ri[1], P2, G], ...fb],
    adder: [[V1, r1[0], O], [V2, r2[0], V_], [r1[1], P2, G], [r2[1], P2, G], ...fb, [P3, GND, KK]],
    subtractor: [[V1, r1[0], O], [r1[1], P2, G], [V2, r2[0], V_], [r2[1], P3, G], ...fb, [P3, r3[0], KK], [r3[1], GND, KK]],
    integrator: [[GEN, r1[0], O], [r1[1], P2, G], [P2, c0, Y], [c1, P6, Y], [P3, GND, KK]],
    differentiator: [[GEN, c0, O], [c1, P2, G], [P2, r1[0], Y], [r1[1], P6, Y], [P3, GND, KK]],
    comparator: [[GEN, P3, O], [V2, P2, V_]],
  }
  return [...list, ...map[id]]
}
const PLUGS = { inverting: ['Ri', 'Rf'], 'non-inverting': ['Ri', 'Rf'], adder: ['R', 'Rf'], subtractor: ['R', 'Rf'], integrator: ['R', 'C'], differentiator: ['R', 'C'] }

function signals(id, v, o) {
  if (id === 'adder') return { vin: () => v.v1 + v.v2, vout: () => o.vo, range: 12.5, inp: 'V₁ + V₂' }
  if (id === 'subtractor') return { vin: () => v.v2 - v.v1, vout: () => o.vo, range: 12.5, inp: 'V₂ − V₁' }
  if (id === 'comparator') return { vin: (u) => (v.vp / 2) * Math.sin(TAU * 3 * u), vout: (u) => ((v.vp / 2) * Math.sin(TAU * 3 * u) > v.vr ? VSAT : -VSAT), range: 12.5, inp: 'Input', ac: true }
  if (id === 'integrator' || id === 'differentiator') return { vin: (u) => (v.vp / 2) * wave(v.w, u * 3), vout: (u) => o.arr[Math.floor(((((u * 3) % 1) + 1) % 1) * 359.99)], range: Math.max(5.5, Math.max(...o.arr.map(Math.abs)) * 1.15), inp: 'Input', ac: true }
  const range = Math.max(0.6, Math.max(o.vp, o.vo) / 2) * 1.25
  return { vin: (u) => (o.vp / 2) * wave(v.w, u * 3), vout: (u) => clamp(((o.G * o.vp) / 2) * wave(v.w, u * 3), -VSAT, VSAT), range, inp: 'Input', ac: true }
}
function drawScope(g, w, h, s, t) {
  g.fillStyle = '#071410'; g.fillRect(0, 0, w, h)
  for (let i = 0; i <= 10; i++) { g.strokeStyle = i === 5 ? '#245240' : '#123428'; g.lineWidth = 1.2; const x = (i * w) / 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let i = 0; i <= 6; i++) { g.strokeStyle = i === 3 ? '#245240' : '#123428'; g.lineWidth = 1.2; const y = (i * h) / 6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) { g.fillStyle = '#FFB0A0'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('No supply to the op-amp', w / 2, h / 2 + 8); return }
  const sh = s.ac ? t * 0.14 : 0
  const line = (f, col) => { g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= w; i += 2) { const y = h / 2 - (clamp(f(i / w + sh) / s.range, -1.05, 1.05) * h) / 2.2; if (i) g.lineTo(i, y); else g.moveTo(i, y) } g.stroke() }
  line(s.vin, '#FFC14D'); line(s.vout, '#62E6C2')
  g.font = 'bold 20px Arial'; g.textAlign = 'left'
  g.fillStyle = '#FFC14D'; g.fillRect(12, 16, 22, 4); g.fillText(s.inp, 42, 26); g.fillStyle = '#62E6C2'; g.fillRect(150, 16, 22, 4); g.fillText('Output', 180, 26)
}

function drawBoard(g, W, H) {
  const k = W / B.W, X = (x) => (x - B.x0) * k, Y2 = (y) => (y - B.y0) * k
  const t = (s, x, y, z = 15, c = '#10161E', al = 'center') => { g.fillStyle = c; g.font = `bold ${(z >= 20 ? z : Math.max(z * 1.15, 16.5)) * k}px Arial`; g.textAlign = al; g.fillText(s, X(x), Y2(y)) }
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(X(x), Y2(y), w * k, h * k) }
  const line = (x1, y1, x2, y2, c = '#4A5563', lw = 2) => { g.strokeStyle = c; g.lineWidth = lw * k; g.beginPath(); g.moveTo(X(x1), Y2(y1)); g.lineTo(X(x2), Y2(y2)); g.stroke() }
  const dot = (x, y) => { g.fillStyle = '#B7BCC4'; g.beginPath(); g.arc(X(x), Y2(y), 9 * k, 0, 7); g.fill(); g.fillStyle = '#2A2E35'; g.beginPath(); g.arc(X(x), Y2(y), 5.5 * k, 0, 7); g.fill() }
  const ticks = (x, y, r = 36) => { for (let i = 0; i <= 10; i++) { const a = rad(135 - i * 27); line(x + r * Math.cos(a), y - r * Math.sin(a), x + (r + 8) * Math.cos(a), y - (r + 8) * Math.sin(a), '#555E6B', 2) } }
  g.fillStyle = '#2A2F37'; g.fillRect(0, 0, W, H); rect(90, 90, 1620, 870, '#EEF0EE')
  rect(118, 112, 1564, 48, '#223B5C'); t('OPERATIONAL AMPLIFIER TRAINER', 140, 146, 25, '#FFF', 'left'); t('Follower · Inverting · Non-inverting · Adder · Subtractor · Integrator · Differentiator · Comparator', 1660, 142, 13, '#DDE6F2', 'right')
  const sec = (x, y, w, h, s) => { g.strokeStyle = '#223B5C'; g.lineWidth = 2.4 * k; g.strokeRect(X(x), Y2(y), w * k, h * k); rect(x, y, w, 28, '#223B5C'); t(s, x + w / 2, y + 21, 15, '#FFF') }
  sec(118, 180, 470, 370, 'REGULATED POWER SUPPLY'); sec(605, 180, 420, 370, 'FUNCTION GENERATOR · 1–100 kHz · 0–5 Vpp'); sec(1042, 180, 640, 370, 'OP-AMP SECTION · µA741 × 2 (all pins on 2 mm sockets)'); sec(118, 570, 700, 290, 'PASSIVE COMPONENT BANK'); sec(835, 570, 400, 290, 'VARIABLE RESISTANCE BANK'); sec(1252, 570, 430, 290, 'BREADBOARD')
  t('FIXED DC (OUT / GND)', 353, 232, 14); ;[[175, '+12 V'], [279, '−12 V'], [385, '+5 V'], [490, '−5 V']].forEach(([x, s]) => t(s, x, 284, 16))
  line(134, 296, 572, 296, '#B6BCC5', 1.5); t('VARIABLE DC (LM317 / LM337)', 353, 320, 14)
  rect(140, 330, 150, 54, '#0D0F12'); rect(365, 330, 150, 54, '#0D0F12'); ticks(180, 432); ticks(405, 432); t('V₁  −5 … +5 V', 215, 490, 15); t('V₂  −5 … +5 V', 440, 490, 15)
  t('MAINS', 196, 526, 15, '#17202B', 'left'); t('SHORT-CIRCUIT PROTECTED', 546, 526, 13, '#17202B', 'right')
  ;[675, 795, 915].forEach((x) => ticks(x, 340)); t('RANGE ×1k/×10k', 675, 396, 14); t('FREQUENCY', 795, 396, 14); t('AMPLITUDE', 915, 396, 14); t('OUTPUT', 745, 472, 14); t('TTL / SYNC', 905, 472, 14)
  ;[['1 OFS', 295], ['2 IN−', 325], ['3 IN+', 355], ['4 −V', 385]].forEach(([s, y]) => { t(s, 1091, y + 6, 13, '#17202B', 'right'); t(s, 1368, y + 6, 13, '#17202B', 'right') })
  ;[['8 NC', 295], ['7 +V', 325], ['6 OUT', 355], ['5 OFS', 385]].forEach(([s, y]) => { t(s, 1249, y + 6, 13, '#17202B', 'left'); t(s, 1526, y + 6, 13, '#17202B', 'left') })
  t('IC 1', 1170, 436, 15); t('IC 2', 1447, 436, 15)
  g.strokeStyle = '#17202B'; g.lineWidth = 2.5 * k; g.beginPath(); g.moveTo(X(1332), Y2(448)); g.lineTo(X(1332), Y2(492)); g.lineTo(X(1382), Y2(470)); g.closePath(); g.stroke(); t('−', 1342, 464, 15); t('+', 1342, 486, 15)
  t('5 each · 1 % · ¼ W', 490, 618, 13, '#17202B', 'center'); [['1 kΩ', 630], ['10 kΩ', 682], ['100 kΩ', 734]].forEach(([s, y]) => t(s, 140, y + 5, 15, '#17202B', 'left'))
  ;[630, 682, 734].forEach((y) => { for (let c = 0; c < 5; c++) { const a = 202 + 100 * c; line(a, y, a + 76, y); dot(a, y); dot(a + 76, y) } })
  ;[[166, '1 µF/63 V'], [296, '1 nF'], [426, '10 nF'], [556, '100 nF'], [686, '1N4007']].forEach(([x, s]) => { line(x, 800, x + 68, 800); dot(x, 800); dot(x + 68, 800); t(s, x + 34, 832, 14) })
  ;[[890, '1 kΩ'], [985, '1 kΩ'], [1080, '10 kΩ'], [1175, '10 kΩ']].forEach(([x, s]) => { ticks(x, 646); t(s, x, 700, 14); [-18, 0, 18].forEach((d) => dot(x + d, 712)) })
  ;[[890, '100 kΩ'], [985, '100 kΩ'], [1080, '1 MΩ'], [1175, '1 MΩ']].forEach(([x, s]) => { ticks(x, 760); t(s, x, 816, 14); [-18, 0, 18].forEach((d) => dot(x + d, 830)) })
  rect(1268, 610, 398, 236, '#F4EEDD'); rect(1276, 726, 382, 20, '#E2D8BE'); line(1280, 618, 1654, 618, '#D42B24', 1.5); line(1280, 626, 1654, 626, '#1F62C4', 1.5); line(1280, 820, 1654, 820, '#D42B24', 1.5); line(1280, 838, 1654, 838, '#1F62C4', 1.5)
  g.fillStyle = '#3A3F47'; for (const y of [622, 830]) for (let x = 1282; x < 1650; x += 9) g.fillRect(X(x), Y2(y), 4 * k, 4 * k)
  for (const y of [650, 664, 678, 692, 706, 756, 770, 784, 798, 812]) for (let x = 1282; x < 1650; x += 9) g.fillRect(X(x), Y2(y), 4 * k, 4 * k)
  t('Modules included: electronic components · series & parallel circuits · voltage & current divider · circuit analysis · instruction manual with circuit diagrams', 120, 934, 14, '#26303C', 'left')
}
function drawWood(g, w, h) { g.fillStyle = '#6A523F'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${i % 2 ? '35,22,12' : '150,115,88'},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke() } }
function drawLed(g, w, h, text) { g.fillStyle = '#220606'; g.fillRect(0, 0, w, h); if (text === null) return; g.fillStyle = '#FF3B30'; g.font = 'bold 76px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2 - 14, h / 2 + 3); g.font = 'bold 28px Arial'; g.textAlign = 'right'; g.fillText('V', w - 10, h - 24) }
const keyArt = (kind, on) => (g, w, h) => {
  g.fillStyle = on ? '#2E7D32' : '#D7DBE0'; g.fillRect(0, 0, w, h); const c = on ? '#FFF' : '#1B2430'; g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 8; g.lineJoin = 'round'; g.beginPath()
  const y = h * 0.34, a = h * 0.17, x0 = w * 0.3, x1 = w * 0.7
  if (kind === 'sine') for (let i = 0; i <= 50; i++) { const x = x0 + ((x1 - x0) * i) / 50, yy = y - a * Math.sin((TAU * i) / 50); if (i) g.lineTo(x, yy); else g.moveTo(x, yy) }
  if (kind === 'square') { g.moveTo(x0, y + a); g.lineTo(x0, y - a); g.lineTo((x0 + x1) / 2, y - a); g.lineTo((x0 + x1) / 2, y + a); g.lineTo(x1, y + a); g.lineTo(x1, y - a) }
  if (kind === 'tri') { g.moveTo(x0, y + a); g.lineTo((x0 + x1) / 2, y - a); g.lineTo(x1, y + a) }
  g.stroke(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 40px Arial'; g.fillText(kind === 'tri' ? 'TRIANGLE' : kind.toUpperCase(), w / 2, h * 0.78)
}
const bands = (cols) => (g, w, h) => { g.fillStyle = '#D9B98A'; g.fillRect(0, 0, w, h); cols.forEach(([f, c]) => { g.fillStyle = c; g.fillRect(0, h * f, w, h * 0.09) }) }

const n = [0, Math.sin(A), Math.cos(A)]
const vw = (x, y, d) => { const [a, b] = P(x, y), t = [a, CY + b * Math.cos(A), -b * Math.sin(A)]; return { p: [t[0], t[1] + n[1] * d, t[2] + n[2] * d], t } }
const VIEWS = {
  whole: { p: [0, 1.18, 1.42], t: [0, 0.2, 0] },
  supply: vw(353, 365, 0.82), gen: vw(815, 365, 0.76), ic: vw(1170, 340, 0.58), bank: vw(468, 712, 0.86),
}

function createScene(host, id, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xeceef1, exposure: 1.05, env: 0.65, shadow: { left: -1.1, right: 1.1, top: 1, bottom: -1, far: 7 } })
  const stdM = (color, roughness = 0.42, metalness = 0.25) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const M = { black: stdM(0x17181c), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }), ic: stdM(0x131417, 0.5, 0.1), pin: new THREE.MeshStandardMaterial({ color: 0xc7ccd4, metalness: 0.9, roughness: 0.3 }), body: stdM(0x323842, 0.5, 0.35), hit: new THREE.MeshBasicMaterial({ visible: false }) }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 24) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)

  const wood = face(1024, 512, drawWood); wood.set(1); wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(2, 1)
  plain(add(box(5, 0.04, 3), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.62 }), 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xeceef1, roughness: 0.95 }), 0, 1.3, -1.4))

  /* sloped body */
  const S = new THREE.Shape([[B.L / 2, 0], [B.L / 2, 0.004], [-B.L / 2, B.h + 0.004], [-B.L / 2, 0]].map(([a, b]) => new THREE.Vector2(a, b)))
  const wedge = new THREE.ExtrudeGeometry(S, { depth: B.pw, bevelEnabled: false }); wedge.rotateY(-Math.PI / 2); wedge.translate(B.pw / 2, 0, 0)
  const body = new THREE.Mesh(wedge, M.body); body.castShadow = true; body.receiveShadow = true; scene.add(body)
  const panel = new THREE.Group(); panel.position.set(0, CY, 0); panel.rotation.x = -A; panel.translateZ(0.0012); scene.add(panel)
  const af = face(2484, 1359, drawBoard); af.set(1); af.tex.anisotropy = 12
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(B.pw, B.ph), new THREE.MeshStandardMaterial({ map: af.tex, roughness: 0.9 })))
  ;[[104, 104], [1696, 104], [104, 946], [1696, 946]].forEach(([x, y]) => { const [a, b] = P(x, y); alongZ(add(cyl(0.0065, 0.003, 16), M.chrome, a, b, 0.0015, panel)) })

  const ring = cyl(0.0098, 0.004, 20), core = cyl(0.0064, 0.0055, 16), matCore = {}
  const sock = (x, y, c = 0x24262b) => { const [a, b] = P(x, y); alongZ(add(ring, M.chrome, a, b, 0.002, panel)); matCore[c] ||= stdM(c, 0.4); alongZ(add(core, matCore[c], a, b, 0.004, panel)) }
  ;[[160, 0xd42b24], [190], [264, 0x1f62c4], [294], [370, 0xd42b24], [400], [475], [505]].forEach(([x, c]) => sock(x, 250, c))
  ;[[250, 0xd42b24], [278], [475], [503]].forEach(([x, c]) => sock(x, 430, c)); [[725, 0xe8c53a], [765], [885, 0xe8c53a], [925]].forEach(([x, c]) => sock(x, 442, c))
  const dp = (x, y, w, h) => { const f = face(380, 136, drawLed), [a, b] = P(x + w / 2, y + h / 2), m = new THREE.Mesh(new THREE.PlaneGeometry(w * K, h * K), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false })); m.position.set(a, b, 0.0006); panel.add(m); return f }
  const d1 = dp(144, 334, 142, 46), d2 = dp(369, 334, 142, 46)

  const knobs = {}
  const knob = (x, y, name, r = 0.0185) => { const [a, b] = P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g); alongZ(add(cyl(r * 1.26, 0.002, 32), M.chrome, 0, 0, 0.001, g)); alongZ(add(cyl(r, 0.016, 30), M.black, 0, 0, 0.009, g)); add(box(0.0024, r * 0.82, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.55, 0.0175, g); if (name) { alongZ(hitBox(cyl(r * 1.7, 0.04, 12), 0, 0, 0.012, name, g)); knobs[name] = g } return g }
  knob(180, 432, 'v1'); knob(405, 432, 'v2'); knob(675, 340, 'range'); knob(795, 340, 'freq'); knob(915, 340, 'ampl')
  ;[890, 985, 1080, 1175].forEach((x) => { knob(x, 646, null, 0.0165).rotation.z = rad(70); knob(x, 760, null, 0.0165).rotation.z = rad(70) })

  const wKeys = [['sine', 695], ['square', 815], ['tri', 935]].map(([kind, x]) => {
    const [a, b] = P(x, 251), w = 100 * K, h = 52 * K, g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g)
    add(box(w, h, 0.005), stdM(0xcfd3d8, 0.5, 0.1), 0, 0, 0.0025, g)
    const on = face(300, 156, keyArt(kind, true)), off = face(300, 156, keyArt(kind, false)); on.set(1); off.set(1)
    const lab = plain(add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: off.tex }), 0, 0, 0.0054, g))
    hitBox(box(w, h * 1.1, 0.02), 0, 0, 0.008, `w:${kind}`, g)
    return { kind, lab, on: on.tex, off: off.tex }
  })
  const [ra, rb] = P(156, 520); add(box(0.034, 0.024, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(box(0.016, 0.02, 0.005), stdM(0xd92b20, 0.35), ra - 0.008, rb, 0.004, panel); hitBox(box(0.06, 0.05, 0.03), ra, rb, 0.01, 'on', panel)
  const [la, lb] = P(560, 520), led = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff9a1f, toneMapped: false })); led.position.set(la, lb, 0.001); panel.add(led)

  /* ICs */
  const ic = (cx, cy, name) => {
    const [a, b] = P(cx, cy), h = 124 * K, w = 68 * K
    add(box(w, h, 0.009), M.ic, a, b, 0.0045, panel)
    add(new THREE.CircleGeometry(0.006, 16), new THREE.MeshBasicMaterial({ color: 0x3a3e45 }), a, b + h / 2 - 0.006, 0.0092, panel)
    const f = face(280, 90, (g, W2, H2) => { g.clearRect(0, 0, W2, H2); g.fillStyle = '#E8EAED'; g.font = 'bold 62px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('µA741', W2 / 2, H2 / 2) }); f.set(1)
    const lab = plain(add(new THREE.PlaneGeometry(0.052, 0.017), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), a, b - 0.004, 0.0093, panel)); lab.rotation.z = Math.PI / 2
    ;[295, 325, 355, 385].forEach((y) => { [-1, 1].forEach((s) => { const [, py] = P(cx, y); add(box(0.015, 0.0036, 0.0018), M.pin, a + s * (w / 2 + 0.006), py, 0.0028, panel); sock(cx + s * 66, y) }) })
    void name
  }
  ic(1170, 340); ic(1447, 340)

  /* components */
  const texOf = {}
  ;[[1, [[0.15, '#6B3A1E'], [0.32, '#111'], [0.49, '#C52A1E'], [0.78, '#C9A640']]], [10, [[0.15, '#6B3A1E'], [0.32, '#111'], [0.49, '#E8761E'], [0.78, '#C9A640']]], [100, [[0.15, '#6B3A1E'], [0.32, '#111'], [0.49, '#E8C53A'], [0.78, '#C9A640']]]].forEach(([k, c]) => { const f = face(64, 128, bands(c)); f.set(1); texOf[k] = new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.5 }) })
  const resG = cyl(0.0058, 0.026, 14)
  ;[[1, 630], [10, 682], [100, 734]].forEach(([k, y]) => { for (let c = 0; c < 5; c++) { const [a, b] = P(240 + 100 * c, y); alongX(add(resG, texOf[k], a, b, 0.008, panel)) } })
  const [cb1, cb2] = P(200, 800); alongX(add(cyl(0.0095, 0.03, 20), stdM(0x1565c0, 0.4), cb1, cb2, 0.011, panel))
  ;[330, 460, 590].forEach((x) => { const [a, b] = P(x, 800); alongZ(add(cyl(0.0105, 0.004, 26), stdM(0xf08c1a, 0.5, 0), a, b, 0.008, panel)) })
  const [db1, db2] = P(720, 800); alongX(add(cyl(0.005, 0.022, 14), M.black, db1, db2, 0.007, panel)); alongX(add(cyl(0.0052, 0.003, 14), M.chrome, db1 + 0.008, db2, 0.007, panel))
  /* breadboard extras */
  const [ba, bb] = P(1395, 732); add(box(0.034, 0.024, 0.006), M.ic, ba, bb, 0.003, panel)
  const [ra2, rb2] = P(1485, 698); alongX(add(cyl(0.004, 0.02, 12), new THREE.MeshStandardMaterial({ map: texOf[10].map, roughness: 0.5 }), ra2, rb2, 0.0045, panel))
  ;[[1320, 684, 1376, 684, 0x2e8b4c], [1452, 772, 1530, 772, 0xc42a26]].forEach(([x1, y1, x2, y2, c]) => { const [a, b] = P(x1, y1), [e, f] = P(x2, y2); add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(a, b, 0), V((a + e) / 2, (b + f) / 2, 0.016), V(e, f, 0)]), 20, 0.0016, 6), stdM(c, 0.5, 0), 0, 0, 0, panel) })

  /* patch cords */
  const cordG = new THREE.Group(); panel.add(cordG)
  const cordM = {}, plugG = cyl(0.0058, 0.012, 14)
  const matOf = (c) => (cordM[c] ||= stdM(c, 0.5, 0))
  const LOCAL = (x, y, z) => { const [a, b] = P(x, y); return V(a, b, z) }
  function buildCords(v) {
    cordG.children.slice().forEach((m) => { if (m.geometry !== plugG) m.geometry.dispose(); cordG.remove(m) })
    cordsFor(id, v).forEach(([a, b, c]) => {
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]), up = 0.012 + dist * K * 0.08, A2 = LOCAL(...a, 0.012), B2 = LOCAL(...b, 0.012)
      const mid = A2.clone().lerp(B2, 0.5); mid.z = up; mid.y += dist * K * 0.03
      const curve = new THREE.CatmullRomCurve3([A2, LOCAL(...a, up * 0.7), mid, LOCAL(...b, up * 0.7), B2])
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.0034, 8), matOf(c)); m.castShadow = true; cordG.add(m)
      ;[a, b].forEach((p) => { const q = new THREE.Mesh(plugG, matOf(c)); q.position.copy(LOCAL(...p, 0.012)); q.rotation.x = Math.PI / 2; cordG.add(q) })
    })
  }
  /* movable plugs and their drop zones */
  const plugPos = (k, v) => (k === 'C' ? [CAPX[v.C], 800] : [k === 'Rf' ? 302 : 202, ROW[v[k]]])
  const plugs = (PLUGS[id] || []).map((k) => { const g = new THREE.Group(); panel.add(g); add(new THREE.TorusGeometry(0.012, 0.0022, 8, 22), new THREE.MeshBasicMaterial({ color: k === 'Rf' || k === 'C' ? 0xffd45e : 0x65e0ff }), 0, 0, 0.02, g); hitBox(new THREE.SphereGeometry(0.02, 10, 8), 0, 0, 0.02, `plug:${k}`, g); return { k, g } })
  const dropKeys = new Set()
  const makeRow = (k, y) => { const [a, b] = P(440, y); hitBox(box(0.39, 0.03, 0.02), a, b, 0.012, `row:${k}`, panel); dropKeys.add(`row:${k}`) }
  if (PLUGS[id]) { [[1, 630], [10, 682], [100, 734]].forEach(([k, y]) => makeRow(k, y)); if (PLUGS[id].includes('C')) [[1, 330], [10, 460], [100, 590]].forEach(([k, x]) => { const [a, b] = P(x, 800); hitBox(box(0.06, 0.04, 0.02), a, b, 0.012, `cap:${k}`, panel); dropKeys.add(`cap:${k}`) }) }
  ;[[160, 'rp'], [264, 'rn']].forEach(([x, k]) => { const [a, b] = P(x, 250); hitBox(new THREE.SphereGeometry(0.018, 10, 8), a, b, 0.012, `rail:${k}`, panel) })
  ;[[P7, 'rp'], [P4, 'rn']].forEach(([p, k]) => { const [a, b] = P(...p); hitBox(new THREE.SphereGeometry(0.016, 10, 8), a, b, 0.012, `rail:${k}`, panel) })
  const preview = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0x4fc3ff })); preview.visible = false; panel.add(preview)

  function draw() { renderer.render(scene, camera) }
  const applyView = (name) => { const w = VIEWS[name]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3.4; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3(), el = renderer.domElement
  const facing = new THREE.Plane().setFromNormalAndCoplanarPoint(V(0, Math.sin(A), Math.cos(A)), V(0, CY, 0))
  const cast = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true) }
  const pick = (e) => cast(e).find((h) => h.object.userData.d && !dropKeys.has(h.object.userData.d))
  const pickDrop = (e) => cast(e).find((h) => dropKeys.has(h.object.userData.d))
  const Q = { v: null, drag: null, last: null, range: 0, l1: 3, l2: -3, lf: 1, la: 2 }
  const c = (k) => ctl.find((q) => q.k === k)
  const redo = () => { if (Q.last) update(...Q.last) }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d === 'on') { api.set('on', !v.on); return }
    if (d.startsWith('rail:')) { const k = d.slice(5); api.set(k, !v[k]); return }
    if (d.startsWith('w:')) { if (c('w')) api.set('w', d.slice(2)); return }
    if (d === 'range') { Q.range = Q.range ? 0 : 1; if (c('f')) api.set('f', Q.range ? Math.max(10, v.f) : Math.min(10, v.f)); redo(); return }
    if (d.startsWith('plug:')) { const k = d.slice(5), s = plugPos(k, v), [a, b] = P(...s); Q.drag = { plug: k, from: V(a, b, 0.02) }; preview.visible = true; return }
    const key = d === 'v1' ? (c('v1') ? 'v1' : null) : d === 'v2' ? (c('v2') ? 'v2' : c('vr') ? 'vr' : null) : d === 'freq' ? (c('f') ? 'f' : null) : d === 'ampl' ? (c('vp') ? 'vp' : null) : null
    Q.drag = { d, key, x: e.clientX, y: e.clientY, val: key ? v[key] : d === 'v1' ? Q.l1 : d === 'v2' ? Q.l2 : d === 'freq' ? Q.lf : Q.la }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : ['v1', 'v2', 'freq', 'ampl'].includes(d) || d.startsWith('plug:') ? 'grab' : 'pointer'; return }
    if (s.none) return
    if (s.plug) { cast(e); const p = ray.ray.intersectPlane(facing, hitP); if (p) { const q = panel.worldToLocal(p.clone()); q.z = 0.02; preview.geometry.setFromPoints([s.from, q]); draw() } return }
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (s.key) {
      const q = c(s.key)
      let span = q.max - q.min
      if (s.key === 'f') span = Q.range ? 90 : 9
      const lo = s.key === 'f' ? (Q.range ? 10 : 1) : q.min, hi = s.key === 'f' ? (Q.range ? 100 : 10) : q.max
      api.set(s.key, clamp(quant(q, s.val + (mv / 240) * span), lo, hi))
    } else {
      if (s.d === 'v1') Q.l1 = +clamp(s.val + (mv / 240) * 10, -5, 5).toFixed(1)
      if (s.d === 'v2') Q.l2 = +clamp(s.val + (mv / 240) * 10, -5, 5).toFixed(1)
      if (s.d === 'freq') Q.lf = +clamp(s.val + (mv / 240) * 99, 1, 100).toFixed(0)
      if (s.d === 'ampl') Q.la = +clamp(s.val + (mv / 240) * 5, 0, 5).toFixed(1)
      redo()
    }
  }
  const onUp = (e) => {
    const s = Q.drag
    if (s?.plug) {
      preview.visible = false
      const d = pickDrop(e)?.object.userData.d
      if (d) { const [kind, val] = d.split(':'); if ((kind === 'cap') === (s.plug === 'C')) api.set(s.plug, +val) }
      draw()
    }
    Q.drag = null; orbit.enabled = true
  }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const ang = (u) => rad(135 - clamp(u, 0, 1) * 270)
  const sgn = (x) => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(2)}`
  let sig = null
  function update(v, o, t, tc) {
    Q.last = [v, o, t, tc]; Q.v = v
    const s = `${v.rp}${v.rn}${v.R}${v.Ri}${v.Rf}${v.C}`
    if (s !== sig) { sig = s; buildCords(v) }
    plugs.forEach((q) => { const [a, b] = P(...plugPos(q.k, v)); q.g.position.set(a, b, 0) })
    const on = v.on
    const val1 = v.v1 ?? Q.l1, val2 = v.v2 ?? v.vr ?? Q.l2
    d1.set(`${val1}${on}`, on ? sgn(val1) : null); d2.set(`${val2}${on}`, on ? sgn(val2) : null)
    knobs.v1.rotation.z = ang((val1 + 5) / 10); knobs.v2.rotation.z = ang(v.vr !== undefined ? (val2 + 2.4) / 4.8 : (val2 + 5) / 10)
    const f = v.f ?? Q.lf
    if (f > 10) Q.range = 1; else if (f < 10) Q.range = 0
    knobs.range.rotation.z = ang(Q.range ? 0.85 : 0.15); knobs.freq.rotation.z = ang(Q.range ? (f - 10) / 90 : (f - 1) / 9)
    const q = c('vp'); knobs.ampl.rotation.z = ang(q ? (v.vp - q.min) / (q.max - q.min) : Q.la / 5)
    wKeys.forEach((w) => { const m = w.lab.material, tx = v.w === w.kind ? w.on : w.off; if (m.map !== tx) { m.map = tx; m.needsUpdate = true } })
    rocker.position.x = ra + (on ? -0.008 : 0.008); led.material.color.set(on ? 0xff9a1f : 0x4a2e10)
    if (tc) drawScope(tc.getContext('2d'), tc.width, tc.height, o.live ? signals(id, v, o) : null, t)
    draw()
  }
  const dispose = () => {
    ro.disconnect(); orbit.dispose()
    el.removeEventListener('pointerdown', onDown, cap); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp)
    wKeys.forEach((w) => { w.on.dispose(); w.off.dispose() })
    scene.traverse((q) => { q.geometry?.dispose(); const m = q.material; if (m) { m.map?.dispose(); m.dispose() } })
    release(); renderer.dispose(); el.remove()
  }
  applyView('whole'); size()
  return { update, dispose, applyView }
}

const LABELS = [['whole', 'Whole kit'], ['supply', 'Power supply'], ['gen', 'Generator'], ['ic', 'Op-amp'], ['bank', 'Components']]
const hintFor = (id) => {
  if (PLUGS[id]) return `Drag a ringed plug to another resistor${PLUGS[id].includes('C') ? ' or capacitor' : ''} row to change the value, and use the generator or V₁ and V₂ knobs for the input.`
  if (id === 'comparator') return 'Turn V₂ to move the reference and AMPLITUDE to change the input.'
  return 'Turn FREQUENCY and AMPLITUDE and press a waveform key to change the input.'
}

function make(exp) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({}), tr = useRef(null)
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, exp.id, exp.controls, { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t, tr.current) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
          <div className="trace-view low"><canvas ref={tr} width={520} height={260} aria-label="Input and output waveforms" role="img" /><span>Oscilloscope: input and output</span></div>
        </div>
        <p className="stage3d-hint">{hintFor(exp.id)} Click a +12 V or −12 V socket to pull its supply cord. Drag the background to look around.</p>
      </div>
    )
  }
}

export const opAmp3D = opAmp.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ on: true, rp: true, rn: true }),
  out: (v, t) => ({ ...e.out(v, t), live: v.on && v.rp && v.rn }),
  read: (v, o) => (o.live ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
  sample: (v, o) => {
    if (!v.on) return { error: 'The trainer is off. Press MAINS.' }
    if (!v.rp || !v.rn) return { error: 'The op-amp has no supply. Click the +12 V and −12 V sockets to plug the cords in.' }
    return e.sample(v, o)
  },
  Stage: make(e),
}))
