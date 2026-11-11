import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { quincke } from './magnetism'
import { tog } from '../lib/math'
import { createStudio, face, quant } from './studio3d'

/* Quincke's kit as a working 3D model: electromagnet with flat poles, U-tube with its narrow limb
   in the pole gap, travelling microscope, supply and Gauss meter. Metres. */

const K = 0.00095, GAP_Y = 0.185, GAP_Z = 0.1, SHELF = 0.12, INST_Z = -0.42, S = 2.5
const REST_Y = 0.19, WIDE = [-0.2, 0.42], ZERO_MM = 20, FIELD = 180, TOL = 0.03
const INST = { supply: { x0: 128, y0: 308, W: 504, H: 214, wx: -0.58 }, gauss: { x0: 1248, y0: 308, W: 424, H: 214, wx: 0.58 } }
const VIS = { mag: 0.03, surface: 0.003 } // metres on the model per mm of rise
const PPM = { mag: 90, surface: 30 } // eyepiece pixels per mm
const SCOPE_POS = [0.5, 0.44], SCOPE_RY = -0.597
const COLS = { fe: 0x6fbf7a, ni: 0x58b4a6, water: 0xa9d7ef, eth: 0xc7e4f0 }
const BOTTLES = { mag: [['fe', 'FERROUS', 'SULPHATE'], ['ni', 'NICKEL AMM.', 'SULPHATE']], surface: [['water', 'DISTILLED', 'WATER'], ['eth', 'ETHANOL', '']] }
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

const art = (c, paint) => (g, w, h) => {
  g.fillStyle = '#F1F3F6'; g.fillRect(0, 0, w, h)
  const X = (x) => (x - c.x0) * S, Y = (y) => (y - c.y0) * S
  paint((t, x, y, s = 10.5, bold = true, col = '#1F2B3A') => { g.fillStyle = col; g.font = `${bold ? 'bold ' : ''}${s * S}px Arial`; g.textAlign = 'center'; g.fillText(t, X(x), Y(y)) }, (a, b, c2, d) => { g.fillStyle = '#0C0D10'; g.fillRect(X(a), Y(b), (c2 - a) * S, (d - b) * S) })
}
const paintSupply = (t, well) => { t('CONSTANT CURRENT POWER SUPPLY', 380, 328, 12.5, true, '#1D3F66'); well(150, 344, 450, 418); t('DIGITAL CURRENT METER', 300, 436, 10); t('CURRENT', 520, 426, 10); t('COARSE', 190, 520, 10); t('FINE', 270, 520, 10); t('OUTPUT 32 V / 4 A', 410, 516, 9.5) }
const paintGauss = (t, well) => { t('DIGITAL GAUSS METER', 1460, 328, 12.5, true, '#1D3F66'); well(1270, 344, 1650, 418); t('AUTO-RANGING · 0-20 kG', 1460, 436, 10); t('ZERO', 1310, 520, 10); t('PROBE', 1500, 512, 9.5) }
function lcd(g, w, h, top, big, unit, bg) {
  const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, bg[0]); b.addColorStop(1, bg[1]); g.fillStyle = b; g.fillRect(0, 0, w, h)
  g.fillStyle = '#13240E'; g.font = 'bold 22px Arial'; g.textAlign = 'left'; g.fillText(top, 16, 32)
  if (big === null) return
  g.textAlign = 'right'; g.font = 'bold 92px Consolas, monospace'; g.fillText(big, w - 110, h - 34); g.font = 'bold 34px Arial'; g.fillText(unit, w - 18, h - 38)
}
const lcdGreen = (g, w, h, big) => lcd(g, w, h, '', big, 'A', ['#B9DE58', '#9CC63E'])
const lcdBlue = (g, w, h, big, unit, tag) => lcd(g, w, h, tag, big, unit, ['#8AD0F5', '#4FA4DC'])
function coilTex(g, w, h) { const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, '#5E2412'); b.addColorStop(0.5, '#E08A5E'); b.addColorStop(1, '#5A1E0E'); g.fillStyle = b; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,12,4,.32)'; g.lineWidth = 2; for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() } }
const label = (t, size, col) => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) }
const drawReadout = (g, w, h, txt) => { g.fillStyle = '#C9D8A6'; g.fillRect(0, 0, w, h); g.fillStyle = '#17260A'; g.textAlign = 'right'; g.font = 'bold 80px Consolas, monospace'; g.fillText(txt, w - 20, 92); g.font = '24px Arial'; g.textAlign = 'center'; g.fillText('mm · LC 0.01', w / 2, 134) }
const drawBottle = (g, w, h, a, b2) => { g.fillStyle = '#FBF8EF'; g.fillRect(0, 0, w, h); g.fillStyle = '#1C1C1C'; g.textAlign = 'center'; g.font = 'bold 34px Arial'; g.fillText(a, w / 2, 70); g.fillText(b2, w / 2, 116) }

