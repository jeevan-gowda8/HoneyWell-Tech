import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { emThomson } from './magnetism'
import { createStudio, face, quant } from './studio3d'

/* Thomson's e/m kit as a working 3D model: CRT on an acrylic stand over a graduated wing bridge,
   bar magnets, compass and the HT/LT supply. Metres. The bridge runs along x, the beam along z. */

const TOP = 0.1 // bridge surface
const MAG_Z = 0.012, SPARE = [[0.16, 0.36], [0.28, 0.36]]
const SPOT_SCALE = 0.002 // metres on the screen per mm of deflection
const PSU = { x: -0.55, z: -0.2, ry: 0.25, w: 0.44, h: 0.25, d: 0.26, pw: 0.4, ph: 0.207 }
const P = (x, y) => [((x - 130) / 540 - 0.5) * PSU.pw, (0.5 - (y - 260) / 280) * PSU.ph]

const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

/* ---- faces ---- */
function drawPanel(g, W, H) {
  const X = (x) => x - 130, Y = (y) => y - 260
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#E7EAEE'); bg.addColorStop(1, '#D3D7DD')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.fillStyle = '#26303C'; g.textAlign = 'center'; g.font = 'bold 15px Arial'; g.fillText('e/m THOMSON METHOD · CRT POWER SUPPLY', W / 2, Y(288))
  g.fillStyle = '#0C0D10'; g.fillRect(X(150), Y(306), 220, 80)
  g.fillStyle = '#3F4B5C'; g.font = '11px Arial'; g.fillText('DEFLECTION VOLTAGE', X(260), Y(402)); g.fillText('MAINS', X(620), Y(406))
  g.strokeStyle = '#8A93A0'; g.lineWidth = 1.5
  ;[[410, 'HT'], [535, 'LT']].forEach(([x, t]) => { g.strokeRect(X(x), Y(310), 110, 34); g.fillStyle = '#26303C'; g.font = '13px Arial'; g.textAlign = 'right'; g.fillText(t, X(x + 44), Y(332)); g.textAlign = 'left'; g.fillText('ON', X(x + 63), Y(332)); g.textAlign = 'center' })
  g.font = 'bold 12px Arial'; g.fillStyle = '#1F2B3A'
  ;[[190, 'FOCUS'], [295, 'INTENSITY'], [400, 'X-SHIFT'], [505, 'DEFLECTION'], [610, 'POLARITY']].forEach(([x, t]) => g.fillText(t, X(x), Y(512)))
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' }
function drawDisplay(g, w, h, text) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  if (!text) return
  const s = 44, step = 80, n = text.replace('.', '').length
  let x = w - 62 - n * step + 30
  g.lineCap = 'round'; g.lineWidth = 9
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - 18, 30 + s * 2, 6.5, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => {
      g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'
      g.beginPath(); g.moveTo(x + p[0] * s, 30 + p[1] * s); g.lineTo(x + p[2] * s, 30 + p[3] * s); g.stroke()
    })
    x += step
  })
  g.fillStyle = '#FF6B5E'; g.font = 'bold 26px Arial'; g.textAlign = 'left'; g.fillText('V', w - 38, h - 26)
}
function drawScale(g, w, h) {
  g.fillStyle = '#B98A55'; g.fillRect(0, 0, w, h)
  const mid = w / 2, perCm = w / 34
  g.strokeStyle = '#2C1C0C'; g.fillStyle = '#2C1C0C'; g.textAlign = 'center'; g.font = 'bold 22px Arial'
  for (let mm = -150; mm <= 150; mm += 1) {
    const x = mid + (mm / 10) * perCm, big = mm % 10 === 0, five = mm % 5 === 0
    g.lineWidth = big ? 2.6 : five ? 1.8 : 1
    g.beginPath(); g.moveTo(x, h); g.lineTo(x, h - (big ? 34 : five ? 24 : 15)); g.stroke()
    if (big && mm !== 0 && Math.abs(mm) >= 10) g.fillText(String(Math.abs(mm) / 10), x, h - 44)
  }
  g.font = 'bold 34px Arial'; g.fillText('W', 34, h - 36); g.fillText('E', w - 34, h - 36)
}
function drawScreen(g, w) {
  g.fillStyle = '#123524'; g.fillRect(0, 0, w, w)
  g.strokeStyle = '#3F8A63'; g.lineWidth = 2
  for (let i = -5; i <= 5; i++) {
    const p = w / 2 + (i * w) / 11
    g.lineWidth = i === 0 ? 3.5 : 1.6
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, w); g.moveTo(0, p); g.lineTo(w, p); g.stroke()
  }
}
function drawCompass(g, w) {
  const c = w / 2
  g.fillStyle = '#F4F1E6'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill()
  g.fillStyle = '#AFC7D6'; g.beginPath(); g.arc(c, c, c * 0.99, 0, 7); g.arc(c, c, c * 0.78, 0, 7, true); g.fill()
  g.strokeStyle = '#2A2A2A'; g.fillStyle = '#2A2A2A'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 30px Arial'
  for (let d = 0; d < 360; d += 2) {
    const a = rad(d), big = d % 10 === 0
    g.lineWidth = big ? 3 : 1.2
    const q = c * (big ? 0.68 : 0.72)
    g.beginPath(); g.moveTo(c + c * 0.77 * Math.cos(a), c + c * 0.77 * Math.sin(a)); g.lineTo(c + q * Math.cos(a), c + q * Math.sin(a)); g.stroke()
    if (d % 90 === 0) g.fillText(d % 180 === 0 ? '0' : '90', c + c * 0.56 * Math.cos(a), c + c * 0.56 * Math.sin(a))
  }
}

