import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { barPendulum } from './mechanics'
import { createStudio, face, quant } from './studio3d'

/* The bar pendulum kit as a working 3D model: steel bar with real holes on a knife-edge
   stand, photogate, digital stop clock and oscillation counter. Sizes are in metres. */

const G = 9.78
const BAR = { L: 1, W: 0.044, T: 0.007 }
const PIVOT = new THREE.Vector3(0.35, 1.08, 0)
const ROD_X = 0.5
const MAG_Y = 1.4
const holeY = (n) => (10 - n) * 0.05

/* ---- drawing on the instrument faces ---- */
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '-': 'g', ' ': '' }
function sevenSeg(g, x, y, s, ch, on) {
  g.lineCap = 'round'; g.lineWidth = s * 0.22
  Object.entries(SEG).forEach(([k, p]) => {
    g.strokeStyle = (DIG[ch] || '').includes(k) ? on : '#3A0808'
    g.beginPath(); g.moveTo(x + p[0] * s, y + p[1] * s); g.lineTo(x + p[2] * s, y + p[3] * s); g.stroke()
  })
}
const drawClock = (g, w, h, text, dotAt) => {
  g.clearRect(0, 0, w, h)
  g.fillStyle = '#E79A22'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#23180A'; g.textAlign = 'center'
  g.font = 'bold 40px Arial'; g.fillText('DIGITAL STOP CLOCK', w * 0.43, h * 0.78)
  g.fillStyle = '#120404'; g.fillRect(70, 40, 300, 130)
  g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(70, 40, 300, 130)
  ;[...text].forEach((ch, i) => sevenSeg(g, 96 + i * 66, 66, 40, ch, '#FF2A1A'))
  g.fillStyle = '#FF2A1A'; g.beginPath(); g.arc(96 + dotAt * 66 - 13, 148, 5, 0, 7); g.fill()
  g.fillStyle = '#23180A'; g.font = 'bold 24px Arial'; g.textAlign = 'left'
  g.fillText('START / STOP', 400, 46); g.fillText('RESET', 400, 176)
}
const drawCounter = (g, w, h, lines, power) => {
  g.clearRect(0, 0, w, h)
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#D7B66C'); bg.addColorStop(0.5, '#C6A24F'); bg.addColorStop(1, '#D3B164')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(255,255,255,.09)'; for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  g.fillStyle = '#1E1608'; g.textAlign = 'center'; g.font = 'bold 34px Arial'; g.fillText('OSCILLATION COUNTER', w / 2, 62)
  g.fillStyle = '#10151E'; g.fillRect(44, 150, w - 88, 120)
  g.fillStyle = power ? '#2F8BF0' : '#1A2A3D'; g.fillRect(56, 162, w - 112, 96)
  if (power) { g.fillStyle = '#F2F8FF'; g.font = 'bold 34px monospace'; g.textAlign = 'left'; lines.forEach((l, i) => g.fillText(l, 72, 202 + i * 42)) }
  g.fillStyle = '#17181C'; g.fillRect(44, 340, w - 88, 200)
  g.fillStyle = '#E6E8EC'; g.font = 'bold 24px Arial'; g.textAlign = 'center'
  g.fillText('POWER', 104, 524); g.fillText('SENSOR', w - 112, 524); g.textAlign = 'left'; g.fillText('START', 276, 400); g.fillText('RESET', 276, 512)
}

/* A sloped instrument: returns the body group and a panel group lying on the sloped face. */
function wedge({ w, d, hb, hf, mat, faceTex }) {
  const group = new THREE.Group()
  const s = new THREE.Shape([[-d / 2, 0], [d / 2, 0], [d / 2, hf], [-d / 2, hb]].map(([x, y]) => new THREE.Vector2(x, y)))
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false })
  geo.rotateY(-Math.PI / 2); geo.translate(w / 2, 0, 0)
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; body.receiveShadow = true
  group.add(body)
  const len = Math.hypot(d, hb - hf)
  const panel = new THREE.Group()
  panel.position.set(0, (hb + hf) / 2, 0)
  panel.rotation.x = -Math.atan2(d, hb - hf)
  panel.translateZ(0.0012)
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.985, len * 0.985), new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0, roughness: 0.75 }))
  panel.add(plate)
  group.add(panel)
  return { group, panel, len }
}