function paintField(cv, offsetPx, col) {
  const g = cv.getContext('2d'), w = FIELD
  g.fillStyle = '#EDF3F7'; g.fillRect(0, 0, w, w)
  const y = w / 2 + offsetPx, a = 50, b = 130
  g.fillStyle = col; g.beginPath(); g.moveTo(a, y - 16); g.quadraticCurveTo(w / 2, y + 16, b, y - 16); g.lineTo(b, w); g.lineTo(a, w); g.closePath(); g.fill()
  g.fillStyle = '#9FB2C2'; g.fillRect(a - 8, 0, 8, w); g.fillRect(b, 0, 8, w)
  g.strokeStyle = '#000'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, w / 2); g.lineTo(w, w / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, w); g.stroke()
}

const VIEWS = {
  whole: { p: [0, 0.68, 1.9], t: [0, 0.18, 0.04] },
  magnet: { p: [-0.1, 0.32, 0.86], t: [-0.03, 0.17, 0.12] },
  scope: { p: [0.62, 0.34, 0.94], t: [0.42, 0.2, 0.36] },
  supply: { p: [-0.57, 0.72, 0.16], t: [INST.supply.wx, 0.24, INST_Z] },
  gauss: { p: [0.58, 0.72, 0.16], t: [INST.gauss.wx, 0.24, INST_Z] },
}

