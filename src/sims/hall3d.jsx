import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { hallKit } from './magnetism'
import { createStudio, face, quant } from './studio3d'

/* The Hall effect kit as a working 3D model: electromagnet, Ge crystal with oven in the pole gap,
   InAs probe on its stand, and the three instruments. Metres. The field runs along x. */

const K = 0.00095, GAP_Y = 0.185, GAP_Z = 0.1, SHELF = 0.12, ROOM_T = 30
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const INST = {
  gauss: { x0: 128, y0: 308, W: 384, H: 214, wx: -0.56 },
  meas: { x0: 553, y0: 308, W: 624, H: 214, wx: -0.015 },
  supply: { x0: 1218, y0: 308, W: 454, H: 214, wx: 0.565 },
}
const INST_Z = -0.42, S = 2.5 // canvas pixels per picture pixel

/* ---- panel artwork, in the coordinates of the reference picture ---- */
const art = (cfg, paint) => (g, w, h) => {
  g.fillStyle = '#F1F3F6'; g.fillRect(0, 0, w, h)
  const X = (x) => (x - cfg.x0) * S, Y = (y) => (y - cfg.y0) * S
  const text = (t, x, y, size = 11, bold = true, col = '#1F2B3A', al = 'center') => { g.fillStyle = col; g.font = `${bold ? 'bold ' : ''}${size * S}px Arial`; g.textAlign = al; g.fillText(t, X(x), Y(y)) }
  const well = (a, b, c, d, col = '#0C0D10') => { g.fillStyle = col; g.fillRect(X(a), Y(b), (c - a) * S, (d - b) * S) }
  paint({ text, well, X, Y, g })
}
const paintGauss = ({ text, well }) => {
  text('DIGITAL GAUSS & TESLA METER', 320, 328, 12.5, true, '#1D3F66'); well(150, 344, 490, 414)
  text('RANGE', 190, 494); text('ZERO', 270, 494); text('InAs PROBE', 420, 494); text('USB', 466, 481, 9, false)
}
const paintMeas = ({ text, well }) => {
  text('HALL EFFECT MEASUREMENT UNIT', 865, 328, 12.5, true, '#1D3F66')
  well(571, 344, 759, 410); well(771, 344, 959, 410); well(971, 344, 1159, 410)
  text('PROBE CURRENT', 865, 427, 10); text('TEMPERATURE', 1065, 427, 10)
  text('PROBE I', 605, 504, 10); text('HEATER I', 695, 504, 10); text('HALL PROBE', 965, 496, 9); text('OVEN', 1035, 496, 9); text('PT100', 1105, 496, 9)
}
const paintSupply = ({ text, well }) => {
  text('CONSTANT CURRENT POWER SUPPLY', 1445, 328, 12.5, true, '#1D3F66'); well(1236, 344, 1536, 426)
  text('16 x 2 LCD', 1386, 440, 9, false, '#555'); text('CURRENT', 1590, 418, 10); text('COARSE', 1280, 512, 10); text('FINE', 1360, 512, 10); text('OUTPUT 0–3.5 A', 1490, 512, 10)
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '-': 'g' }
function redDisplay(g, w, h, text, unit, label) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  const s = 34, step = 62, n = text.replace('.', '').length
  let x = w - 110 - n * step + 22
  g.lineCap = 'round'; g.lineWidth = 7.5
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - 14, 34 + s * 2, 5, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, 34 + p[1] * s); g.lineTo(x + p[2] * s, 34 + p[3] * s); g.stroke() })
    x += step
  })
  g.fillStyle = '#FF6B5E'; g.font = 'bold 24px Arial'; g.textAlign = 'right'; g.fillText(unit, w - 14, h - 22)
  if (label) { g.textAlign = 'left'; g.font = 'bold 18px Arial'; g.fillText(label, 12, 26) }
}
function gaussLcd(g, w, h, value, unit, dir) {
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#8AD0F5'); bg.addColorStop(1, '#4FA4DC'); g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.fillStyle = '#10283F'; g.textAlign = 'left'; g.font = 'bold 22px Arial'; g.fillText(dir, 18, 34)
  g.textAlign = 'right'; g.font = 'bold 84px Consolas, monospace'; g.fillText(value, w - 118, h - 48)
  g.font = 'bold 32px Arial'; g.fillText(unit, w - 18, h - 54)
}
function greenLcd(g, w, h, lines, on) {
  g.fillStyle = on ? '#A9D44A' : '#3F5A1E'; g.fillRect(0, 0, w, h)
  if (!on) return
  g.fillStyle = '#17260A'; g.textAlign = 'left'; g.font = 'bold 46px Consolas, monospace'; lines.forEach((l, i) => g.fillText(l, 24, 62 + i * 66))
}
function coilTex(g, w, h) {
  const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, '#5E2412'); b.addColorStop(0.5, '#E08A5E'); b.addColorStop(1, '#5A1E0E'); g.fillStyle = b; g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(40,12,4,.32)'; g.lineWidth = 2; for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
}
const label = (t, size, col = '#E9EBEF') => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) }

