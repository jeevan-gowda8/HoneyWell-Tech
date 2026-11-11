import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { coupledOsc } from './mechanics'
import { createStudio, face, quant } from './studio3d'

/* The coupled oscillator kit as a working 3D model: two 1 m pendulums joined by a spring on
   sliding clamps, magnetic sensors under the bobs and the data acquisition unit. Metres. */

const PIVOTS = [-0.555, -0.285]
const PIVOT_Y = 1.175
const L = 1
const START = 0.12, LIMIT = 0.22
const UNIT = { x: 0.74, z: 0.12, w: 0.5, h: 0.27, d: 0.3, pw: 0.46, ph: 0.235 }

/* Positions on the unit's front panel are given in pixels of the reference picture. */
const PX = { x0: 198, y0: 218, w: 1144, h: 584 }
const P = (x, y) => [((x - PX.x0) / PX.w - 0.5) * UNIT.pw, (0.5 - (y - PX.y0) / PX.h) * UNIT.ph]

function drawPanel(g, W, H) {
  const X = (x) => x - PX.x0, Y = (y) => y - PX.y0
  g.fillStyle = '#F1F3F6'; g.fillRect(0, 0, W, H)
  g.textAlign = 'left'; g.fillStyle = '#1D3F66'; g.font = 'bold 32px Arial'; g.fillText('COUPLED OSCILLATOR', 40, 54)
  g.font = '18px Arial'; g.fillStyle = '#3F5F85'; g.fillText('MICROCONTROLLER BASED DATA ACQUISITION UNIT', 40, 86)
  g.strokeStyle = '#2B4F7A'; g.lineWidth = 2; g.strokeRect(X(1082), Y(248), 220, 50)
  g.textAlign = 'center'; g.font = '14px Arial'; g.fillStyle = '#1D3F66'; g.fillText('Detector: Magnetic sensor', X(1192), Y(270)); g.fillText('Least count: 1 s', X(1192), Y(289))
  g.fillStyle = '#0D0E10'; g.fillRect(X(238), Y(328), 520, 170)
  g.fillStyle = '#0F3D18'; g.fillRect(X(248), Y(338), 500, 150)
  g.fillStyle = '#17181B'; g.fillRect(X(804), Y(328), 498, 120)
  g.fillStyle = '#333'; g.font = '15px Arial'; g.fillText('16 x 2 LCD DISPLAY', X(498), Y(524))
  ;[[826, '0'], [940, '25'], [1054, '50'], [1168, '75'], [1282, '100']].forEach(([x, t]) => g.fillText(t, X(x), Y(470)))
  g.fillText('AMPLITUDE BAR GRAPH (%)', X(1053), Y(491))
  g.font = 'bold 17px Arial'; g.fillStyle = '#1F2B3A'
  ;[[278, 'START'], [383, 'STOP'], [488, 'RESET'], [593, 'MODE'], [698, 'CH A/B']].forEach(([x, t]) => g.fillText(t, X(x), Y(641)))
  g.font = '13px Arial'; [[848, 'POWER'], [938, 'SENSE A'], [1028, 'SENSE B'], [1118, 'PC LINK']].forEach(([x, t]) => g.fillText(t, X(x), Y(578)))
  g.font = 'bold 15px Arial'; g.fillText('SENSOR A', X(888), Y(638)); g.fillText('SENSOR B', X(1028), Y(638))
  g.setLineDash([6, 4]); g.strokeStyle = '#9AA3AF'; g.strokeRect(X(1158), Y(523), 150, 200); g.setLineDash([])
  g.font = 'bold 15px Arial'; g.fillText('DC OUTPUT', X(1233), Y(546))
  g.textAlign = 'left'; g.font = '16px Arial'; g.fillText('+12 V', X(1226), Y(584)); g.fillText('+5 V', X(1226), Y(628)); g.fillText('GND', X(1226), Y(672))
  g.textAlign = 'center'; g.font = '14px Arial'; g.fillText('500 mA max', X(1233), Y(714))
  g.font = 'bold 15px Arial'; g.fillText('POWER', X(1242), Y(788))
  g.fillText('USB', X(281), Y(724)); g.fillText('RS232', X(406), Y(722)); g.font = '14px Arial'; g.fillText('PC INTERFACE', X(574), Y(751))
  g.fillStyle = '#17181B'; g.fillRect(X(258), Y(733), 46, 24); g.fillStyle = '#B9BEC6'; g.fillRect(X(264), Y(739), 34, 10)
  g.fillStyle = '#B9BEC6'; g.beginPath(); g.moveTo(X(358), Y(729)); g.lineTo(X(454), Y(729)); g.lineTo(X(444), Y(761)); g.lineTo(X(368), Y(761)); g.closePath(); g.fill()
  g.fillStyle = '#2A2D33'; g.beginPath(); g.moveTo(X(368), Y(735)); g.lineTo(X(444), Y(735)); g.lineTo(X(436), Y(755)); g.lineTo(X(376), Y(755)); g.closePath(); g.fill()
}
const drawLcd = (g, w, h, lines, power) => {
  g.fillStyle = power ? '#A9D44A' : '#3F5A1E'; g.fillRect(0, 0, w, h)
  if (!power) return
  g.fillStyle = '#17260A'; g.font = 'bold 46px Consolas, monospace'; g.textAlign = 'left'
  lines.forEach((l, i) => g.fillText(l, 18, 52 + i * 54))
}
function drawScale(g, w, h) {
  g.fillStyle = '#FBF8EE'; g.fillRect(0, 0, w, h)
  g.strokeStyle = '#2A2A2A'; g.fillStyle = '#2A2A2A'; g.font = '30px Arial'
  for (let cm = 0; cm <= 100; cm++) {
    const y = 12 + (cm / 100) * (h - 24), big = cm % 10 === 0, mid = cm % 5 === 0
    g.lineWidth = big ? 3 : 1.4
    g.beginPath(); g.moveTo(0, y); g.lineTo(big ? 56 : mid ? 40 : 26, y); g.stroke()
    if (big) g.fillText(String(cm), 64, y + 11)
  }
}
function drawWood(g, w, h) {
  g.fillStyle = '#A9794F'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${i % 2 ? '70,40,18' : '205,160,115'},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3)
    const y = (i * 37) % h
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke()
  }
}