function createScene(host, kind, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xdfe2e4, exposure: 1, env: 0.55, shadow: { left: -1.2, right: 1.2, top: 1, bottom: -1, far: 7 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0x38414b, roughness: 0.74 }), shelf: new THREE.MeshStandardMaterial({ color: 0x565f69, roughness: 0.65 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3e444d, roughness: 0.48, metalness: 0.5 }), black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }), brass: new THREE.MeshStandardMaterial({ color: 0xe0ba5c, metalness: 0.9, roughness: 0.3 }),
    pole: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.28 }), blue: new THREE.MeshStandardMaterial({ color: 0x29507c, roughness: 0.45, metalness: 0.25 }), lid: new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.45, metalness: 0.25 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0f8, transparent: true, opacity: 0.2, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    liquid: new THREE.MeshBasicMaterial({ color: COLS.fe, transparent: true, opacity: 0.82, depthWrite: false }), acrylic: new THREE.MeshPhysicalMaterial({ color: 0xcfdde4, transparent: true, opacity: 0.45, roughness: 0.12 }),
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

  plain(add(box(4.6, 0.04, 2.6), M.table, 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xe0e2e4, roughness: 0.95 }), 0, 1.3, -1.25))
  add(box(1.8, SHELF, 0.32), M.shelf, 0, SHELF / 2, INST_Z)

  const instrument = (c, paint) => {
    const g = new THREE.Group(); g.position.set(c.wx, SHELF, INST_Z); scene.add(g)
    const w = c.W * K, h = c.H * K
    add(box(w + 0.02, h + 0.024, 0.2), M.blue, 0, (h + 0.024) / 2, 0, g); add(box((w + 0.02) * 0.94, 0.012, 0.18), M.lid, 0, h + 0.03, 0, g)
    const panel = new THREE.Group(); panel.position.set(0, (h + 0.024) / 2, 0.101); g.add(panel)
    const f = face(c.W * S, c.H * S, art(c, paint)); f.set(1)
    panel.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.55 })))
    return { panel, P: (x, y) => [(x - (c.x0 + c.W / 2)) * K, ((c.y0 + c.H / 2) - y) * K] }
  }
  const A = instrument(INST.supply, paintSupply), G = instrument(INST.gauss, paintGauss)
  const screen = (I, x1, y1, x2, y2, tw, th, draw) => { const f = face(tw, th, draw), [a, b] = I.P((x1 + x2) / 2, (y1 + y2) / 2), m = new THREE.Mesh(new THREE.PlaneGeometry((x2 - x1) * K, (y2 - y1) * K), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false })); m.position.set(a, b, 0.0006); I.panel.add(m); return f }
  const ampF = screen(A, 156, 350, 444, 412, 576, 124, lcdGreen), gaussF = screen(G, 1276, 350, 1644, 412, 736, 124, lcdBlue)
  const knob = (I, x, y, name, r = 0.0165) => {
    const [a, b] = I.P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); I.panel.add(g)
    alongZ(add(cyl(r * 1.32, 0.002, 32), M.chrome, 0, 0, 0.001, g)); alongZ(add(cyl(r, 0.016, 28), M.black, 0, 0, 0.009, g))
    add(box(0.0022, r * 0.8, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.55, 0.0175, g)
    alongZ(hitBox(cyl(r * 1.6, 0.04, 12), 0, 0, 0.012, name, g)); return g
  }
  const rocker = (I, x, y, name) => { const [a, b] = I.P(x, y); add(box(0.042, 0.03, 0.003), M.black, a, b, 0.0015, I.panel); const m = add(box(0.019, 0.024, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), a - 0.01, b, 0.004, I.panel); hitBox(box(0.06, 0.05, 0.03), a, b, 0.01, name, I.panel); return { m, a } }
  const kn = { cur: knob(A, 520, 385, 'Ic', 0.022), coarse: knob(A, 190, 486, 'Ic'), fine: knob(A, 270, 486, 'If'), zero: knob(G, 1310, 486, 'gz') }
  const r1 = rocker(A, 542, 484, 'pwr'), r2 = rocker(G, 1622, 484, 'gOn')
  const [ha, hb] = G.P(1390, 486); add(box(0.056, 0.024, 0.004), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5 }), ha, hb, 0.002, G.panel)
  const hf = face(180, 80, label('HOLD', 34, '#26303C')); hf.set(1); plain(add(new THREE.PlaneGeometry(0.056, 0.024), new THREE.MeshBasicMaterial({ map: hf.tex, transparent: true }), ha, hb, 0.0042, G.panel)); hitBox(box(0.066, 0.034, 0.02), ha, hb, 0.008, 'hold', G.panel)
  scene.updateMatrixWorld(true)
  const sock = (I, x, y, c) => { const [a, b] = I.P(x, y); alongZ(add(cyl(0.012, 0.004, 22), M.chrome, a, b, 0.002, I.panel)); alongZ(add(cyl(0.0078, 0.006, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), a, b, 0.004, I.panel)); return I.panel.localToWorld(V(a, b, 0.01)) }
  const outR = sock(A, 380, 486, 0xd92b20), outB = sock(A, 440, 486, 0x15161a), pProbe = sock(G, 1500, 484, 0x15161a)

  /* electromagnet on two pedestals, leaving room for the U-tube underneath */
  ;[-1, 1].forEach((sg) => add(box(0.2, 0.07, 0.22), M.iron, sg * 0.21, 0.035, GAP_Z))
  add(box(0.62, 0.07, 0.05), M.iron, 0, 0.035, GAP_Z - 0.135)
  const coilF = face(512, 256, coilTex); coilF.set(1)
  const tag = (t, x, y, z, w, h, size, col = '#E9EBEF') => { const f = face(Math.round(w * 4000), Math.round(h * 4000), label(t, size, col)); f.set(1); return plain(add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), x, y, z)) }
  tag('ELECTROMAGNET', -0.21, 0.04, GAP_Z + 0.1105, 0.17, 0.018, 40); tag('FLAT POLES · 6 kG', 0.21, 0.04, GAP_Z + 0.1105, 0.17, 0.018, 40)
  ;[-1, 1].forEach((sg) => {
    add(box(0.075, 0.26, 0.11), M.iron, sg * 0.25, 0.2, GAP_Z)
    alongX(add(cyl(0.092, 0.125, 56), new THREE.MeshStandardMaterial({ map: coilF.tex, roughness: 0.5, metalness: 0.4 }), sg * 0.14, GAP_Y, GAP_Z))
    ;[-0.066, 0.066].forEach((dx) => alongX(add(cyl(0.104, 0.006, 56), M.black, sg * 0.14 + dx, GAP_Y, GAP_Z)))
    alongX(add(cyl(0.024, 0.07, 32), M.pole, sg * 0.05, GAP_Y, GAP_Z)); alongX(add(cyl(0.05, 0.012, 48), M.pole, sg * 0.022, GAP_Y, GAP_Z))
    alongX(add(cyl(0.022, 0.012, 24), M.black, sg * 0.294, GAP_Y, GAP_Z))
    ;[-0.018, 0.018].forEach((dz) => add(cyl(0.005, 0.03, 12), M.brass, sg * 0.14, GAP_Y + 0.108, GAP_Z + dz))
  })

  /* U-tube */
  add(box(0.22, 0.012, 0.05), M.acrylic, -0.14, 0.006, 0.33).rotation.y = 1.012
  const path = new THREE.CatmullRomCurve3([V(0, 0.04, GAP_Z), V(0, 0.024, GAP_Z + 0.012), V(-0.03, 0.02, GAP_Z + 0.06), V(WIDE[0] + 0.03, 0.02, WIDE[1] - 0.05), V(WIDE[0], 0.024, WIDE[1] - 0.01), V(WIDE[0], 0.04, WIDE[1])])
  const under = plain(add(new THREE.TubeGeometry(path, 60, 0.0055, 10), M.glass, 0, 0, 0)); under.renderOrder = 3
  const underL = plain(add(new THREE.TubeGeometry(path, 60, 0.0032, 8), M.liquid, 0, 0, 0)); underL.renderOrder = 2
  const nGlass = plain(add(new THREE.CylinderGeometry(0.0074, 0.0074, 0.33, 16, 1, true), M.glass, 0, 0.205, GAP_Z)); nGlass.renderOrder = 3
  const wGlass = plain(add(new THREE.CylinderGeometry(0.019, 0.019, 0.33, 28, 1, true), M.glass, WIDE[0], 0.205, WIDE[1])); wGlass.renderOrder = 3
  const nLiq = plain(add(cyl(0.0044, 1, 12), M.liquid, 0, 0, GAP_Z)); nLiq.renderOrder = 2
  const wLiq = plain(add(cyl(0.0172, 1, 24), M.liquid, WIDE[0], 0, WIDE[1])); wLiq.renderOrder = 2
  const datum = plain(add(cyl(0.0007, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffd23a }), 0, 0, 0))
  const a0 = V(WIDE[0], REST_Y, WIDE[1]), b0 = V(0, REST_Y, GAP_Z); datum.position.copy(a0).add(b0).multiplyScalar(0.5); datum.scale.y = a0.distanceTo(b0); datum.quaternion.setFromUnitVectors(V(0, 1, 0), b0.clone().sub(a0).normalize())

  /* travelling microscope */
  add(box(0.17, 0.022, 0.1), M.iron, SCOPE_POS[0], 0.011, SCOPE_POS[1]).rotation.y = SCOPE_RY
  add(cyl(0.014, 0.42, 24), M.chrome, SCOPE_POS[0], 0.22, SCOPE_POS[1])
  const car = new THREE.Group(); car.position.set(SCOPE_POS[0], REST_Y, SCOPE_POS[1]); car.rotation.y = SCOPE_RY; scene.add(car)
  add(box(0.06, 0.05, 0.05), M.black, 0, 0, 0, car); alongX(add(cyl(0.013, 0.26, 28), M.black, -0.16, 0, 0, car)); alongX(add(cyl(0.015, 0.02, 28), M.chrome, -0.295, 0, 0, car)); alongX(add(cyl(0.01, 0.05, 24), M.chrome, 0.05, 0, 0, car))
  hitBox(box(0.3, 0.05, 0.05), -0.14, 0, 0, 'car', car)
  add(box(0.1, 0.05, 0.012), new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.5 }), 0.03, 0.05, 0.03, car)
  const readF = face(320, 160, drawReadout)
  const rm = plain(add(new THREE.PlaneGeometry(0.09, 0.044), new THREE.MeshBasicMaterial({ map: readF.tex, toneMapped: false }), 0.03, 0.05, 0.0365, car)); void rm
  const fineK = new THREE.Group(); fineK.position.set(0.03, -0.045, 0.028); car.add(fineK)
  alongZ(add(cyl(0.015, 0.016, 26), M.black, 0, 0, 0, fineK)); add(box(0.002, 0.01, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.008, 0.009, fineK)
  alongZ(hitBox(cyl(0.024, 0.04, 12), 0, 0, 0.004, 'fine', fineK))
  const sight = plain(add(cyl(0.0008, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8 }), 0, 0, 0))

  /* bottles */
  const lab = BOTTLES[kind].map(([k, a, b], i) => {
    const x = -0.46 + i * 0.14, g = new THREE.Group(); g.position.set(x, 0, 0.42); scene.add(g)
    add(new THREE.LatheGeometry([[0, 0], [0.042, 0], [0.042, 0.1], [0.03, 0.128], [0.014, 0.138], [0.014, 0.165], [0, 0.165]].map(([q, y]) => new THREE.Vector2(q, y)), 40), new THREE.MeshPhysicalMaterial({ color: COLS[k], roughness: 0.15, transparent: true, opacity: 0.88 }), 0, 0, 0, g)
    add(cyl(0.018, 0.03, 24), M.black, 0, 0.178, 0, g)
    const f = face(320, 180, drawBottle); f.set(a, a, b)
    plain(add(new THREE.PlaneGeometry(0.068, 0.04), new THREE.MeshBasicMaterial({ map: f.tex }), 0, 0.06, 0.0425, g))
    hitBox(cyl(0.05, 0.2, 12), 0, 0.09, 0, `b:${k}`, g)
    return k
  }); void lab

  /* Gauss probe */
  const probe = new THREE.Group(); scene.add(probe)
  add(box(0.15, 0.003, 0.012), new THREE.MeshStandardMaterial({ color: 0xe9ecf0, roughness: 0.5 }), 0.075, 0, 0, probe); add(cyl(0.008, 0.08, 16), M.black, 0.19, 0, 0, probe).rotation.z = Math.PI / 2
  hitBox(box(0.25, 0.04, 0.04), 0.12, 0, 0, 'probeIn', probe)

  /* cables */
  const tubeG = (pts, r = 0.003) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, r, 8)
  const cable = (pts, col, r) => add(tubeG(pts, r), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }), 0, 0, 0)
  const tR = V(-0.14, GAP_Y + 0.122, GAP_Z + 0.018), tB = V(-0.14, GAP_Y + 0.122, GAP_Z - 0.018)
  cable([outR, outR.clone().add(V(0.03, -0.04, 0.1)), V(-0.3, 0.3, -0.04), tR], 0xc22a26); cable([outB, outB.clone().add(V(0.05, -0.05, 0.1)), V(-0.28, 0.34, -0.06), tB], 0x101114)
  cable([tB, V(0, 0.4, GAP_Z), V(0.14, GAP_Y + 0.122, GAP_Z + 0.018)], 0xc22a26)
  const pCable = cable([pProbe, pProbe.clone().add(V(0, -0.1, 0.1)), V(0.3, 0.02, 0.2), V(0.3, 0.02, 0.21)], 0x101114)

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3.2; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement
  const pick = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d) }
  const Q = { v: null, o: null, drag: null, pose: null, held: null }
  const cI = ctl.find((q) => q.k === 'I'), reading = (v, o) => (v.track ? ZERO_MM + o.h : v.my), range = kind === 'mag' ? [18, 22] : [15, 40]
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d.startsWith('b:')) { api.set(kind === 'mag' ? 's' : 'l', d.slice(2)); return }
    if (d === 'pwr' || d === 'gOn' || d === 'probeIn') { api.set(d, !v[d]); return }
    if (d === 'hold') { if (!v.hold) Q.held = Q.gaussText; api.set('hold', !v.hold); return }
    Q.drag = { d, x: e.clientX, y: e.clientY, I: v.I, gz: v.gz, my: reading(v, Q.o) }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : d === 'car' ? 'ns-resize' : ['Ic', 'If', 'gz', 'fine'].includes(d) ? 'grab' : 'pointer'; return }
    if (s.none) return
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if ((s.d === 'Ic' || s.d === 'If') && cI) api.set('I', quant(cI, s.I + (mv / (s.d === 'If' ? 1400 : 200)) * (cI.max - cI.min)))
    if (s.d === 'gz') api.set('gz', +clamp(s.gz + mv / 200, -1, 1).toFixed(3))
    if (s.d === 'car' || s.d === 'fine') {
      const rate = s.d === 'fine' ? (kind === 'mag' ? 0.002 : 0.01) : kind === 'mag' ? 0.02 : 0.1, y = s.d === 'car' ? (s.y - e.clientY) : mv
      api.set('track', false); api.set('my', +clamp(s.my + y * rate, range[0], range[1]).toFixed(2))
    }
  }
  const onUp = () => { Q.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const setProbe = (inn) => {
    if (Q.pose === inn) return
    Q.pose = inn
    if (inn) { probe.position.set(0.02, GAP_Y - 0.03, GAP_Z); probe.rotation.y = -Math.PI / 2 } else { probe.position.set(0.12, 0.0735, GAP_Z + 0.09); probe.rotation.y = 0 }
    probe.updateMatrixWorld(true)
    const end = probe.localToWorld(V(0.23, 0, 0))
    pCable.geometry.dispose()
    pCable.geometry = tubeG([pProbe, pProbe.clone().add(V(0, -0.1, 0.1)), V((pProbe.x + end.x) / 2, 0.08, 0.24), end])
  }
  function update(v, o) {
    Q.v = v; Q.o = o
    setProbe(v.probeIn)
    const col = COLS[kind === 'mag' ? v.s : v.l]; M.liquid.color.set(col)
    const y = REST_Y + o.h * VIS[kind], wy = REST_Y - o.h * VIS[kind] * 0.05
    nLiq.scale.y = y - 0.04; nLiq.position.y = (y + 0.04) / 2; wLiq.scale.y = wy - 0.04; wLiq.position.y = (wy + 0.04) / 2
    const r = reading(v, o), cy = REST_Y + (r - ZERO_MM) * VIS[kind]
    car.position.y = cy
    readF.set(r.toFixed(2), r.toFixed(2))
    const tip = car.localToWorld(V(-0.305, 0, 0)), aim = V(0, cy, GAP_Z)
    sight.position.copy(tip).add(aim).multiplyScalar(0.5); sight.scale.y = tip.distanceTo(aim); sight.quaternion.setFromUnitVectors(V(0, 1, 0), aim.clone().sub(tip).normalize())
    fineK.rotation.z = r * 6
    const I = kind === 'mag' && v.pwr ? v.I : 0
    ampF.set(`${v.pwr}${I}`, v.pwr ? I.toFixed(2) : null)
    const kG = Math.max(0, Math.abs(o.B ?? 0) * 10 + v.gz * 0.3)
    Q.gaussText = v.gOn ? (v.probeIn ? kG.toFixed(2) : '0.00') : null
    const txt = v.hold && v.gOn ? Q.held : Q.gaussText
    gaussF.set(`${txt}${v.hold}${v.gOn}`, txt, 'kG', v.hold ? 'HOLD' : 'AUTO')
    r1.m.position.x = r1.a + (v.pwr ? -0.01 : 0.01); r2.m.position.x = r2.a + (v.gOn ? -0.01 : 0.01)
    const u = cI ? (v.I - cI.min) / (cI.max - cI.min) : 0.4, ang = (x) => rad(135 - clamp(x, 0, 1) * 270)
    kn.cur.rotation.z = ang(u); kn.coarse.rotation.z = ang(u); kn.fine.rotation.z = ang((u * 8) % 1); kn.zero.rotation.z = ang((v.gz + 1) / 2)
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

const LABELS = [['whole', 'Whole kit'], ['magnet', 'Electromagnet'], ['scope', 'Microscope'], ['supply', 'Power supply'], ['gauss', 'Gauss meter']]
const HINT = 'Turn the knobs on the supply and Gauss meter. Drag the microscope up or down, or turn its FINE knob, to set the cross-wire on the meniscus. Click a bottle to change the liquid and the white probe to move it. Drag the background to look around.'
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`

function make(exp, kind) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({}), field = useRef(null), last = useRef('')
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, kind, exp.controls, { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    const r = v.track ? ZERO_MM + o.h : v.my, off = clamp((r - (ZERO_MM + o.h)) * PPM[kind], -120, 120)
    useEffect(() => {
      sim.current?.update(v, o, t)
      const key = `${off.toFixed(1)}|${kind === 'mag' ? v.s : v.l}`
      if (field.current && key !== last.current) { last.current = key; paintField(field.current, off, hex(COLS[kind === 'mag' ? v.s : v.l])) }
    })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
          <div className="scope-view">
            <canvas ref={field} width={FIELD} height={FIELD} aria-label="Meniscus seen through the microscope" role="img" />
            <span>Through the microscope</span>
            <b>{r.toFixed(2)} mm</b>
          </div>
        </div>
        <p className="stage3d-hint">{HINT}</p>
      </div>
    )
  }
}

export const quincke3D = quincke.map((e) => {
  const kind = e.id === 'surface-tension' ? 'surface' : 'mag'
  const controls = [...e.controls, tog('track', 'Microscope follows the meniscus', true)]
  const key = kind === 'mag' ? 'I' : 'T', c = e.controls.find((q) => q.k === key)
  const from = e.sweep.from ?? c.min, to = e.sweep.to ?? c.max, n = e.sweep.n
  const live = { ...e, controls }
  return {
    ...e,
    wide: true,
    controls,
    state: () => ({ pwr: true, gOn: true, probeIn: true, hold: false, gz: 0, my: ZERO_MM }),
    out: (v, t) => e.out(kind === 'mag' && !v.pwr ? { ...v, I: 0 } : v, t),
    sample: (v, o) => {
      if (kind === 'mag') {
        if (!v.pwr) return { error: 'The constant current supply is off. Press its power switch.' }
        if (!v.gOn) return { error: 'The Gauss meter is off. Press its power switch.' }
        if (!v.probeIn) return { error: 'Move the Gauss probe into the pole gap first.' }
        if (v.hold) return { error: 'The Gauss meter is on HOLD. Release it first.' }
        if (Math.abs(v.gz) > 0.04) return { error: 'Set the ZERO knob on the Gauss meter back to centre.' }
      }
      if (!v.track && Math.abs(v.my - (ZERO_MM + o.h)) > TOL) return { error: 'The cross-wire is not on the meniscus. Move the microscope to line them up.' }
      return e.sample(v, o)
    },
    sweep: { list: Array.from({ length: n }, (_, i) => ({ [key]: +(Math.round((from + ((to - from) * i) / (n - 1)) / c.step) * c.step).toFixed(3), track: true })) },
    Stage: make(live, kind),
  }
})
