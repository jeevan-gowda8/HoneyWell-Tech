import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { fermi } from './thermal'
import { conductor } from './micromap'
import { createStudio, face, quant } from './studio3d'

/* The Fermi energy kit as a working 3D model: copper coil in a glass tube, beaker of hot water,
   electric kettle, probe thermometer and the constant current unit. Metres. */

const BX = -0.2, BR = 0.062, BH = 0.145, WATER_Y = 0.118
const UNIT = { x: 0.62, z: -0.04, ry: -0.18, w: 0.5, h: 0.27, d: 0.24, pw: 0.47, ph: 0.2512 }
const P = (x, y) => [((x - 1070) / 580 - 0.5) * UNIT.pw, (0.5 - (y - 440) / 310) * UNIT.ph]
const HEAT_RATE = 1.5, BOIL = 95 // kettle: degrees per second and cut-out temperature
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

function drawPanel(g, W, H) {
  const k = W / 580, X = (x) => (x - 1070) * k, Y = (y) => (y - 440) * k
  const text = (t, x, y, s, bold = true, col = '#1F3A2C') => { g.fillStyle = col; g.font = `${bold ? 'bold ' : ''}${s * k}px Arial`; g.textAlign = 'center'; g.fillText(t, X(x), Y(y)) }
  g.fillStyle = '#EFF1EC'; g.fillRect(0, 0, W, H)
  text('FERMI ENERGY OF COPPER', 1360, 470, 21); text('EXPERIMENTAL KIT', 1360, 491, 10.5, false, '#4E6459')
  g.fillStyle = '#0C0D10'; g.fillRect(X(1090), Y(510), 260 * k, 96 * k); g.fillRect(X(1370), Y(510), 260 * k, 96 * k)
  text('DIGITAL MILLIAMMETER 0–20 mA', 1220, 626, 10.5); text('DIGITAL MILLIVOLTMETER 0–200 mV', 1500, 626, 10.5)
  text('CONSTANT CURRENT', 1150, 742, 10.5); text('POWER', 1588, 726, 10.5)
  text('I +', 1260, 720, 10.5); text('I −', 1330, 720, 10.5); text('V +', 1400, 720, 10.5); text('V −', 1470, 720, 10.5)
  text('TO COPPER COIL (4-terminal)', 1365, 742, 9.5, false, '#4E6459')
  g.strokeStyle = '#2A2D33'; g.lineWidth = 1.2 * k
  for (let i = 0; i <= 10; i++) { const a = rad(-135 + 27 * i); g.beginPath(); g.moveTo(X(1150) + Math.sin(a) * 34 * k, Y(688) - Math.cos(a) * 34 * k); g.lineTo(X(1150) + Math.sin(a) * 41 * k, Y(688) - Math.cos(a) * 41 * k); g.stroke() }
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' }
function drawRed(g, w, h, text, unit) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  const s = 54, step = 96, n = text.replace('.', '').length
  let x = w - 120 - n * step + 40
  g.lineCap = 'round'; g.lineWidth = 11
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - 22, 40 + s * 2, 8, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, 40 + p[1] * s); g.lineTo(x + p[2] * s, 40 + p[3] * s); g.stroke() })
    x += step
  })
  g.fillStyle = '#FF6B5E'; g.font = 'bold 32px Arial'; g.textAlign = 'right'; g.fillText(unit, w - 14, h - 30)
}
function drawBody(g, w, h) {
  g.fillStyle = '#F2F1EC'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#4A4F58'; g.textAlign = 'center'; g.font = '15px Arial'; g.fillText('°C max 300', w / 2, 142); g.font = '13px Arial'; g.fillText('ON/OFF', w * 0.3, 232); g.fillText('HOLD', w * 0.7, 232); g.fillText('AUTO OFF', w / 2, 268)
}
function drawThermo(g, w, h, text, hold) {
  g.fillStyle = text ? '#C9D8A6' : '#6E7A5C'; g.fillRect(0, 0, w, h)
  if (!text) return
  g.fillStyle = '#17260A'; g.textAlign = 'center'; g.font = 'bold 74px Consolas, monospace'; g.fillText(text, w / 2, h - 26)
  if (hold) { g.font = 'bold 22px Arial'; g.textAlign = 'left'; g.fillText('HOLD', 8, 24) }
}
function drawMarks(g, w, h) {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.font = 'bold 24px Arial'; g.lineWidth = 3
  ;[200, 400, 600, 800, 1000].forEach((ml) => { const y = h - (ml / 1100) * h; g.beginPath(); g.moveTo(10, y); g.lineTo(70, y); g.stroke(); g.fillText(String(ml), 82, y + 8) })
}
function drawWood(g, w, h) {
  g.fillStyle = '#A9794F'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${i % 2 ? '70,40,18' : '205,160,115'},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke() }
}
const drawSoft = (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.clearRect(0, 0, w, w); g.fillStyle = r; g.fillRect(0, 0, w, w) }
const drawKettle = (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#20242B'; g.textAlign = 'center'; g.font = 'bold 34px Arial'; g.fillText('ELECTRIC KETTLE', w / 2, 40); g.font = '26px Arial'; g.fillText('1 L · 1000 W', w / 2, 78) }

class Coil extends THREE.Curve {
  constructor(len, r, turns) { super(); Object.assign(this, { len, r, turns }) }
  getPoint(u, out = new THREE.Vector3()) { const a = u * this.turns * Math.PI * 2; return out.set(Math.cos(a) * this.r, u * this.len, Math.sin(a) * this.r) }
}

const VIEWS = {
  whole: { p: [0.04, 0.56, 1.72], t: [0.13, 0.17, 0] },
  coil: { p: [-0.14, 0.2, 0.46], t: [-0.2, 0.13, 0] },
  thermo: { p: [-0.13, 0.38, 0.36], t: [-0.15, 0.33, 0.03] },
  kettle: { p: [0.2, 0.26, 0.6], t: [0.13, 0.09, 0.06] },
  unit: { p: [0.5, 0.3, 0.74], t: [UNIT.x, 0.135, UNIT.z] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xe4e2dd, exposure: 0.98, env: 0.6, shadow: { left: -1.1, right: 1.1, top: 0.9, bottom: -0.9, far: 6 } })
  const M = {
    iron: new THREE.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.5, metalness: 0.45 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xcdd2d9, metalness: 0.85, roughness: 0.28 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb8622c, metalness: 0.6, roughness: 0.4 }),
    cork: new THREE.MeshStandardMaterial({ color: 0x6b4a36, roughness: 0.8 }),
    case: new THREE.MeshStandardMaterial({ color: 0x2f6a50, roughness: 0.45, metalness: 0.25 }),
    lid: new THREE.MeshStandardMaterial({ color: 0x5c9477, roughness: 0.45, metalness: 0.2 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0f8, transparent: true, opacity: 0.16, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    water: new THREE.MeshBasicMaterial({ color: 0x6fb8e6, transparent: true, opacity: 0.36, depthWrite: false }),
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

  const wood = face(1024, 512, drawWood); wood.set(1)
  wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(2, 1)
  plain(add(box(4.4, 0.04, 2.6), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.62 }), 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xe3e1dc, roughness: 0.95 }), 0, 1.3, -1.2))

  /* retort stand */
  add(box(0.16, 0.02, 0.12), M.iron, -0.5, 0.01, 0)
  add(cyl(0.007, 0.42, 18), M.chrome, -0.5, 0.21, 0)
  add(box(0.03, 0.03, 0.03), M.black, -0.5, 0.3, 0)
  alongX(add(cyl(0.0048, 0.29, 14), M.chrome, -0.355, 0.3, 0))
  add(box(0.042, 0.03, 0.042), M.black, BX, 0.3, 0)
  ;[-0.525, BX + 0.028].forEach((x) => add(new THREE.SphereGeometry(0.0075, 16, 12), M.black, x, 0.3, 0))

  /* beaker and water */
  const beaker = plain(add(new THREE.CylinderGeometry(BR, BR, BH, 56, 1, true), M.glass, BX, BH / 2, 0))
  beaker.renderOrder = 3
  const floor = plain(add(cyl(BR, 0.003, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }), BX, 0.0015, 0)); floor.renderOrder = 3
  const water = plain(add(cyl(BR - 0.0015, WATER_Y, 56), M.water, BX, WATER_Y / 2 + 0.003, 0)); water.renderOrder = 2
  const marks = face(256, 512, drawMarks); marks.set(1)
  const scale = plain(add(new THREE.PlaneGeometry(0.05, 0.1), new THREE.MeshBasicMaterial({ map: marks.tex, transparent: true, depthWrite: false }), BX - 0.022, 0.058, BR + 0.0008)); scale.renderOrder = 4

  /* test tube with copper coil */
  const tube = plain(add(new THREE.CylinderGeometry(0.0175, 0.0175, 0.285, 32, 1, true), M.glass, BX, 0.1725, 0)); tube.renderOrder = 3
  const tubeEnd = plain(add(new THREE.SphereGeometry(0.0175, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.glass, BX, 0.03, 0)); tubeEnd.renderOrder = 3
  add(new THREE.TubeGeometry(new Coil(0.085, 0.0118, 44), 900, 0.00085, 6), M.copper, BX, 0.03, 0)
  ;[[-0.008, 0], [-0.0028, 0.006], [0.0028, -0.006], [0.008, 0]].forEach(([dx, dz]) => add(cyl(0.0007, 0.2, 6), M.copper, BX + dx, 0.215, dz))
  add(new THREE.CylinderGeometry(0.021, 0.017, 0.032, 28), M.cork, BX, 0.33, 0)

  /* probe thermometer */
  const th = new THREE.Group(); th.position.set(-0.15, 0.335, 0.03); scene.add(th)
  add(box(0.05, 0.13, 0.016), M.white, 0, 0, 0, th)
  const body = face(200, 520, drawBody); body.set(1)
  plain(add(new THREE.PlaneGeometry(0.05, 0.13), new THREE.MeshStandardMaterial({ map: body.tex, roughness: 0.55 }), 0, 0, 0.0084, th))
  const lcd = face(240, 130, drawThermo)
  const lcdM = plain(add(new THREE.PlaneGeometry(0.04, 0.0217), new THREE.MeshBasicMaterial({ map: lcd.tex, toneMapped: false }), 0, 0.04, 0.0088, th)); void lcdM
  ;[[-0.012, 0xf26b3a, 'tOn'], [0.012, 0x4a5a6c, 'hold']].forEach(([x, c, d]) => {
    alongZ(add(cyl(0.0052, 0.004, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), x, -0.018, 0.0098, th))
    hitBox(new THREE.SphereGeometry(0.012, 10, 8), x, -0.018, 0.012, d, th)
  })
  add(cyl(0.0014, 0.25, 10), M.chrome, 0, -0.19, 0, th)

  /* electric kettle */
  const kettle = new THREE.Group(); kettle.position.set(0.13, 0, 0.06); scene.add(kettle)
  add(cyl(0.074, 0.016, 56), M.black, 0, 0.008, 0, kettle)
  add(new THREE.LatheGeometry([[0, 0.016], [0.066, 0.016], [0.062, 0.08], [0.052, 0.148], [0, 0.148]].map(([a, b]) => new THREE.Vector2(a, b)), 56), M.steel, 0, 0, 0, kettle)
  add(new THREE.CylinderGeometry(0.046, 0.053, 0.014, 40), M.black, 0, 0.155, 0, kettle)
  add(box(0.03, 0.008, 0.012), M.black, 0, 0.166, 0, kettle)
  const handle = add(new THREE.TorusGeometry(0.048, 0.0085, 12, 32, Math.PI), M.black, 0.056, 0.085, 0, kettle); handle.rotation.z = -Math.PI / 2
  add(new THREE.ConeGeometry(0.012, 0.04, 16), M.steel, -0.062, 0.14, 0, kettle).rotation.z = Math.PI / 2
  add(box(0.012, 0.075, 0.004), M.black, -0.034, 0.075, 0.057, kettle).rotation.y = -0.5
  add(box(0.006, 0.05, 0.002), new THREE.MeshBasicMaterial({ color: 0x5fb0dc }), -0.034, 0.066, 0.06, kettle).rotation.y = -0.5
  const klabel = face(420, 100, drawKettle); klabel.set(1)
  plain(add(new THREE.PlaneGeometry(0.09, 0.0215), new THREE.MeshBasicMaterial({ map: klabel.tex, transparent: true }), 0.012, 0.04, 0.0655, kettle))
  const kSwitch = add(box(0.014, 0.01, 0.006), new THREE.MeshStandardMaterial({ color: 0xf26b3a, roughness: 0.4, emissive: 0x000000 }), 0.03, 0.075, 0.056, kettle)
  hitBox(cyl(0.07, 0.15, 14), 0, 0.09, 0, 'kettle', kettle)
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.2, 0.012, 0.06), V(0.27, 0.006, -0.02), V(0.33, 0.006, -0.1), V(0.42, 0.006, -0.12)]), 40, 0.003, 8), M.black, 0, 0, 0)

  /* constant current unit */
  const unit = new THREE.Group(); unit.position.set(UNIT.x, 0, UNIT.z); unit.rotation.y = UNIT.ry; scene.add(unit)
  add(box(UNIT.w, UNIT.h, UNIT.d), M.case, 0, UNIT.h / 2, 0, unit)
  add(box(UNIT.w * 0.92, 0.012, UNIT.d * 0.86), M.lid, 0, UNIT.h + 0.006, 0, unit)
  const panel = new THREE.Group(); panel.position.set(0, UNIT.h / 2, UNIT.d / 2 + 0.0008); unit.add(panel)
  const art = face(1160, 620, drawPanel); art.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(UNIT.pw, UNIT.ph), new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.55 })))
  const screen = (x) => {
    const f = face(520, 192, drawRed), [a, b] = P(x, 558)
    const m = new THREE.Mesh(new THREE.PlaneGeometry((244 / 580) * UNIT.pw, (82 / 310) * UNIT.ph), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false })); m.position.set(a, b, 0.0006); panel.add(m)
    return f
  }
  const mAF = screen(1220), mVF = screen(1500)
  const [ka, kb] = P(1150, 688), knob = new THREE.Group(); knob.position.set(ka, kb, 0); panel.add(knob)
  alongZ(add(cyl(0.0255, 0.002, 40), M.chrome, 0, 0, 0.001, knob)); alongZ(add(cyl(0.02, 0.018, 36), M.black, 0, 0, 0.01, knob))
  add(box(0.0024, 0.015, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.011, 0.0195, knob)
  alongZ(hitBox(cyl(0.032, 0.05, 12), 0, 0, 0.014, 'I', knob))
  const [ra, rb] = P(1588, 686)
  add(box(0.044, 0.03, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(box(0.02, 0.024, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.01, rb, 0.004, panel)
  hitBox(box(0.06, 0.045, 0.03), ra, rb, 0.01, 'pwr', panel)
  const [la, lb] = P(1588, 650), led = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 14, 10), new THREE.MeshBasicMaterial({ color: 0x5a1414, toneMapped: false })); led.position.set(la, lb, 0.001); panel.add(led)

  scene.updateMatrixWorld(true)
  const sockets = [[1260, 0xd92b20, 'cI'], [1330, 0x15161a, 'cI'], [1400, 0xd92b20, 'cV'], [1470, 0x2a2c31, 'cV']].map(([x, c, d]) => {
    const [a, b] = P(x, 686)
    alongZ(add(cyl(0.0125, 0.004, 22), M.chrome, a, b, 0.002, panel))
    alongZ(add(cyl(0.0085, 0.006, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), a, b, 0.004, panel))
    hitBox(new THREE.SphereGeometry(0.02, 10, 8), a, b, 0.012, d, panel)
    return panel.localToWorld(V(a, b, 0.008))
  })

  /* four leads: each has a plugged and an unplugged shape */
  const COL = [0xc42a26, 0x101114, 0xd9342f, 0x33363c]
  const leads = sockets.map((s, i) => {
    const top = V(BX + 0.012 - i * 0.008, 0.347, i % 2 ? 0.006 : -0.006)
    const mat = new THREE.MeshStandardMaterial({ color: COL[i], roughness: 0.55 })
    const make = (pts) => { const c = new THREE.CatmullRomCurve3(pts); const m = add(new THREE.TubeGeometry(c, 110, 0.0032, 8), mat, 0, 0, 0); return { c, m } }
    const mid = V(0.02 + i * 0.03, 0.26 - i * 0.012, 0.14 + i * 0.012)
    const on = make([top, V(BX + 0.03, 0.375, -0.03), V(BX + 0.13, 0.33, -0.02), mid, V(s.x - 0.1, 0.05, s.z + 0.22), V(s.x, s.y - 0.03, s.z + 0.08), s])
    const off = make([top, V(BX + 0.03, 0.375, -0.03), V(BX + 0.13, 0.33, -0.02), mid, V(0.3 + i * 0.03, 0.02, 0.34), V(0.36 + i * 0.03, 0.006, 0.36 - i * 0.01)])
    return { on, off }
  })

  /* moving charge on the current leads */
  const beadMat = new THREE.MeshBasicMaterial({ color: 0x5cc8ff })
  const beads = Array.from({ length: 36 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 12, 10), beadMat); m.visible = false; scene.add(m); return m })

  /* steam and bubbles */
  const soft = face(128, 128, drawSoft); soft.set(1)
  const steam = Array.from({ length: 16 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft.tex, transparent: true, depthWrite: false, opacity: 0 }))
    s.userData = { ph: (i * 0.137) % 1, kettle: i >= 10, dx: Math.sin(i * 2.4) * 0.03, dz: Math.cos(i * 1.7) * 0.02 }
    scene.add(s); return s
  })
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })
  const bubbles = Array.from({ length: 14 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), bubbleMat), a = i * 2.399, r = 0.026 + (i % 3) * 0.009
    m.userData = { x: BX + Math.cos(a) * r, z: Math.sin(a) * r, ph: (i * 0.23) % 1 }; m.visible = false; scene.add(m); return m
  })

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.18; orbit.maxDistance = 2.8; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
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
  const S = { v: null, drag: null, lastT: 0, acc: 0, held: null }
  const cI = ctl.find((q) => q.k === 'I')
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d) return
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    if (d === 'I') { S.drag = { x: e.clientX, y: e.clientY, val: S.v.I }; return }
    if (d === 'hold') S.held = S.v.T
    api.set(d, !S.v[d])
    S.drag = { none: true }
  }
  const onMove = (e) => {
    const s = S.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : d === 'I' ? 'grab' : 'pointer'; return }
    if (s.none) return
    api.set('I', quant(cI, s.val + (((e.clientX - s.x) - (e.clientY - s.y)) / 240) * (cI.max - cI.min)))
  }
  const onUp = () => { S.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const cold = new THREE.Color(0x6fb8e6), hot = new THREE.Color(0x9fbcd2)
  function update(v, o, t) {
    S.v = v
    const dt = Math.max(0, Math.min(0.2, t - S.lastT)); S.lastT = t
    if (v.kettle) {
      S.acc += HEAT_RATE * dt
      if (v.T >= BOIL) { api.set('kettle', false); S.acc = 0 } else if (S.acc >= 1) { const n = Math.floor(S.acc); S.acc -= n; api.set('T', Math.min(BOIL, v.T + n)) }
    }
    M.water.color.lerpColors(cold, hot, clamp((v.T - 30) / 65, 0, 1))
    mAF.set(`${o.mA}`, o.mA.toFixed(2).padStart(5, '0'), 'mA')
    mVF.set(`${o.mV}`, o.mV.toFixed(1).padStart(4, '0'), 'mV')
    const shown = v.tOn ? (v.hold ? S.held ?? v.T : v.T).toFixed(1) : ''
    lcd.set(`${shown}${v.hold}`, shown, v.hold)
    rocker.position.x = ra + (v.pwr ? -0.01 : 0.01)
    led.material.color.set(v.pwr ? 0xff3b30 : 0x5a1414)
    kSwitch.material.emissive.set(v.kettle ? 0xb03a10 : 0x000000)
    knob.rotation.z = rad(135 - ((v.I - cI.min) / (cI.max - cI.min)) * 270)
    leads.forEach((l, i) => { const on = i < 2 ? v.cI : v.cV; l.on.m.visible = on; l.off.m.visible = !on })

    const flowing = o.mA > 0
    beads.forEach((b, i) => {
      b.visible = flowing
      if (!flowing) return
      const lead = i < 18 ? 0 : 1, u = ((i % 18) / 18 + t * (0.02 + v.I * 0.003)) % 1
      leads[lead].on.c.getPointAt(lead ? u : 1 - u, b.position)
    })
    const warm = clamp((v.T - 50) / 45, 0, 1)
    steam.forEach((s) => {
      const u = (s.userData.ph + t * 0.16) % 1, k = s.userData.kettle
      const x = k ? 0.13 - 0.08 : BX + s.userData.dx, y = k ? 0.15 : BH
      s.position.set(x + s.userData.dx * u, y + u * 0.2, (k ? 0.06 : 0) + s.userData.dz)
      s.scale.setScalar(0.03 + u * 0.06)
      s.material.opacity = (k ? (v.kettle ? 0.42 : 0) : warm * 0.34) * Math.sin(u * Math.PI)
    })
    bubbles.forEach((b) => {
      b.visible = v.T > 75
      if (b.visible) { const u = (b.userData.ph + t * 0.5) % 1; b.position.set(b.userData.x, 0.012 + u * (WATER_Y - 0.012), b.userData.z) }
    })
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

const LABELS = [['whole', 'Whole kit'], ['coil', 'Copper coil'], ['thermo', 'Thermometer'], ['kettle', 'Kettle'], ['unit', 'Current unit']]

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
        <p className="stage3d-hint">Click the kettle to heat the water. Drag CONSTANT CURRENT to set the current. Click a socket to unplug or replug its pair of leads. The thermometer's ON/OFF and HOLD buttons work. Drag the background to look around.</p>
      </div>
    )
  }
}