class Helix extends THREE.Curve {
  constructor(len, r, turns) { super(); Object.assign(this, { len, r, turns }) }
  getPoint(u, out = new THREE.Vector3()) { const a = u * this.turns * Math.PI * 2; return out.set(u * this.len, Math.sin(a) * this.r, Math.cos(a) * this.r) }
}

const VIEWS = {
  whole: { p: [-0.06, 0.86, 3.05], t: [-0.06, 0.68, 0] },
  unit: { p: [0.62, 0.32, 1.02], t: [0.73, 0.15, UNIT.z] },
  bobs: { p: [-0.42, 0.42, 1.25], t: [-0.42, 0.24, 0] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xe3e7eb, exposure: 0.95, env: 0.55, shadow: { left: -2, right: 2 } })
  const M = {
    black: new THREE.MeshStandardMaterial({ color: 0x25272c, roughness: 0.45, metalness: 0.3 }),
    base: new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.5, metalness: 0.35 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.16 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.9, roughness: 0.32 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xf2cf72, metalness: 0.85, roughness: 0.24 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x2f5f93, roughness: 0.42, metalness: 0.3 }),
    sensor: new THREE.MeshStandardMaterial({ color: 0x2465b4, roughness: 0.4, metalness: 0.1 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 24) => new THREE.CylinderGeometry(r, r, h, s)

  const wood = face(1024, 512, drawWood); wood.set(1)
  wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(2, 1)
  add(new THREE.BoxGeometry(5.4, 0.06, 2.6), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.6 }), -0.05, -0.03, 0).castShadow = false
  add(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ color: 0xe1e5e9, roughness: 0.95 }), 0, 2.2, -1.3).castShadow = false

  /* frame */
  const FX = (PIVOTS[0] + PIVOTS[1]) / 2, COL = 0.49
  ;[[-0.62, -0.13], [-0.62, 0.13], [0.62, -0.13], [0.62, 0.13]].forEach(([dx, z]) => add(cyl(0.02, 0.012), M.black, FX + dx, 0.006, z))
  add(new THREE.BoxGeometry(1.34, 0.05, 0.34), M.base, FX, 0.037, 0)
  ;[-COL, COL].forEach((dx) => {
    add(new THREE.BoxGeometry(0.07, 0.04, 0.07), M.black, FX + dx, 0.082, 0)
    add(cyl(0.017, 1.15), M.chrome, FX + dx, 0.66, 0)
    add(new THREE.BoxGeometry(0.075, 0.075, 0.06), M.black, FX + dx, 1.225, 0)
  })
  const beam = add(cyl(0.016, 1.06), M.chrome, FX, 1.225, 0); beam.rotation.z = Math.PI / 2
  const scaleFace = face(150, 1500, drawScale); scaleFace.set(1)
  const scale = add(new THREE.PlaneGeometry(0.06, 1.016), new THREE.MeshStandardMaterial({ map: scaleFace.tex, roughness: 0.7 }), FX - COL + 0.056, PIVOT_Y - 0.5, -0.014)
  scale.castShadow = false

  /* pendulums */
  const pend = PIVOTS.map((x, i) => {
    add(new THREE.BoxGeometry(0.07, 0.022, 0.05), M.black, x, 1.2, 0)
    const group = new THREE.Group(); group.position.set(x, PIVOT_Y, 0); scene.add(group)
    add(new THREE.ConeGeometry(0.009, 0.02, 4), M.steel, 0, 0.002, 0, group).rotation.x = Math.PI
    add(cyl(0.0042, 0.955, 14), M.steel, 0, -0.4775, 0, group)
    const bob = add(cyl(0.032, 0.08, 36), M.brass, 0, -L, 0, group); bob.userData.grab = i
    add(cyl(0.012, 0.012, 18), M.black, 0, -L - 0.044, 0, group)
    const clamp = add(new THREE.BoxGeometry(0.036, 0.04, 0.036), M.black, 0, -0.5, 0, group)
    const hit = add(new THREE.BoxGeometry(0.1, 0.07, 0.09), M.hit, 0, 0, 0, clamp); hit.castShadow = false; hit.userData.clamp = true
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(0.26, PIVOT_Y - 0.25), M.hit)
    catcher.position.set(x, (PIVOT_Y + 0.14) / 2, -0.05); catcher.userData.grab = i; scene.add(catcher)
    /* magnetic sensor under the bob */
    add(new THREE.BoxGeometry(0.03, 0.03, 0.03), M.black, x, 0.074, 0)
    add(new THREE.BoxGeometry(0.08, 0.034, 0.06), M.sensor, x, 0.106, 0)
    return { x, group, clamp }
  })

  /* coupling spring: a real helix, stretched between the two clamps */
  const SPRING_L = 0.2
  const spring = add(new THREE.TubeGeometry(new Helix(SPRING_L, 0.0125, 24), 420, 0.0011, 6), M.steel, 0, 0, 0)

  /* data acquisition unit */
  const unit = new THREE.Group(); unit.position.set(UNIT.x, 0, UNIT.z); unit.rotation.y = -0.16; scene.add(unit)
  add(new THREE.BoxGeometry(UNIT.w, UNIT.h, UNIT.d), M.blue, 0, UNIT.h / 2 + 0.012, 0, unit)
  ;[[-0.2, 0.11], [0.2, 0.11], [-0.2, -0.11], [0.2, -0.11]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.05, 0.012, 0.03), M.black, x, 0.006, z, unit))
  for (let i = 0; i < 14; i++) add(new THREE.BoxGeometry(0.008, 0.0015, 0.09), M.black, -0.09 + i * 0.014, UNIT.h + 0.0125, -0.02, unit)
  const panel = new THREE.Group(); panel.position.set(0, UNIT.h / 2 + 0.012, UNIT.d / 2 + 0.001); unit.add(panel)
  const art = face(PX.w, PX.h, drawPanel); art.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(UNIT.pw, UNIT.ph), new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.55 })))

  const lcdFace = face(512, 120, drawLcd)
  const [lx, ly] = P(498, 413), lw = (472 / PX.w) * UNIT.pw, lh = (110 / PX.h) * UNIT.ph
  const lcdPlane = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshBasicMaterial({ map: lcdFace.tex, toneMapped: false }))
  lcdPlane.position.set(lx, ly, 0.0008); panel.add(lcdPlane)

  const bars = Array.from({ length: 20 }, (_, i) => {
    const [x, y] = P(826 + i * 24, 388)
    const m = new THREE.Mesh(new THREE.PlaneGeometry((16 / PX.w) * UNIT.pw, (100 / PX.h) * UNIT.ph), new THREE.MeshBasicMaterial({ color: 0x3a3a3a, toneMapped: false }))
    m.position.set(x, y, 0.0009); panel.add(m); return m
  })
  const led = (x, y, off) => {
    const [a, b] = P(x, y)
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 14, 10), new THREE.MeshBasicMaterial({ color: off, toneMapped: false }))
    m.position.set(a, b, 0.0012); panel.add(m); return m
  }
  const leds = { power: led(848, 553, 0x5a1414), a: led(938, 553, 0x14401f), b: led(1028, 553, 0x14401f), pc: led(1118, 553, 0x57470e) }

  const press = (x, y, colour, name) => {
    const [a, b] = P(x, y)
    const ring = new THREE.Mesh(cyl(0.0125, 0.003, 28), M.chrome); ring.rotation.x = Math.PI / 2; ring.position.set(a, b, 0.0016); panel.add(ring)
    const well = new THREE.Mesh(cyl(0.0098, 0.0035, 28), new THREE.MeshStandardMaterial({ color: 0x0c0c0e })); well.rotation.x = Math.PI / 2; well.position.set(a, b, 0.002); panel.add(well)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0082, 24, 14), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.3 }))
    cap.scale.z = 0.6; cap.position.set(a, b, 0.004); cap.userData.act = name; panel.add(cap)
    const big = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), M.hit); big.position.set(a, b, 0.01); big.userData.act = name; panel.add(big)
  }
  press(278, 590, 0x2fa04b, 'start'); press(383, 590, 0xc93232, 'stop'); press(488, 590, 0xd2b01f, 'reset'); press(593, 590, 0x8a8f98, 'mode'); press(698, 590, 0x8a8f98, 'ch')

  const din = (x, y) => {
    const [a, b] = P(x, y)
    const r = new THREE.Mesh(cyl(0.0125, 0.008, 24), M.chrome); r.rotation.x = Math.PI / 2; r.position.set(a, b, 0.004); panel.add(r)
    return new THREE.Vector3(a, b, 0.012)
  }
  const sockets = [din(888, 678), din(1028, 678)]
  ;[[578, 0xc23a2c], [622, 0xc23a2c], [666, 0x15161a]].forEach(([y, c]) => {
    const [a, b] = P(1198, y)
    const m = new THREE.Mesh(cyl(0.0052, 0.007, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); m.rotation.x = Math.PI / 2; m.position.set(a, b, 0.0035); panel.add(m)
  })
  const [ra, rb] = P(1242, 745)
  add(new THREE.BoxGeometry(0.03, 0.019, 0.003), M.black, ra, rb, 0.0015, panel).castShadow = false
  const rocker = add(new THREE.BoxGeometry(0.016, 0.015, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.006, rb, 0.004, panel)
  rocker.userData.act = 'power'
  const rockerHit = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), M.hit); rockerHit.position.set(ra, rb, 0.012); rockerHit.userData.act = 'power'; panel.add(rockerHit)

  /* sensor cables into the DIN sockets */
  scene.updateMatrixWorld(true)
  PIVOTS.forEach((x, i) => {
    const a = new THREE.Vector3(x + 0.03, 0.095, 0.03), b = panel.localToWorld(sockets[i].clone())
    const pts = [a, new THREE.Vector3(x + 0.08, 0.07, 0.2 + i * 0.03), new THREE.Vector3(0.25, 0.014, 0.42 + i * 0.05), new THREE.Vector3(b.x - 0.1, 0.05, b.z + 0.12), b.clone().setZ(b.z + 0.03), b]
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.0042, 8), M.cable, 0, 0, 0)
  })

  /* camera */
  const applyView = (name) => { const w = VIEWS[name]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.45; orbit.maxDistance = 4.4; orbit.maxPolarAngle = Math.PI / 2 - 0.03; orbit.minAzimuthAngle = -1.15; orbit.maxAzimuthAngle = 1.15

  const S = {
    th: [0, 0], w: [0, 0], held: -1, modeKey: null, lastT: 0, v: null, o: null,
    power: true, run: true, ch: 0, page: 0, N: 0, T: null, last: null, tStart: 0, env: [0, 0], lit: -1, senseA: false, senseB: false, count: 0,
  }
  function draw() { renderer.render(scene, camera) }
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const release0 = (mode) => {
    S.th = mode === 'in' ? [START, START] : mode === 'anti' ? [START, -START] : [START, 0]
    S.w = [0, 0]; S.env = [Math.abs(S.th[0]), Math.abs(S.th[1])]; zero()
  }
  function zero() { S.N = 0; S.T = null; S.last = null; S.tStart = S.lastT; S.stoppedAt = S.lastT }

  function place() {
    const s = S.v.s * L
    const ends = pend.map((p, i) => {
      p.group.rotation.z = S.th[i]
      p.clamp.position.y = -s
      return new THREE.Vector3(p.x + Math.sin(S.th[i]) * s, PIVOT_Y - Math.cos(S.th[i]) * s, 0)
    })
    const a = ends[0].clone().setX(ends[0].x + 0.018), b = ends[1].clone().setX(ends[1].x - 0.018)
    spring.position.copy(a)
    spring.rotation.z = Math.atan2(b.y - a.y, b.x - a.x)
    spring.scale.x = a.distanceTo(b) / SPRING_L
  }
  function paint() {
    const t = Math.max(0, (S.run ? S.lastT : S.stoppedAt) - S.tStart)
    const name = S.o.mode === 'in' ? 'T0' : S.o.mode === 'anti' ? 'T1' : 'T '
    const ch = `CH-${S.ch ? 'B' : 'A'}`
    const pct = Math.min(100, Math.round((S.env[S.ch] / LIMIT) * 100))
    const top = S.page === 0 ? `${name}: ${S.T === null ? '--.--' : S.T.toFixed(2)}s` : `AMP: ${String(pct).padStart(3, ' ')}%`
    const lines = [top.padEnd(12, ' ') + ch, `N:${S.N}`.padEnd(6, ' ') + `t:${Math.floor(t)}s`.padEnd(7, ' ') + (S.run ? 'RUN' : 'STP')]
    lcdFace.set(lines.join('|') + S.power, lines, S.power)
    const lit = S.power ? Math.round((pct / 100) * 20) : 0
    if (lit !== S.lit) {
      S.lit = lit
      bars.forEach((b, i) => b.material.color.set(i >= lit ? 0x3a3a3a : i < 10 ? 0x33e05a : i < 15 ? 0xffd60a : 0xff4530))
    }
    leds.power.material.color.set(S.power ? 0xff3b30 : 0x5a1414)
    leds.pc.material.color.set(S.power ? 0xffd60a : 0x57470e)
    leds.a.material.color.set(S.power && S.senseA ? 0x4bff78 : 0x14401f)
    leds.b.material.color.set(S.power && S.senseB ? 0x4bff78 : 0x14401f)
  }

  function act(name) {
    if (name === 'power') { S.power = !S.power; rocker.position.x = ra + (S.power ? -0.006 : 0.006); zero() }
    if (!S.power) { paint(); draw(); return }
    if (name === 'start') { S.run = true; zero() }
    if (name === 'stop' && S.run) { S.run = false; S.stoppedAt = S.lastT }
    if (name === 'reset') { S.run = true; zero() }
    if (name === 'mode') S.page = (S.page + 1) % 2
    if (name === 'ch') { S.ch = S.ch ? 0 : 1; S.lit = -1; zero() }
    paint(); draw()
  }

  /* pointer */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3()
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => { const u = h.object.userData; return u.act || u.clamp || u.grab !== undefined })
  }
  const toPlane = (e) => { pick(e); return ray.ray.intersectPlane(planeZ, hitP) }
  const c = (k) => ctl.find((q) => q.k === k)
  let drag = null
  const el = renderer.domElement
  const onDown = (e) => {
    const h = pick(e)
    if (!h) return
    const u = h.object.userData
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    if (u.act) { act(u.act); drag = { none: true } } else if (u.clamp) { drag = { clamp: true } } else { drag = { swing: u.grab, x: e.clientX, y: e.clientY } }
  }
  const onMove = (e) => {
    if (!drag) { const h = pick(e), u = h?.object.userData; el.style.cursor = !h ? 'move' : u.act ? 'pointer' : u.clamp ? 'ns-resize' : 'grab'; return }
    if (drag.clamp) { const p = toPlane(e); if (p) api.set('s', quant(c('s'), (PIVOT_Y - p.y) / L)) }
    if (drag.swing !== undefined) {
      if (S.held < 0 && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return
      const p = toPlane(e); if (!p) return
      const i = drag.swing, px = PIVOTS[i]
      S.held = i; S.w[i] = 0
      S.th[i] = Math.max(-LIMIT, Math.min(LIMIT, Math.atan2(p.x - px, PIVOT_Y - p.y)))
      place(); draw()
    }
  }
  const onUp = () => {
    if (!drag) return
    if (S.held >= 0) { S.env[S.held] = Math.abs(S.th[S.held]); S.held = -1; zero() }
    drag = null; orbit.enabled = true
  }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  function update(v, o, t) {
    const back = t < S.lastT, dt = Math.max(0, Math.min(0.2, t - S.lastT))
    S.lastT = t; S.v = v; S.o = o
    if (back || o.mode !== S.modeKey) { S.modeKey = o.mode; release0(o.mode) }
    const a2 = o.c.a ** 2, kap = (o.c.b ** 2 - o.c.a ** 2) / 2, n = 8, h = dt / n
    if (dt > 0) for (let q = 0; q < n; q++) {
      const before = S.th[S.ch], tNow = t - dt + (q + 1) * h
      const acc = (i) => -a2 * S.th[i] - kap * (S.th[i] - S.th[1 - i]) - 0.01 * S.w[i]
      const A = [acc(0), acc(1)]
      for (let i = 0; i < 2; i++) { if (i === S.held) { S.w[i] = 0; continue } S.w[i] += A[i] * h; S.th[i] += S.w[i] * h }
      const after = S.th[S.ch]
      if (before < 0 && after >= 0 && S.power && S.run && S.held !== S.ch) {
        const at = tNow - h * (after / (after - before || 1))
        if (S.last !== null) { S.T = at - S.last; S.N += 1 }
        S.last = at
      }
    }
    for (let i = 0; i < 2; i++) S.env[i] = Math.max(Math.abs(S.th[i]), S.env[i] * Math.exp(-dt / 1.2))
    S.senseA = Math.abs(S.th[0]) < 0.02; S.senseB = Math.abs(S.th[1]) < 0.02
    place(); paint(); draw()
  }

  const dispose = () => {
    ro.disconnect(); orbit.dispose()
    el.removeEventListener('pointerdown', onDown, cap); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp)
    scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) { m.map?.dispose(); m.dispose() } })
    release(); renderer.dispose(); el.remove()
  }
  applyView('whole'); size()
  return { update, dispose, applyView }
}

const LABELS = [['whole', 'Whole kit'], ['unit', 'Control unit'], ['bobs', 'Bobs and sensors']]

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
        <p className="stage3d-hint">Drag a bob sideways and let go. Drag a black spring clamp up or down the rod. Open Control unit to press its buttons. Drag the background to look around.</p>
      </div>
    )
  }
}

export const coupled3D = coupledOsc.map((e) => ({ ...e, Stage: make(e) }))