const VIEWS = {
  whole: { p: [-0.18, 0.6, 1.5], t: [-0.06, 0.12, 0.02] },
  screen: { p: [0.04, 0.3, 0.66], t: [0, 0.17, 0.03] },
  psu: { p: [-0.42, 0.3, 0.72], t: [PSU.x, 0.13, PSU.z] },
  bridge: { p: [0.1, 0.42, 0.72], t: [0.05, 0.1, 0] },
  compass: { p: [0.55, 0.42, 0.62], t: [0.56, 0.02, 0.2] },
}

function createScene(host, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xd6d8d2, exposure: 0.98, env: 0.55, shadow: { left: -1.1, right: 1.1, top: 1, bottom: -1, far: 6 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0x27332e, roughness: 0.75 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa97a48, roughness: 0.68 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x70491f, roughness: 0.72 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.42, metalness: 0.25 }),
    tube: new THREE.MeshStandardMaterial({ color: 0x5f7486, roughness: 0.38, metalness: 0.45 }),
    socket: new THREE.MeshStandardMaterial({ color: 0x3f2c20, roughness: 0.6 }),
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xd9eefa, transparent: true, opacity: 0.45, roughness: 0.08, clearcoat: 1, side: THREE.DoubleSide }),
    psu: new THREE.MeshStandardMaterial({ color: 0x4e5d6c, roughness: 0.45, metalness: 0.35 }),
    lid: new THREE.MeshStandardMaterial({ color: 0x74879a, roughness: 0.45, metalness: 0.3 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc12629, roughness: 0.42, metalness: 0.2 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x8b929c, roughness: 0.4, metalness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xe0ba5c, metalness: 0.9, roughness: 0.28 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.6 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const hitBox = (geo, x, y, z, d, parent) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const flat = (m) => { m.castShadow = false; return m }

  flat(add(box(4, 0.04, 2.6), M.table, 0, -0.02, 0))
  flat(add(new THREE.PlaneGeometry(7, 3), new THREE.MeshStandardMaterial({ color: 0xd9dbd5, roughness: 0.95 }), 0, 1.3, -1.2))

  /* wing bridge */
  add(box(0.46, 0.022, 0.1), M.wood, 0, TOP - 0.011, 0)
  ;[-0.19, 0.19].forEach((x) => add(box(0.05, TOP - 0.022, 0.12), M.woodDark, x, (TOP - 0.022) / 2, 0))
  const scaleFace = face(1700, 100, drawScale); scaleFace.set(1)
  const strip = flat(add(new THREE.PlaneGeometry(0.34, 0.02), new THREE.MeshStandardMaterial({ map: scaleFace.tex, roughness: 0.7 }), 0, TOP + 0.0006, 0.038))
  strip.rotation.x = -Math.PI / 2

  /* acrylic stand */
  flat(add(box(0.1, 0.006, 0.17), M.acrylic, 0, TOP + 0.003, 0))
  ;[-0.034, 0.034].forEach((x) => flat(add(box(0.005, 0.09, 0.13), M.acrylic, x, TOP + 0.05, -0.02)))

  /* CRT, tilted with the gun end raised; the screen is local +z */
  const crt = new THREE.Group(); crt.position.set(0, TOP + 0.08, 0); crt.rotation.x = 0.28; scene.add(crt)
  const along = (m) => { m.rotation.x = Math.PI / 2; return m }
  along(add(cyl(0.017, 0.17), M.tube, 0, 0, -0.115, crt))
  along(add(new THREE.CylinderGeometry(0.05, 0.017, 0.07, 40), M.tube, 0, 0, 0.005, crt))
  along(add(cyl(0.054, 0.014, 56), M.black, 0, 0, 0.047, crt))
  along(add(cyl(0.026, 0.03), M.socket, 0, 0, -0.215, crt))
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; along(add(cyl(0.0016, 0.004, 8), M.brass, Math.cos(a) * 0.019, Math.sin(a) * 0.019, -0.232, crt)) }
  const screenFace = face(512, 512, drawScreen); screenFace.set(1)
  flat(add(new THREE.CircleGeometry(0.0485, 56), new THREE.MeshBasicMaterial({ map: screenFace.tex, toneMapped: false }), 0, 0, 0.0545, crt))
  const halo = flat(add(new THREE.CircleGeometry(0.01, 24), new THREE.MeshBasicMaterial({ color: 0x4bff78, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }), 0, 0, 0.0552, crt))
  const spot = flat(add(new THREE.CircleGeometry(0.004, 24), new THREE.MeshBasicMaterial({ color: 0xb9ffcf, transparent: true, depthWrite: false, toneMapped: false }), 0, 0, 0.0556, crt))

  /* magnets: north half red, south half grey */
  const magnet = (parent) => {
    const g = new THREE.Group(); parent.add(g)
    add(box(0.025, 0.018, 0.018), M.grey, -0.0125, 0.009, 0, g); add(box(0.025, 0.018, 0.018), M.red, 0.0125, 0.009, 0, g)
    return g
  }
  const pair = [-1, 1].map((sg) => { const g = magnet(scene); const h = hitBox(box(0.075, 0.05, 0.05), 0, 0.012, 0, 'mag', g); h.userData.sg = sg; return g })
  SPARE.forEach(([x, z]) => { const g = magnet(scene); g.position.set(x, 0, z); g.rotation.y = 0.15 })

  /* compass */
  const compass = new THREE.Group(); compass.position.set(0.56, 0, 0.2); scene.add(compass)
  add(cyl(0.088, 0.03, 56), M.socket, 0, 0.015, 0, compass)
  const rim = add(new THREE.TorusGeometry(0.083, 0.006, 12, 64), M.brass, 0, 0.031, 0, compass); rim.rotation.x = Math.PI / 2
  const dialFace = face(720, 720, drawCompass); dialFace.set(1)
  const dial = flat(add(new THREE.CircleGeometry(0.08, 56), new THREE.MeshStandardMaterial({ map: dialFace.tex, roughness: 0.4, metalness: 0.1 }), 0, 0.0312, 0, compass)); dial.rotation.x = -Math.PI / 2
  const needle = new THREE.Group(); needle.position.y = 0.0345; compass.add(needle)
  add(box(0.05, 0.002, 0.005), new THREE.MeshStandardMaterial({ color: 0xc8211a, roughness: 0.4 }), 0.025, 0, 0, needle)
  add(box(0.05, 0.002, 0.005), new THREE.MeshStandardMaterial({ color: 0x1d3f7a, roughness: 0.4 }), -0.025, 0, 0, needle)
  add(cyl(0.004, 0.005, 14), M.brass, 0, 0.001, 0, needle)

  /* supply */
  const psu = new THREE.Group(); psu.position.set(PSU.x, 0, PSU.z); psu.rotation.y = PSU.ry; scene.add(psu)
  add(box(PSU.w, PSU.h, PSU.d), M.psu, 0, PSU.h / 2, 0, psu)
  add(box(PSU.w * 0.9, 0.012, PSU.d * 0.84), M.lid, 0, PSU.h + 0.006, 0, psu)
  const panel = new THREE.Group(); panel.position.set(0, PSU.h / 2, PSU.d / 2 + 0.0008); psu.add(panel)
  const art = face(540, 280, drawPanel); art.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(PSU.pw, PSU.ph), new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.55 })))
  const dispFace = face(440, 160, drawDisplay)
  const [dx, dy] = P(260, 346)
  const disp = new THREE.Mesh(new THREE.PlaneGeometry((206 / 540) * PSU.pw, (68 / 280) * PSU.ph), new THREE.MeshBasicMaterial({ map: dispFace.tex, toneMapped: false }))
  disp.position.set(dx, dy, 0.0006); panel.add(disp)
  const led = (x, y, r, off) => { const [a, b] = P(x, y); const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: off, toneMapped: false })); m.position.set(a, b, 0.001); panel.add(m); return m }
  const leds = { ht: led(465, 328, 0.0034, 0x3a2020), lt: led(590, 328, 0.0034, 0x3a2020), mains: led(620, 380, 0.0075, 0x5a1414) }
  const clicker = (x, y, w, h, d) => { const [a, b] = P(x, y); hitBox(box(w, h, 0.02), a, b, 0.008, d, panel) }
  clicker(465, 327, 0.085, 0.03, 'ht'); clicker(590, 327, 0.085, 0.03, 'lt')
  const [ra, rb] = P(532, 380)
  add(box(0.034, 0.024, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(box(0.015, 0.019, 0.005), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.007, rb, 0.004, panel)
  clicker(532, 380, 0.05, 0.04, 'power')
  const knob = (x, name) => {
    const [a, b] = P(x, 465)
    const g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g)
    const ring = add(cyl(0.0205, 0.002, 36), M.chrome, 0, 0, 0.001, g); ring.rotation.x = Math.PI / 2
    const k = add(cyl(0.0155, 0.016, 32), M.black, 0, 0, 0.009, g); k.rotation.x = Math.PI / 2
    add(box(0.002, 0.012, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.009, 0.0175, g)
    hitBox(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 12), 0, 0, 0.012, name, g).rotation.x = Math.PI / 2
    return g
  }
  const knobs = { focus: knob(190, 'focus'), bright: knob(295, 'bright'), xs: knob(400, 'xs'), defl: knob(505, 'defl'), pol: knob(610, 'pol') }

  /* cable from the gun socket to the supply */
  scene.updateMatrixWorld(true)
  const a = crt.localToWorld(new THREE.Vector3(0, 0, -0.235)), b = psu.localToWorld(new THREE.Vector3(PSU.w / 2, 0.14, 0))
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, new THREE.Vector3(a.x - 0.03, a.y + 0.05, a.z - 0.06), new THREE.Vector3(-0.2, 0.2, -0.3), new THREE.Vector3(b.x + 0.05, 0.1, b.z), b]), 70, 0.0035, 8), M.cable, 0, 0, 0)

  function draw() { renderer.render(scene, camera) }
  const applyView = (name) => { const w = VIEWS[name]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.25; orbit.maxDistance = 2.4; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.3; orbit.maxAzimuthAngle = 1.3
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  /* pointer */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP)
  const el = renderer.domElement
  const pick = (e) => {
    const r = el.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d)
  }
  const S = { v: null, drag: null }
  const c = (k) => ctl.find((q) => q.k === k)
  const TURN = { focus: 'focus', bright: 'bright', xs: 'xs' }
  const onDown = (e) => {
    const h = pick(e), u = h?.object.userData
    if (!u) return
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    const v = S.v, d = u.d
    if (d === 'power') { api.set('on', !v.on); S.drag = { none: true }; return }
    if (d === 'ht' || d === 'lt') { api.set(d, !v[d]); S.drag = { none: true }; return }
    if (d === 'pol') { api.set('pol', -v.pol); S.drag = { none: true }; return }
    S.drag = { d, x: e.clientX, y: e.clientY, moved: false, u: TURN[d] ? v[TURN[d]] : 0, Vy: v.Vy }
  }
  const onMove = (e) => {
    const s = S.drag
    if (!s) {
      const d = pick(e)?.object.userData.d
      el.style.cursor = !d ? 'move' : ['power', 'ht', 'lt', 'pol'].includes(d) ? 'pointer' : 'grab'
      return
    }
    if (s.none) return
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 4) s.moved = true
    if (TURN[s.d]) api.set(TURN[s.d], clamp(s.u + mv / 240, 0, 1))
    if (s.d === 'defl') { const q = c('Vy'); api.set('Vy', quant(q, s.Vy + (mv / 240) * (q.max - q.min))) }
    if (s.d === 'mag' && s.moved && S.v.mag) {
      pick(e)
      const p = ray.ray.intersectPlane(plane, hitP)
      if (p) api.set('x', quant(c('x'), Math.abs(p.x) * 100))
    }
  }
  const onUp = () => {
    const s = S.drag
    if (s && s.d === 'mag' && !s.moved) api.set('mag', !S.v.mag)
    S.drag = null; orbit.enabled = true
  }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  function update(v, o) {
    S.v = v
    pair.forEach((g, i) => {
      if (v.mag) { g.position.set((i ? 1 : -1) * (v.x / 100), TOP, MAG_Z); g.rotation.y = 0 } else { g.position.set(0.02 + i * 0.12, 0, 0.3 + i * 0.012); g.rotation.y = -0.12 }
    })
    needle.rotation.y = o.th
    const beam = v.on && v.ht && v.lt
    const blur = Math.abs(v.focus - 0.6) * 0.03, level = clamp(v.bright / 0.7, 0.06, 1)
    spot.visible = halo.visible = beam
    const sx = (v.xs - 0.5) * 0.04, sy = clamp(o.net * SPOT_SCALE, -0.043, 0.043)
    spot.position.x = halo.position.x = sx; spot.position.y = halo.position.y = sy
    spot.scale.setScalar(1 + blur / 0.004); halo.scale.setScalar(1 + blur / 0.01)
    spot.material.opacity = level * clamp(1 - blur / 0.03, 0.3, 1); halo.material.opacity = level * 0.3

    dispFace.set(`${v.on}${v.Vy}`, v.on ? v.Vy.toFixed(2) : '')
    leds.mains.material.color.set(v.on ? 0xff3b30 : 0x5a1414)
    leds.ht.material.color.set(v.on && v.ht ? 0x4bff78 : 0x3a2020)
    leds.lt.material.color.set(v.on && v.lt ? 0x4bff78 : 0x3a2020)
    rocker.position.x = ra + (v.on ? -0.007 : 0.007)
    const ang = (u) => rad(135 - u * 270)
    knobs.focus.rotation.z = ang(v.focus); knobs.bright.rotation.z = ang(v.bright); knobs.xs.rotation.z = ang(v.xs)
    const q = c('Vy'); knobs.defl.rotation.z = ang((v.Vy - q.min) / (q.max - q.min))
    knobs.pol.rotation.z = v.pol > 0 ? rad(-60) : rad(60)
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

const LABELS = [['whole', 'Whole kit'], ['screen', 'CRT screen'], ['psu', 'Power supply'], ['bridge', 'Magnets'], ['compass', 'Compass']]

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
        <p className="stage3d-hint">Drag a bar magnet along the bridge, or click it to lift the pair off. Turn the knobs on the supply and click HT, LT, POLARITY and the power switch. Drag the background to look around.</p>
      </div>
    )
  }
}

const NO_BEAM = 'There is no beam. Turn on the power, HT and LT on the supply.'
export const thomson3D = emThomson.map((e) => {
  const list = e.sweep?.list
  return {
    ...e,
    wide: true,
    state: () => ({ on: true, ht: true, lt: true, pol: 1, focus: 0.6, bright: 0.7, xs: 0.5 }),
    out: (v, t) => {
      const o = e.out(v, t), beam = v.on && v.ht && v.lt
      return { ...o, beam, net: beam ? (v.pol * o.yE - o.yB) * 1000 : 0 }
    },
    sample: (v, o) => (o.beam ? e.sample(v, o) : { error: NO_BEAM }),
    ...(list ? { sweep: { ...e.sweep, list: (v) => list(v).map((p) => ({ ...p, pol: 1 })) } } : {}),
    Stage: make(e),
  }
})