const VIEWS = {
  whole: { p: [0, 0.66, 1.66], t: [0, 0.18, -0.1] },
  magnet: { p: [0.12, 0.34, 0.92], t: [0, 0.17, 0.1] },
  gauss: { p: [-0.54, 0.72, 0.16], t: [INST.gauss.wx, 0.24, INST_Z] },
  meas: { p: [-0.015, 0.86, 0.3], t: [INST.meas.wx, 0.24, INST_Z] },
  supply: { p: [0.56, 0.72, 0.16], t: [INST.supply.wx, 0.24, INST_Z] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xdfe2e4, exposure: 1, env: 0.55, shadow: { left: -1.2, right: 1.2, top: 1, bottom: -1, far: 7 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0x38414b, roughness: 0.74 }),
    shelf: new THREE.MeshStandardMaterial({ color: 0x565f69, roughness: 0.65 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3e444d, roughness: 0.48, metalness: 0.5 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xe0ba5c, metalness: 0.9, roughness: 0.3 }),
    pole: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.28 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x29507c, roughness: 0.45, metalness: 0.25 }),
    lid: new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.45, metalness: 0.25 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x1a7a45, roughness: 0.55 }),
    oven: new THREE.MeshStandardMaterial({ color: 0xc66a1e, roughness: 0.5 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }

  plain(add(box(4.6, 0.04, 2.6), M.table, 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xe0e2e4, roughness: 0.95 }), 0, 1.3, -1.25))
  add(box(1.8, SHELF, 0.32), M.shelf, 0, SHELF / 2, INST_Z)

  /* instruments */
  const instrument = (cfg, paint) => {
    const g = new THREE.Group(); g.position.set(cfg.wx, SHELF, INST_Z); scene.add(g)
    const w = cfg.W * K, h = cfg.H * K
    add(box(w + 0.02, h + 0.024, 0.2), M.blue, 0, (h + 0.024) / 2, 0, g)
    add(box((w + 0.02) * 0.94, 0.012, 0.18), M.lid, 0, h + 0.03, 0, g)
    const panel = new THREE.Group(); panel.position.set(0, (h + 0.024) / 2, 0.101); g.add(panel)
    const tex = face(cfg.W * S, cfg.H * S, art(cfg, paint)); tex.set(1)
    panel.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex.tex, roughness: 0.55 })))
    const P = (px, py) => [(px - (cfg.x0 + cfg.W / 2)) * K, ((cfg.y0 + cfg.H / 2) - py) * K]
    return { panel, P }
  }
  const G = instrument(INST.gauss, paintGauss), U = instrument(INST.meas, paintMeas), C = instrument(INST.supply, paintSupply)
  const screen = (inst, x1, y1, x2, y2, tw, th, draw) => {
    const f = face(tw, th, draw), [a, b] = inst.P((x1 + x2) / 2, (y1 + y2) / 2)
    const m = new THREE.Mesh(new THREE.PlaneGeometry((x2 - x1) * K, (y2 - y1) * K), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false, transparent: true })); m.position.set(a, b, 0.0006); inst.panel.add(m)
    return f
  }
  const gaussF = screen(G, 156, 350, 484, 408, 656, 116, gaussLcd)
  const vhF = screen(U, 577, 350, 753, 404, 400, 122, redDisplay), ipF = screen(U, 777, 350, 953, 404, 400, 122, redDisplay), tempF = screen(U, 977, 350, 1153, 404, 400, 122, redDisplay)
  const supplyF = screen(C, 1244, 352, 1528, 418, 568, 132, greenLcd)
  const vhLabel = screen(U, 600, 415, 730, 431, 260, 32, (g, w, h, t) => { g.clearRect(0, 0, w, h); g.fillStyle = '#1F2B3A'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) })
  vhLabel.tex.minFilter = THREE.LinearFilter

  const knob = (inst, px, py, name, r = 0.0165) => {
    const [a, b] = inst.P(px, py), g = new THREE.Group(); g.position.set(a, b, 0); inst.panel.add(g)
    const ring = add(cyl(r * 1.32, 0.002, 32), M.chrome, 0, 0, 0.001, g); ring.rotation.x = Math.PI / 2
    const k = add(cyl(r, 0.016, 28), M.black, 0, 0, 0.009, g); k.rotation.x = Math.PI / 2
    add(box(0.0022, r * 0.8, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.55, 0.0175, g)
    hitBox(new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.04, 12), 0, 0, 0.012, name, g).rotation.x = Math.PI / 2
    return g
  }
  const key = (inst, px, py, w, h, text, name) => {
    const [a, b] = inst.P(px, py), f = face(w * 3, h * 3, label(text, 30, '#26303C'))
    f.set(1)
    add(box(w * K, h * K, 0.004), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5 }), a, b, 0.002, inst.panel)
    plain(add(new THREE.PlaneGeometry(w * K, h * K), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), a, b, 0.0042, inst.panel))
    hitBox(box(w * K * 1.1, h * K * 1.3, 0.02), a, b, 0.008, name, inst.panel)
  }
  const sock = (inst, px, py, col) => {
    const [a, b] = inst.P(px, py)
    alongZ(add(cyl(0.012, 0.004, 22), M.chrome, a, b, 0.002, inst.panel))
    alongZ(add(cyl(0.0075, 0.006, 18), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), a, b, 0.004, inst.panel))
    return inst.panel.localToWorld(new THREE.Vector3(a, b, 0.012))
  }
  const kn = { range: knob(G, 190, 460, 'range'), zero: knob(G, 270, 460, 'gz'), ip: knob(U, 605, 470, 'Ip'), heat: knob(U, 695, 470, 'T'), cur: knob(C, 1590, 380, 'Imc', 0.021), coarse: knob(C, 1280, 478, 'Imc'), fine: knob(C, 1360, 478, 'Imf') }
  key(G, 348, 459, 56, 26, 'G / T', 'gt'); key(U, 780, 467, 70, 30, 'VH / VR', 'vr'); key(U, 870, 467, 70, 30, 'OVEN ON', 'oven')
  const [ovx, ovy] = U.P(920, 466)
  const ovenLed = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 14, 10), new THREE.MeshBasicMaterial({ color: 0x5a3a10, toneMapped: false })); ovenLed.position.set(ovx, ovy, 0.002); U.panel.add(ovenLed)
  const [ra, rb] = C.P(1602, 476)
  add(box(0.04, 0.03, 0.003), M.black, ra, rb, 0.0015, C.panel)
  const rocker = add(box(0.018, 0.024, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.009, rb, 0.004, C.panel)
  hitBox(box(0.06, 0.05, 0.03), ra, rb, 0.01, 'pwr', C.panel)

  scene.updateMatrixWorld(true)
  const pProbe = sock(G, 420, 458, 0x17181c)
  const pHall = sock(U, 965, 466, 0x17181c), pOven = sock(U, 1035, 466, 0x17181c), pPT = sock(U, 1105, 466, 0x17181c)
  const pOutR = sock(C, 1460, 478, 0xd92b20), pOutB = sock(C, 1520, 478, 0x15161a)
  ;[[1460, 478, 'rev'], [1520, 478, 'rev']].forEach(([x, y, d]) => { const [a, b] = C.P(x, y); hitBox(new THREE.SphereGeometry(0.022, 10, 8), a, b, 0.012, d, C.panel) })

  /* electromagnet */
  add(box(0.62, 0.07, 0.22), M.iron, 0, 0.035, GAP_Z)
  const baseLabel = face(900, 60, label('ELECTROMAGNET · 3.5 A @ 20 V', 34)); baseLabel.set(1)
  plain(add(new THREE.PlaneGeometry(0.36, 0.024), new THREE.MeshBasicMaterial({ map: baseLabel.tex, transparent: true }), 0, 0.035, GAP_Z + 0.111))
  const coilF = face(512, 256, coilTex); coilF.set(1)
  coilF.tex.wrapS = THREE.RepeatWrapping
  ;[-1, 1].forEach((sg, i) => {
    add(box(0.075, 0.26, 0.11), M.iron, sg * 0.25, 0.2, GAP_Z)
    const c = alongX(add(cyl(0.092, 0.125, 56), new THREE.MeshStandardMaterial({ map: coilF.tex, roughness: 0.5, metalness: 0.4 }), sg * 0.14, GAP_Y, GAP_Z))
    c.material.map.rotation = 0
    ;[-0.066, 0.066].forEach((dx) => alongX(add(cyl(0.104, 0.006, 56), M.black, sg * 0.14 + dx, GAP_Y, GAP_Z)))
    const f = face(320, 64, label(`COIL ${i + 1} · 5 Ω`, 34)); f.set(1)
    plain(add(new THREE.PlaneGeometry(0.1, 0.02), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), sg * 0.14, GAP_Y - 0.05, GAP_Z + 0.0925))
    alongX(add(cyl(0.024, 0.2, 32), M.pole, sg * 0.17, GAP_Y, GAP_Z))
    add(new THREE.CylinderGeometry(0.0125, 0.024, 0.03, 32), M.pole, sg * 0.055, GAP_Y, GAP_Z).rotation.z = sg * Math.PI / 2
    alongX(add(cyl(0.022, 0.012, 24), M.black, sg * 0.294, GAP_Y, GAP_Z))
    for (let k = 0; k < 3; k++) { const m = add(box(0.004, 0.04, 0.006), M.chrome, sg * 0.302, GAP_Y, GAP_Z); m.rotation.x = (k * Math.PI) / 3 }
    ;[-0.018, 0.018].forEach((dz) => add(cyl(0.005, 0.03, 12), M.brass, sg * 0.14, GAP_Y + 0.108, GAP_Z + dz))
  })

  /* crystal holder on the right-hand stand */
  add(box(0.16, 0.022, 0.1), M.iron, 0.48, 0.011, GAP_Z + 0.05)
  add(cyl(0.007, 0.36, 18), M.chrome, 0.48, 0.2, GAP_Z + 0.05)
  add(box(0.03, 0.03, 0.03), M.black, 0.48, 0.34, GAP_Z + 0.05)
  const arm = alongX(add(cyl(0.005, 0.48, 14), M.chrome, 0.24, 0.34, GAP_Z + 0.05))
  void arm
  alongZ(add(cyl(0.005, 0.05, 12), M.chrome, 0, 0.34, GAP_Z + 0.025))
  add(cyl(0.004, 0.14, 12), M.chrome, 0, 0.27, GAP_Z)
  add(box(0.012, 0.012, 0.02), M.oven, 0, 0.222, GAP_Z)
  add(box(0.0035, 0.05, 0.02), M.pcb, 0, GAP_Y + 0.005, GAP_Z)
  add(box(0.0042, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.3, metalness: 0.6 }), 0, GAP_Y + 0.003, GAP_Z)

  /* InAs probe on its stand: swings between stored and in-gap positions */
  const probe = new THREE.Group(); scene.add(probe)
  add(box(0.14, 0.022, 0.1), M.iron, 0, 0.011, 0, probe)
  add(cyl(0.007, GAP_Y - 0.02, 16), M.chrome, 0, (GAP_Y - 0.02) / 2 + 0.02, 0, probe)
  add(box(0.03, 0.03, 0.03), M.black, 0, GAP_Y, 0, probe)
  const wand = add(box(0.24, 0.005, 0.02), new THREE.MeshStandardMaterial({ color: 0xe9ecf0, roughness: 0.5 }), 0.135, GAP_Y, 0, probe)
  void wand
  hitBox(box(0.28, 0.06, 0.06), 0.13, GAP_Y, 0, 'probe', probe)
  hitBox(box(0.07, GAP_Y + 0.03, 0.07), 0, GAP_Y / 2, 0, 'probe', probe)

  /* field drawn as moving dots across the gap */
  const fieldMat = new THREE.MeshBasicMaterial({ color: 0x2f7df6, transparent: true, depthWrite: false })
  const dots = Array.from({ length: 40 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 6), fieldMat)
    const a = i * 2.399, r = 0.012 * Math.sqrt((i % 8 + 1) / 8)
    m.userData.y = GAP_Y + Math.sin(a) * r; m.userData.z = GAP_Z + Math.cos(a) * r; m.userData.ph = (i * 0.37) % 1
    m.visible = false; scene.add(m); return m
  })

  /* cables */
  const tube = (pts, col, r = 0.0032) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, r, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }), 0, 0, 0)
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const tR = V(0.14, GAP_Y + 0.12, GAP_Z + 0.018), tB = V(-0.14, GAP_Y + 0.12, GAP_Z - 0.018)
  tube([tR, V(0.2, 0.36, -0.05), V(pOutR.x - 0.05, 0.3, pOutR.z + 0.12), pOutR], 0xc22a26)
  tube([tB, V(0.1, 0.38, -0.08), V(pOutB.x - 0.04, 0.27, pOutB.z + 0.14), pOutB], 0x101114)
  const top = V(0, 0.335, GAP_Z)
  tube([top, V(0.0, 0.42, -0.1), V(pHall.x, 0.31, pHall.z + 0.12), pHall], 0x101114, 0.003)
  tube([top, V(0.03, 0.4, -0.08), V(pOven.x, 0.3, pOven.z + 0.12), pOven], 0x6b3010, 0.003)
  tube([top, V(0.06, 0.38, -0.05), V(pPT.x, 0.29, pPT.z + 0.12), pPT], 0x2a5a90, 0.003)
  const probeCable = tube([pProbe, pProbe.clone().add(V(0, 0, 0.1)), V(0, 0.1, 0.1), V(0.01, 0.05, 0.1)], 0x101114, 0.003)

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3.2; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  /* pointer */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement
  const pick = (e) => {
    const r = el.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d)
  }
  const Q = { v: null, drag: null, pose: null, probeT: null }
  const c = (k) => ctl.find((x) => x.k === k)
  const TOGGLE = { gt: 'gt', vr: 'vr', oven: 'oven', pwr: 'pwr', range: 'wide', probe: 'probeIn' }
  const usable = (d) => {
    if (d === 'rev') return !!c('rev')
    if (d === 'Imc' || d === 'Imf') return !!c('Im')
    if (d === 'Ip' || d === 'T') return !!c(d)
    return true
  }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d || !usable(d)) return
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    if (d === 'rev') { api.set('rev', !Q.v.rev); Q.drag = { none: true }; return }
    if (TOGGLE[d]) { api.set(TOGGLE[d], !Q.v[TOGGLE[d]]); Q.drag = { none: true }; return }
    Q.drag = { d, x: e.clientX, y: e.clientY, Im: Q.v.Im, Ip: Q.v.Ip, T: Q.v.T, gz: Q.v.gz }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d || !usable(d) ? 'move' : TOGGLE[d] || d === 'rev' ? 'pointer' : 'grab'; return }
    if (s.none) return
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (s.d === 'gz') api.set('gz', +clamp(s.gz + mv / 200, -1, 1).toFixed(3))
    if (s.d === 'Imc' || s.d === 'Imf') { const q = c('Im'); api.set('Im', quant(q, s.Im + (mv / (s.d === 'Imf' ? 2400 : 240)) * (q.max - q.min))) }
    if (s.d === 'Ip' || s.d === 'T') { const q = c(s.d); api.set(s.d, quant(q, s[s.d] + (mv / 240) * (q.max - q.min))) }
  }
  const onUp = () => { Q.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const POSES = { out: { x: -0.46, z: GAP_Z + 0.2, ry: 0 }, in: { x: 0, z: GAP_Z + 0.28, ry: Math.PI / 2 } }
  const setProbe = (inn, immediate) => {
    if (Q.pose === inn && !immediate) return
    Q.pose = inn
    const p = inn ? POSES.in : POSES.out
    probe.position.set(p.x, 0, p.z); probe.rotation.y = p.ry
    probe.updateMatrixWorld(true)
    const base = probe.localToWorld(V(0, 0.06, 0.02))
    probeCable.geometry.dispose()
    probeCable.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([pProbe, pProbe.clone().add(V(0, -0.05, 0.1)), V((pProbe.x + base.x) / 2, 0.02, (pProbe.z + base.z) / 2 + 0.08), V(base.x, 0.02, base.z + 0.04), base]), 80, 0.003, 8)
  }
  const fmtGauss = (v, o) => {
    if (!v.probeIn) return { value: '0.00', unit: v.gt ? 'T' : 'kG', dir: '' }
    const off = v.gz * 0.5, kG = Math.abs(o.B) * 10 + off, full = v.wide ? 20 : 2
    return { value: kG > full ? '1' : v.gt ? (kG / 10).toFixed(3) : kG.toFixed(2), unit: v.gt ? 'T' : 'kG', dir: Math.abs(o.B) < 1e-4 ? '' : o.B > 0 ? '▲ N' : '▼ S' }
  }
  function update(v, o, t) {
    Q.v = v
    setProbe(v.probeIn)
    const g = fmtGauss(v, o), Im = (v.Im ?? 2) * (v.pwr ? 1 : 0), Ip = v.Ip ?? 5, T = v.oven ? (v.T ?? ROOM_T) : ROOM_T
    gaussF.set(`${g.value}${g.unit}${g.dir}`, g.value, g.unit, g.dir)
    const vr = Ip * 80
    vhF.set(`${v.vr}${o.VH.toFixed(1)}`, (v.vr ? vr : Math.abs(o.VH)).toFixed(1).padStart(4, '0'), 'mV', v.vr ? '' : o.VH < 0 ? '−' : '')
    vhLabel.set(v.vr ? 'VR' : 'HALL VOLTAGE', v.vr ? 'SAMPLE VOLTAGE VR' : 'HALL VOLTAGE')
    ipF.set(Ip.toFixed(2), Ip.toFixed(2), 'mA'); tempF.set(T.toFixed(1), T.toFixed(1), '°C')
    const l1 = `I : ${Im.toFixed(2)} A CC`, l2 = `V : ${(Im * 5).toFixed(1)} V ${v.pwr ? 'OUT' : 'OFF'}`
    supplyF.set(`${l1}${l2}${v.pwr}`, [l1, l2], v.pwr)
    rocker.position.x = ra + (v.pwr ? -0.009 : 0.009)
    ovenLed.material.color.set(v.oven ? 0xffb030 : 0x5a3a10)
    const ang = (u) => rad(135 - clamp(u, 0, 1) * 270), val = (k, x) => { const q = c(k); return q ? (x - q.min) / (q.max - q.min) : 0.3 }
    kn.range.rotation.z = rad(v.wide ? -60 : 60); kn.zero.rotation.z = ang((v.gz + 1) / 2)
    kn.ip.rotation.z = ang(val('Ip', Ip)); kn.heat.rotation.z = ang(val('T', v.T ?? ROOM_T))
    const uI = val('Im', v.Im ?? 2); kn.cur.rotation.z = ang(uI); kn.coarse.rotation.z = ang(uI); kn.fine.rotation.z = ang((uI * 10) % 1)
    const f = Math.abs(o.B), dir = o.B >= 0 ? 1 : -1
    dots.forEach((m) => {
      m.visible = f > 0.02
      if (!m.visible) return
      const u = (m.userData.ph + t * 0.45) % 1
      m.position.set(dir * (-0.04 + 0.08 * u), m.userData.y, m.userData.z)
    })
    fieldMat.opacity = clamp(0.2 + f, 0.2, 1)
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

const LABELS = [['whole', 'Whole kit'], ['magnet', 'Electromagnet'], ['gauss', 'Gauss meter'], ['meas', 'Measurement unit'], ['supply', 'Power supply']]

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
        <p className="stage3d-hint">Open an instrument with the buttons above, then turn its knobs and press its keys. Click the white probe to move it into or out of the pole gap. Click an OUTPUT socket on the supply to reverse the magnet current. Drag the background to look around.</p>
      </div>
    )
  }
}

const NEEDS_PROBE = new Set(['magnetic-field', 'magnet-poles'])
export const hall3D = hallKit.map((e) => {
  const probe = NEEDS_PROBE.has(e.id)
  return {
    ...e,
    wide: true,
    state: () => ({ pwr: true, oven: true, probeIn: probe, gt: false, wide: true, gz: 0, vr: false }),
    out: (v, t) => e.out({ ...v, ...(v.pwr ? {} : { Im: 0 }), ...(v.oven ? {} : { T: ROOM_T }) }, t),
    sample: (v, o) => {
      if (!v.pwr) return { error: 'The constant current supply is off. Press its power switch.' }
      if (probe && !v.probeIn) return { error: 'Move the InAs probe into the pole gap first.' }
      if (probe && Math.abs(v.gz) > 0.04) return { error: 'Set the ZERO knob on the Gauss meter back to centre.' }
      if (e.id === 'rh-vs-temperature' && !v.oven) return { error: 'Turn the oven on first.' }
      return e.sample(v, o)
    },
    Stage: make(e),
  }
})