function button(panel, x, y, r, colour, name) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.004, 28), new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.6 }))
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 28), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.1 }))
  ;[base, cap].forEach((m) => { m.rotation.x = Math.PI / 2; m.position.set(x, y, m === base ? 0.002 : 0.007) })
  cap.userData.act = name
  panel.add(base, cap)
  return cap
}

function createScene(host, kind, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host)
  camera.position.set(0.02, 0.86, 3.05)

  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0xd2b48a, roughness: 0.62 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.14 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.92, roughness: 0.34 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a44c, metalness: 0.95, roughness: 0.3 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xd9820f, roughness: 0.5, metalness: 0.1 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc6a24f, roughness: 0.42, metalness: 0.75 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x9a9fa8, roughness: 0.7 }),
    ring: new THREE.MeshBasicMaterial({ color: 0xe20001, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
  }

  const table = add(new THREE.BoxGeometry(5, 0.06, 2.6), M.table, -0.1, -0.03, 0)
  table.castShadow = false
  const wall = add(new THREE.PlaneGeometry(8, 5), new THREE.MeshStandardMaterial({ color: 0xececea, roughness: 0.95 }), 0, 2.2, -1.3)
  wall.castShadow = false

  /* stand */
  const rodH = kind === 'fall' ? 1.5 : 1.22
  add(new THREE.BoxGeometry(0.32, 0.028, 0.3), M.black, 0.44, 0.014, 0)
  add(new THREE.CylinderGeometry(0.0085, 0.0085, rodH, 24), M.chrome, ROD_X, rodH / 2 + 0.02, 0)
  const clampY = kind === 'fall' ? MAG_Y + 0.05 : PIVOT.y
  add(new THREE.BoxGeometry(0.05, 0.04, 0.05), M.black, ROD_X, clampY, kind === 'fall' ? 0 : -0.03)
  const knob = add(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 18), M.black, ROD_X + 0.04, clampY, kind === 'fall' ? 0 : -0.03)
  knob.rotation.z = Math.PI / 2
  add(new THREE.BoxGeometry(ROD_X - PIVOT.x + 0.09, 0.022, 0.024), M.black, (ROD_X + PIVOT.x - 0.09) / 2 + 0.0, clampY, kind === 'fall' ? 0 : -0.03)

  /* swinging body */
  const pendulum = new THREE.Group(); pendulum.position.copy(PIVOT); scene.add(pendulum)
  const bar = new THREE.Group(); pendulum.add(bar)
  const holes = []
  let ring = null, bob = null, thread = null, ball = null, magnet = null
  if (kind === 'bar') {
    const pin = add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.06, 14), M.brass, PIVOT.x, PIVOT.y, -0.008)
    pin.rotation.x = Math.PI / 2
    const s = new THREE.Shape()
    s.moveTo(-BAR.W / 2, -BAR.L / 2); s.lineTo(BAR.W / 2, -BAR.L / 2); s.lineTo(BAR.W / 2, BAR.L / 2); s.lineTo(-BAR.W / 2, BAR.L / 2); s.closePath()
    for (let n = 1; n <= 19; n++) { const h = new THREE.Path(); h.absarc(0, holeY(n), 0.0055, 0, Math.PI * 2, true); s.holes.push(h) }
    const geo = new THREE.ExtrudeGeometry(s, { depth: BAR.T, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelSegments: 1, curveSegments: 18 })
    geo.translate(0, 0, -BAR.T / 2)
    const steel = new THREE.Mesh(geo, M.steel); steel.castShadow = true; steel.userData.grab = true; bar.add(steel)
    const disc = new THREE.CircleGeometry(0.018, 14), rim = new THREE.RingGeometry(0.0085, 0.0125, 28)
    for (let n = 1; n <= 19; n++) {
      const d = new THREE.Mesh(disc, M.hit); d.position.set(0, holeY(n), BAR.T / 2 + 0.002); d.userData.hole = n; bar.add(d); holes.push(d)
    }
    ring = new THREE.Mesh(rim, M.ring); ring.visible = false; ring.position.z = BAR.T / 2 + 0.0015; bar.add(ring)
  } else if (kind === 'simple') {
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 12), M.brass, PIVOT.x, PIVOT.y, -0.02).rotation.x = Math.PI / 2
    thread = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 8), new THREE.MeshStandardMaterial({ color: 0x25262a }))
    thread.castShadow = true; pendulum.add(thread)
    bob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 40, 28), M.brass); bob.castShadow = true; bob.userData.grab = true; pendulum.add(bob)
  } else {
    magnet = add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 28), M.black, PIVOT.x, MAG_Y + 0.05, 0)
    magnet.userData.act = 'drop'
    ball = add(new THREE.SphereGeometry(0.02, 32, 24), M.steel, PIVOT.x, MAG_Y - 0.02, 0)
    add(new THREE.CylinderGeometry(0.07, 0.075, 0.02, 32), M.black, PIVOT.x, 0.01, 0)
  }

  /* a generous invisible target behind the swing, so a moving bar or bob is easy to catch */
  if (kind !== 'fall') {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(0.4, PIVOT.y - 0.12), M.hit)
    catcher.position.set(PIVOT.x, (PIVOT.y + 0.04) / 2, -0.012); catcher.userData.grab = true; scene.add(catcher)
  }

  /* photogate on the rod, with an infrared beam across the swing plane */
  const gate = new THREE.Group(); scene.add(gate)
  const armX = ROD_X - PIVOT.x, gap = kind === 'bar' ? 0.03 : 0.05
  const gateMesh = add(new THREE.BoxGeometry(0.044, 0.04, gap * 2 + 0.024), M.black, armX, 0, 0, gate)
  gateMesh.userData.gate = true
  ;[-1, 1].forEach((sd) => {
    const arm = add(new THREE.BoxGeometry(armX + 0.02, 0.018, 0.012), M.black, armX / 2 - 0.01, 0, sd * gap, gate)
    arm.userData.gate = true
  })
  const gknob = add(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16), M.black, armX + 0.04, 0, 0, gate); gknob.rotation.z = Math.PI / 2
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, gap * 2, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }))
  beam.rotation.x = Math.PI / 2; gate.add(beam)
  gate.position.x = PIVOT.x

  /* stop clock */
  const clockFace = face(640, 320, drawClock)
  const clock = wedge({ w: 0.3, d: 0.24, hb: 0.17, hf: 0.065, mat: M.orange, faceTex: clockFace.tex })
  clock.group.position.set(-0.52, 0, 0.16); clock.group.rotation.y = 0.2; scene.add(clock.group)
  button(clock.panel, 0.113, 0.03, 0.011, 0x2b2d33, 'clock'); button(clock.panel, 0.113, -0.052, 0.011, 0xb31515, 'clockReset')
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.0015, 0.008, 0.16), M.black, 0.151, 0.1 - 0.0, 0.0 + 0, clock.group).position.set(0.1505, 0.04 + i * 0.014, -0.02)

  /* oscillation counter */
  const counterFace = face(512, 600, drawCounter)
  const counter = wedge({ w: 0.25, d: 0.2, hb: 0.34, hf: 0.13, mat: M.gold, faceTex: counterFace.tex })
  counter.group.position.set(-0.08, 0, 0.14); counter.group.rotation.y = 0.08; scene.add(counter.group)
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.012), new THREE.MeshStandardMaterial({ color: 0xd71920, roughness: 0.3, emissive: 0x5a0000 }))
  rocker.position.set(-0.08, -0.073, 0.006); rocker.userData.act = 'power'; counter.panel.add(rocker)
  button(counter.panel, -0.004, -0.044, 0.009, 0x2e7d32, 'start'); button(counter.panel, -0.004, -0.098, 0.009, 0xb31515, 'reset')
  const socket = add(new THREE.CylinderGeometry(0.011, 0.012, 0.03, 20), M.brass, 0.073, -0.07, 0.015, counter.panel); socket.rotation.x = Math.PI / 2

  /* sensor cable, rebuilt when the gate moves */
  let cable = null
  const v0 = new THREE.Vector3()
  const buildCable = () => {
    scene.updateMatrixWorld(true)
    const a = gate.localToWorld(new THREE.Vector3(armX + 0.02, -0.02, 0.02)), b = socket.getWorldPosition(v0).clone()
    b.z += 0.02
    const pts = [a, new THREE.Vector3(a.x + 0.04, Math.max(0.06, a.y - 0.22), a.z + 0.25), new THREE.Vector3((a.x + b.x) / 2 + 0.05, 0.012, 0.6), new THREE.Vector3(b.x + 0.05, 0.03, b.z + 0.14), b]
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, 0.0032, 8)
    if (cable) { cable.geometry.dispose(); cable.geometry = geo } else { cable = new THREE.Mesh(geo, M.cable); cable.castShadow = true; scene.add(cable) }
  }

  /* camera limits */
  orbit.target.set(0.02, 0.68, 0); orbit.enablePan = false; orbit.enableDamping = false
  orbit.minDistance = 1.1; orbit.maxDistance = 4.4; orbit.maxPolarAngle = Math.PI / 2 - 0.03; orbit.minAzimuthAngle = -1.15; orbit.maxAzimuthAngle = 1.15
  orbit.update()
  const home = { p: camera.position.clone(), t: orbit.target.clone() }

  /* kit state */
  const S = {
    theta: 0, omega: 0, w0: 0, held: false, key: null, ampSet: null, lastT: 0,
    power: true, counting: true, count: 0, lastCross: null, T: null,
    clockOn: false, clockT: 0, ballY: 0, ballV: 0, ballState: 'held', fallT: 0, fallResult: null, landedAt: 0,
    v: null, o: null,
  }
  const draw = () => renderer.render(scene, camera)
  orbit.addEventListener('change', draw)

  const size = () => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw()
  }
  const ro = new ResizeObserver(size); ro.observe(host)

  /* ---- pointer handling ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3()
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.hole || h.object.userData.grab || (kind === 'fall' && h.object.userData.gate) || h.object.userData.act)
  }
  const toPlane = (e) => { pick(e); return ray.ray.intersectPlane(planeZ, hitP) }
  let drag = null
  const c = (k) => ctl.find((q) => q.k === k)
  const swingLimit = () => (c('amp').max * Math.PI) / 180

  const onDown = (e) => {
    const h = pick(e)
    if (!h) return
    const u = h.object.userData
    orbit.enabled = false
    renderer.domElement.setPointerCapture(e.pointerId)
    if (u.act) { act(u.act); drag = { act: true } } else if (u.gate && kind === 'fall') drag = { gate: true }
    else if (u.grab || u.hole) drag = { swing: true, hole: u.hole, x: e.clientX, y: e.clientY, moved: false }
    else drag = { act: true }
  }
  const onMove = (e) => {
    if (!drag) {
      const h = pick(e), u = h?.object.userData
      renderer.domElement.style.cursor = !h ? 'move' : u.act || (u.hole && !0) ? 'pointer' : 'grab'
      if (ring) {
        ring.visible = !!u?.hole
        if (u?.hole) ring.position.y = holeY(u.hole)
        if (S.lastHover !== u?.hole) { S.lastHover = u?.hole; draw() }
      }
      return
    }
    if (drag.gate) {
      const p = toPlane(e); if (!p) return
      api.set('h', quant(c('h'), MAG_Y - p.y))
    } else if (drag.swing) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true
      if (!drag.moved || !S.o.valid && kind === 'bar') return
      const p = toPlane(e); if (!p) return
      S.held = true; S.omega = 0
      S.theta = Math.max(-swingLimit(), Math.min(swingLimit(), Math.atan2(p.x - PIVOT.x, PIVOT.y - p.y)))
      if (kind === 'simple') {
        const L = quant(c('L'), Math.hypot(p.x - PIVOT.x, p.y - PIVOT.y))
        if (L !== S.v.L) { S.keepHeld = true; api.set('L', L) }
      }
      placeBody(); draw()
    }
  }
  const onUp = () => {
    if (!drag) return
    if (drag.swing && !drag.moved && drag.hole) api.set('hole', drag.hole)
    if (drag.swing && S.held) {
      const a = quant(c('amp'), (Math.abs(S.theta) * 180) / Math.PI)
      S.theta = Math.sign(S.theta || 1) * (a * Math.PI) / 180; S.omega = 0; S.ampSet = a; S.held = false
      api.set('amp', a); restartCount()
    }
    drag = null; orbit.enabled = true
  }
  const el = renderer.domElement
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const restartCount = () => { S.count = 0; S.lastCross = null; S.T = null }
  function act(name) {
    if (name === 'power') { S.power = !S.power; rocker.rotation.x = S.power ? 0 : 0.28; restartCount(); paintFaces(); draw() }
    if (name === 'start') { S.counting = !S.counting; if (S.counting) restartCount() }
    if (name === 'reset') { restartCount(); S.counting = true }
    if (name === 'clock') { S.clockOn = !S.clockOn }
    if (name === 'clockReset') { S.clockOn = false; S.clockT = 0 }
    if (name === 'drop' && S.ballState === 'held') { S.ballState = 'fall'; S.ballV = 0; S.fallT = 0; S.fallResult = null; S.clockT = 0; S.clockOn = true }
    paintFaces(); draw()
  }

  function placeBody() {
    pendulum.rotation.z = S.theta
    if (kind === 'bar') {
      const n = S.v.hole, flip = n > 10
      bar.rotation.z = flip ? Math.PI : 0
      bar.position.y = flip ? holeY(n) : -holeY(n)
    } else if (kind === 'simple') {
      thread.scale.y = S.v.L - 0.03; thread.position.y = -(S.v.L - 0.03) / 2
      bob.position.y = -S.v.L
    }
  }
  function placeGate() {
    let y
    if (kind === 'bar') { const d = Math.abs(holeY(S.v.hole)); y = PIVOT.y - (0.5 + d) + 0.05 }
    else if (kind === 'simple') y = PIVOT.y - S.v.L
    else y = MAG_Y - S.v.h
    gate.position.y = Math.max(0.05, y)
    buildCable()
  }
  function paintFaces() {
    const running = S.v
    if (!running) return
    const secs = S.clockT
    const txt = kind === 'fall' ? secs.toFixed(3).replace('.', '').padStart(4, '0').slice(-4) : Math.min(99.99, secs).toFixed(2).replace('.', '').padStart(4, '0')
    clockFace.set(txt, txt, kind === 'fall' ? 1 : 2)
    let lines
    if (kind === 'fall') lines = S.fallResult === null ? ['FREE FALL', 'CLICK MAGNET'] : ['FALL TIME', `t = ${S.fallResult.toFixed(4)} s`]
    else if (kind === 'bar' && !S.o.valid) lines = ['PIVOT AT C.G.', 'NO OSCILLATION']
    else if (S.count === 0 || S.T === null) lines = ['OSCILLATION', 'COUNTER IS READY']
    else lines = [`COUNT  ${String(S.count).padStart(4, ' ')}`, `T = ${S.T.toFixed(3)} s`]
    if (!S.counting && kind !== 'fall' && S.power) lines = [lines[0], 'STOPPED']
    counterFace.set(`${lines.join('|')}${S.power}`, lines, S.power)
  }

  function update(v, o, t) {
    const dtRaw = t - S.lastT
    const reset = t < S.lastT
    const dt = Math.max(0, Math.min(0.2, dtRaw))
    S.lastT = t; S.v = v; S.o = o
    if (reset) { S.clockT = 0; S.clockOn = false; S.ballState = 'held'; S.fallResult = null; restartCount() }

    if (kind === 'fall') {
      const key = v.h
      if (key !== S.key) { S.key = key; placeGate() }
      const gateY = MAG_Y - v.h
      if (S.ballState === 'fall') {
        S.fallT += dt
        const fallen = 0.5 * G * S.fallT * S.fallT
        if (S.clockOn) { S.clockT = Math.min(S.fallT, o.tf); if (S.fallT >= o.tf) { S.clockT = o.tf; S.clockOn = false; S.fallResult = o.tf } }
        S.ballY = Math.max(0.04, MAG_Y - 0.02 - fallen)
        ball.position.y = S.ballY
        if (S.ballY <= 0.04) { S.ballState = 'landed'; S.landedAt = t }
      } else if (S.ballState === 'landed' && t - S.landedAt > 1.2) { S.ballState = 'held'; ball.position.y = MAG_Y - 0.02 }
      beam.material.color.set(Math.abs(ball.position.y - gateY) < 0.03 ? 0xffffff : 0xff2a1a)
    } else {
      const key = kind === 'bar' ? v.hole : v.L
      const fresh = key !== S.key
      if (fresh) { S.key = key; placeBody(); placeGate(); if (!S.keepHeld) { S.theta = (v.amp * Math.PI) / 180; S.omega = 0; restartCount() } S.keepHeld = false }
      if (v.amp !== S.ampSet && !S.held) { S.ampSet = v.amp; S.theta = (v.amp * Math.PI) / 180; S.omega = 0; restartCount() }
      const swings = kind === 'simple' || o.valid
      if (!swings) { S.theta = 0; S.omega = 0 } else if (!S.held && dt > 0) {
        const w2 = (2 * Math.PI / o.T) ** 2, n = 6, h = dt / n
        for (let i = 0; i < n; i++) {
          const before = S.theta, tNow = t - dt + (i + 1) * h
          S.omega += (-w2 * Math.sin(S.theta) - 0.012 * S.omega) * h
          S.theta += S.omega * h
          if (before < 0 && S.theta >= 0 && S.power && S.counting) {
            const at = tNow - h * (S.theta / (S.theta - before || 1))
            if (S.lastCross !== null) { S.T = at - S.lastCross; S.count += 1 }
            S.lastCross = at
          }
        }
      }
      placeBody()
      beam.material.color.set(Math.abs(S.theta) < 0.03 ? 0xffffff : 0xff2a1a)
      if (S.clockOn) S.clockT += dt
    }
    paintFaces()
    draw()
  }

  const dispose = () => {
    ro.disconnect(); orbit.dispose()
    el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp)
    scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) { m.map?.dispose(); m.dispose() } })
    release(); renderer.dispose(); el.remove()
  }
  const resetView = () => { camera.position.copy(home.p); orbit.target.copy(home.t); orbit.update(); draw() }
  size()
  return { update, dispose, resetView }
}

const HINTS = {
  bar: 'Drag the bar sideways and let go. Click a hole to re-hang it. Click the buttons on the instruments. Drag the background to look around.',
  simple: 'Drag the bob to set its length and release angle, then let go. Click the instrument buttons. Drag the background to look around.',
  fall: 'Click the black magnet to drop the ball. Drag the photogate up or down. Drag the background to look around.',
}

function make(kind, exp) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({})
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try {
        sim.current = createScene(host.current, kind, exp.controls, { set: (k, x) => api.current.set(k, x) })
      } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <button type="button" className="view-reset" onClick={() => sim.current?.resetView()}>Reset view</button>
        </div>
        <p className="stage3d-hint">{HINTS[kind]}</p>
      </div>
    )
  }
}

const KIND = { 'simple-pendulum': 'simple', 'compound-pendulum': 'bar', 'radius-of-gyration': 'bar', 'free-fall': 'fall' }
export const barPendulum3D = barPendulum.map((e) => ({
  ...e,
  Stage: make(KIND[e.id], e),
  ...(e.id === 'free-fall' ? {
    principle: 'A ball released from rest covers a height h in time t. The stop clock runs from the moment the magnet releases the ball until it crosses the photogate.',
    steps: ['Drag the photogate to the height you want.', 'Click the magnet to release the ball and read the stop clock.', 'Repeat for several heights.', 'Find g from the slope of h against t².'],
  } : {}),
}))