export const fermi3D = fermi.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ pwr: true, cI: true, cV: true, kettle: false, tOn: true, hold: false }),
  out: (v, t) => {
    const o = e.out(v, t), mA = v.pwr && v.cI ? v.I : 0
    return { ...o, mA, mV: mA && v.cV ? o.V : 0 }
  },
  read: (v, o) => [['Resistance', o.mV ? o.R.toFixed(4) : '–', 'Ω'], ['Voltage', o.mV.toFixed(2), 'mV']],
  micro: (v, o) => conductor(o.mA ? v.I / 20 + 0.1 : 0, clamp((v.T - 20) / 75, 0, 1), 'Electrons scattering in copper', 'Heating makes the ions vibrate harder. Electrons collide more often and resistance rises.'),
  sample: (v, o) => {
    if (!v.pwr) return { error: 'The constant current unit is off. Press its POWER switch.' }
    if (!v.cI) return { error: 'The current leads are unplugged. Click the I + or I − socket.' }
    if (!v.cV) return { error: 'The voltage leads are unplugged. Click the V + or V − socket.' }
    if (!v.tOn) return { error: 'Switch the thermometer on to read the temperature.' }
    if (v.hold) return { error: 'The thermometer is on HOLD. Release it to read the temperature.' }
    return e.sample(v, o)
  },
  Stage: make(e),
}))
