import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { seebeck } from './thermal'
import { createStudio, face, quant } from './studio3d'

/* The Seebeck and Peltier kit as a working 3D model: a Peltier module between two finned heat
   sinks in thermal wool, with probes, and the instrument unit. Metres. */

const U = { x: -0.42, z: -0.22, ry: 0.14, w: 0.64, h: 0.26, d: 0.26, x0: 109, y0: 309, W: 802, H: 282, pw: 0.6 }
U.ph = (U.pw * U.H) / U.W
const P = (x, y) => [((x - U.x0) / U.W - 0.5) * U.pw, (0.5 - (y - U.y0) / U.H) * U.ph]
const BX = 0.5, BZ = 0.16, MOD_Y = 0.218, FIN = 0.14, SW = 0.3, SD = 0.2
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

function drawPanel(g, W, H) {
  const k = W / U.W, X = (x) => (x - U.x0) * k, Y = (y) => (y - U.y0) * k
  const t = (s, x, y, z = 10, bold = true, c = '#1F2B3A') => { g.fillStyle = c; g.font = `${bold ? 'bold ' : ''}${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#F1F3F6'); bg.addColorStop(1, '#E2E6EB'); g.fillStyle = bg; g.fillRect(0, 0, W, H)
  t('PELTIER & SEEBECK EFFECT KIT', 510, 338, 20, true, '#1D3F66')
  g.fillStyle = '#0C0D10'; [[130, 360, 180, 70], [325, 360, 180, 70], [535, 364, 168, 62], [713, 364, 168, 62]].forEach(([a, b, c, d]) => g.fillRect(X(a), Y(b), c * k, d * k))
  g.strokeStyle = '#AEB5C1'; g.lineWidth = 2; g.strokeRect(X(525), Y(356), 365 * k, 100 * k)
  t('DIGITAL VOLTMETER', 220, 448); t('DIGITAL AMMETER', 415, 448); t('DUAL-CHANNEL TEMPERATURE INDICATOR', 707, 470)
  g.fillStyle = '#D93A32'; g.fillRect(X(591), Y(431), 56 * k, 15 * k); g.fillStyle = '#1E88E5'; g.fillRect(X(769), Y(431), 56 * k, 15 * k)
  t('T1 HOT', 619, 442.5, 9, true, '#FFF'); t('T2 COLD', 797, 442.5, 9, true, '#FFF')
  t('VOLTAGE 0-12 V', 180, 576); t('MODE', 325, 572); t('TO MODULE', 475, 568); t('PROBE T1', 580, 562, 9); t('PROBE T2', 670, 562, 9); t('MAINS', 845, 568)
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '-': 'g' }
function drawRed(g, w, h, text, unit) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  if (text === null) return
  const s = 0.3 * h, step = s * 1.72, n = text.replace('.', '').length, top = h * 0.17
  let x = w - w * 0.13 - n * step + step * 0.3
  g.lineCap = 'round'; g.lineWidth = s * 0.2
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - step * 0.22, top + s * 2, s * 0.12, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, top + p[1] * s); g.lineTo(x + p[2] * s, top + p[3] * s); g.stroke() })
    x += step
  })
  g.fillStyle = '#FF6B5E'; g.font = `bold ${h * 0.16}px Arial`; g.textAlign = 'right'; g.fillText(unit, w - 8, h - h * 0.12)
}
function drawModule(g, w, h) { g.fillStyle = '#F0EEE6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#2F6DB5' : '#C84A3A'; g.fillRect(14 + i * (w - 28) / 18, h * 0.2, (w - 28) / 18 - 6, h * 0.6) } }
const label = (t, size, col) => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) }
const soft = (rgb) => (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, `rgba(${rgb},.75)`); r.addColorStop(1, `rgba(${rgb},0)`); g.clearRect(0, 0, w, w); g.fillStyle = r; g.fillRect(0, 0, w, w) }

const VIEWS = {
  whole: { p: [0.06, 0.66, 1.92], t: [0.04, 0.2, 0] },
  unit: { p: [-0.34, 0.32, 0.74], t: [U.x, 0.13, U.z] },
  sinks: { p: [0.44, 0.34, 0.92], t: [BX, 0.22, BZ] },
  module: { p: [0.5, 0.25, 0.46], t: [BX, MOD_Y, BZ] },
  probes: { p: [0.12, 0.3, 0.68], t: [0.16, 0.22, 0.16] },
}

function createScene(host, kind, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xe2e0db, exposure: 1, env: 0.6, shadow: { left: -1.1, right: 1.1, top: 1, bottom: -0.9, far: 7 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.74 }), black: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.42, metalness: 0.25 }), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x29507c, roughness: 0.45, metalness: 0.25 }), lid: new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.45, metalness: 0.25 }), wool: new THREE.MeshStandardMaterial({ color: 0xece0c2, roughness: 0.95 }),
    hot: new THREE.MeshStandardMaterial({ color: 0xc9b0a6, metalness: 0.75, roughness: 0.38 }), cold: new THREE.MeshStandardMaterial({ color: 0xa9bcd0, metalness: 0.75, roughness: 0.38 }), hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const tube = (pts, col, r = 0.003) => { const c = new THREE.CatmullRomCurve3(pts); const m = add(new THREE.TubeGeometry(c, 90, r, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }), 0, 0, 0); m.userData.curve = c; return m }

  plain(add(box(4.4, 0.04, 2.6), M.table, 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xe3e1dc, roughness: 0.95 }), 0, 1.3, -1.2))

  /* instrument unit */
  const unit = new THREE.Group(); unit.position.set(U.x, 0, U.z); unit.rotation.y = U.ry; scene.add(unit)
  add(box(U.w, U.h, U.d), M.blue, 0, U.h / 2, 0, unit); add(box(U.w * 0.93, 0.012, U.d * 0.86), M.lid, 0, U.h + 0.006, 0, unit)
  const panel = new THREE.Group(); panel.position.set(0, U.h / 2, U.d / 2 + 0.0008); unit.add(panel)
  const art = face(1604, 564, drawPanel); art.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(U.pw, U.ph), new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.55 })))
  const screen = (x1, y1, x2, y2, tw, th) => { const f = face(tw, th, drawRed), [a, b] = P((x1 + x2) / 2, (y1 + y2) / 2), m = new THREE.Mesh(new THREE.PlaneGeometry(((x2 - x1) / U.W) * U.pw, ((y2 - y1) / U.H) * U.ph), new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false })); m.position.set(a, b, 0.0006); panel.add(m); return f }
  const vF = screen(136, 366, 304, 424, 420, 150), iF = screen(331, 366, 499, 424, 420, 150), t1F = screen(541, 370, 697, 420, 400, 130), t2F = screen(719, 370, 875, 420, 400, 130)
  const [ka, kb] = P(180, 526), knob = new THREE.Group(); knob.position.set(ka, kb, 0); panel.add(knob)
  alongZ(add(cyl(0.0245, 0.002, 36), M.chrome, 0, 0, 0.001, knob)); alongZ(add(cyl(0.0185, 0.018, 34), M.black, 0, 0, 0.01, knob)); add(box(0.0026, 0.016, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.012, 0.0195, knob); alongZ(hitBox(cyl(0.034, 0.05, 12), 0, 0, 0.014, 'V', knob))
  const keys = [[290, 'PELTIER', 'mode:peltier'], [360, 'SEEBECK', 'mode:seebeck']].map(([x, t, d]) => {
    const [a, b] = P(x, 532), w = 0.05, h = 0.024, mat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.45 })
    add(box(w, h, 0.005), mat, a, b, 0.0025, panel)
    const f = face(200, 96, label(t, 28, '#26303C')); f.set(1); plain(add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), a, b, 0.0054, panel))
    hitBox(box(w * 1.05, h * 1.4, 0.02), a, b, 0.008, d, panel)
    return { mat, m: d.slice(5) }
  })
  const [ra, rb] = P(845, 530)
  add(box(0.04, 0.03, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(box(0.018, 0.024, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.009, rb, 0.004, panel)
  hitBox(box(0.055, 0.045, 0.03), ra, rb, 0.01, 'pwr', panel)
  scene.updateMatrixWorld(true)
  const sock = (x, y, c, d) => { const [a, b] = P(x, y); alongZ(add(cyl(0.0115, 0.004, 22), M.chrome, a, b, 0.002, panel)); alongZ(add(cyl(0.0075, 0.006, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), a, b, 0.004, panel)); hitBox(new THREE.SphereGeometry(0.018, 10, 8), a, b, 0.012, d, panel); return panel.localToWorld(V(a, b, 0.008)) }
  const sR = sock(450, 532, 0xd92b20, 'rev'), sB = sock(500, 532, 0x2a2c31, 'rev'), s1 = sock(580, 530, 0x15161a, 'p1'), s2 = sock(670, 530, 0x15161a, 'p2')

  /* wool enclosure, cut away at the front */
  const WB = BX, WT = 0.46
  add(box(0.42, WT, 0.02), M.wool, WB, WT / 2, BZ - 0.13)
  ;[-1, 1].forEach((sg) => add(box(0.06, WT, 0.26), M.wool, WB + sg * 0.19, WT / 2, BZ))
  add(box(0.42, 0.02, 0.26), M.wool, WB, 0.01, BZ); add(box(0.42, 0.02, 0.26), M.wool, WB, WT - 0.01, BZ)

  /* heat sinks and module */
  const sink = (dir, mat) => {
    const plateY = MOD_Y + dir * 0.022
    add(box(SW, 0.022, SD), mat, BX, plateY, BZ)
    for (let i = 0; i < 11; i++) add(box(0.009, FIN, SD), mat, BX - SW / 2 + 0.015 + (i * (SW - 0.03)) / 10, plateY + dir * (0.011 + FIN / 2), BZ)
  }
  sink(1, M.hot); sink(-1, M.cold)
  hitBox(box(SW, FIN + 0.03, SD), BX, MOD_Y + 0.022 + FIN / 2, BZ + 0.02, 'hot')
  hitBox(box(SW, FIN + 0.03, SD), BX, MOD_Y - 0.022 - FIN / 2, BZ + 0.02, 'cold')
  const modF = face(800, 72, drawModule); modF.set(1)
  add(box(0.18, 0.012, 0.15), new THREE.MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.5 }), BX, MOD_Y, BZ)
  plain(add(new THREE.PlaneGeometry(0.18, 0.012), new THREE.MeshBasicMaterial({ map: modF.tex }), BX, MOD_Y, BZ + 0.0755))
  const mkGlow = (rgb, y) => { const f = face(128, 128, soft(rgb)); f.set(1); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: f.tex, transparent: true, depthWrite: false, opacity: 0 })); s.scale.set(0.38, 0.24, 1); s.position.set(BX, y, BZ + 0.13); scene.add(s); return s }
  const glowH = mkGlow('255,110,60', MOD_Y + 0.1), glowC = mkGlow('90,170,255', MOD_Y - 0.1)
  const caption = (t, y, col) => { const f = face(220, 80, label(t, 54, col)); f.set(1); plain(add(new THREE.PlaneGeometry(0.055, 0.02), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), BX + 0.19, y, BZ + 0.1305)) }
  caption('HOT', MOD_Y + 0.1, '#C8401E'); caption('COLD', MOD_Y - 0.1, '#1F68B4')

  /* probes */
  const probe = (y, col, side, name) => {
    alongX(add(cyl(0.0035, 0.2, 12), M.chrome, BX - 0.21, y, BZ))
    alongX(add(cyl(0.012, 0.08, 18), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), BX - 0.34, y, BZ))
    const f = face(180, 70, label(name, 44, '#FFF')); f.set(1); plain(add(new THREE.PlaneGeometry(0.05, 0.02), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), BX - 0.34, y, BZ + 0.0125))
    hitBox(box(0.12, 0.04, 0.05), BX - 0.34, y, BZ, side)
    return V(BX - 0.38, y, BZ)
  }
  const e1 = probe(MOD_Y + 0.022, 0xe53935, 'p1', 'T1'), e2 = probe(MOD_Y - 0.022, 0x1e88e5, 'p2', 'T2')
  const lead = (a, b, col, offset) => tube([a, a.clone().add(V(0, -0.05, 0.1)), V((a.x + b.x) / 2 + offset, 0.05, (a.z + b.z) / 2 + 0.16), b.clone().add(V(-0.1, 0, 0.02)), b], col)
  const pL = [lead(s1, e1, 0xe53935, 0), lead(s2, e2, 0x1e88e5, 0.03)]
  const offEnds = [V(e1.x - 0.34, 0.0065, e1.z + 0.14), V(e2.x - 0.3, 0.0065, e2.z + 0.18)]
  const pO = [tube([s1, s1.clone().add(V(0, -0.06, 0.1)), V(s1.x + 0.04, 0.03, s1.z + 0.2), offEnds[0]], 0xe53935), tube([s2, s2.clone().add(V(0, -0.06, 0.1)), V(s2.x + 0.04, 0.03, s2.z + 0.2), offEnds[1]], 0x1e88e5)]

  /* module leads, drawn straight or crossed for reversed polarity */
  const mA = V(BX + 0.09, MOD_Y + 0.002, BZ + 0.075), mB = V(BX + 0.09, MOD_Y - 0.003, BZ + 0.075)
  const mod = (a, b, col, up) => tube([a, a.clone().add(V(0.03, -0.05, 0.1)), V(0.1, 0.03 + up, 0.46), V(BX + 0.2, 0.05 + up, 0.48), V(BX + 0.26, MOD_Y, BZ + 0.16), b.clone().add(V(0.05, 0, 0.05)), b], col)
  const normal = [mod(sR, mA, 0xc42a26, 0), mod(sB, mB, 0x101114, 0.012)], crossed = [mod(sR, mB, 0xc42a26, 0), mod(sB, mA, 0x101114, 0.012)]
  const beadMat = new THREE.MeshBasicMaterial({ color: 0x5cc8ff })
  const beads = Array.from({ length: 30 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0044, 10, 8), beadMat); m.visible = false; scene.add(m); return m })

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement
  const pick = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d) }
  const Q = { v: null, drag: null }
  const c = (k) => ctl.find((q) => q.k === k)
  const usable = (d) => { if (d === 'V' || d === 'rev') return kind === 'peltier'; if (d === 'hot' || d === 'cold') return kind === 'seebeck'; return true }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d || !usable(d)) return
    orbit.enabled = false; el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d.startsWith('mode:')) { api.set('mode', d.slice(5)); return }
    if (d === 'pwr' || d === 'rev' || d === 'p1' || d === 'p2') { api.set(d, !v[d]); return }
    Q.drag = { d, x: e.clientX, y: e.clientY, val: d === 'V' ? v.V : d === 'hot' ? v.Th : v.Tc }
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d || !usable(d) ? 'move' : d === 'V' ? 'grab' : d === 'hot' || d === 'cold' ? 'ns-resize' : 'pointer'; return }
    if (s.none) return
    if (s.d === 'V') { const q = c('V'); api.set('V', quant(q, s.val + (((e.clientX - s.x) - (e.clientY - s.y)) / 240) * (q.max - q.min))) }
    if (s.d === 'hot') api.set('Th', quant(c('Th'), s.val + (s.y - e.clientY) / 3))
    if (s.d === 'cold') api.set('Tc', quant(c('Tc'), s.val + (s.y - e.clientY) / 8))
  }
  const onUp = () => { Q.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const neutral = new THREE.Color(0xb9bec6), warm = new THREE.Color(0xd8866a), cool = new THREE.Color(0x7fa8d8), tint = new THREE.Color()
  const paintSink = (mat, T, glow) => { const u = clamp((T - 28) / 30, -1, 1); tint.copy(neutral).lerp(u > 0 ? warm : cool, Math.abs(u)); mat.color.copy(tint); glow.material.opacity = Math.abs(u) * 0.7; return u }
  function update(v, o, t) {
    Q.v = v
    const T = o.temps
    paintSink(M.hot, T[0], glowH); paintSink(M.cold, T[1], glowC)
    glowH.material.color.set(T[0] >= 28 ? 0xffffff : 0x66aaff); glowC.material.color.set(T[1] < 28 ? 0xffffff : 0xff7a4a)
    const live = v.pwr && v.mode === kind
    vF.set(`${o.vShown}${v.pwr}`, v.pwr ? o.vShown.toFixed(2) : null, 'V'); iF.set(`${o.iShown}${v.pwr}`, v.pwr ? o.iShown.toFixed(2) : null, 'A')
    t1F.set(`${T[0]}${v.pwr}${v.p1}`, !v.pwr ? null : v.p1 ? T[0].toFixed(1) : '---', '°C'); t2F.set(`${T[1]}${v.pwr}${v.p2}`, !v.pwr ? null : v.p2 ? T[1].toFixed(1) : '---', '°C')
    keys.forEach((q) => q.mat.color.set(v.mode === q.m ? 0xff7043 : 0xdfe3e8))
    rocker.position.x = ra + (v.pwr ? -0.009 : 0.009)
    if (kind === 'peltier') knob.rotation.z = rad(135 - (v.V / c('V').max) * 270)
    pL.forEach((m, i) => { m.visible = i ? v.p2 : v.p1 }); pO.forEach((m, i) => { m.visible = !(i ? v.p2 : v.p1) })
    const rev = kind === 'peltier' && v.rev
    normal.forEach((m) => { m.visible = !rev }); crossed.forEach((m) => { m.visible = rev })
    const flowing = live && kind === 'peltier' && o.iShown > 0
    beads.forEach((b, i) => {
      b.visible = flowing
      if (!flowing) return
      const lead = (rev ? crossed : normal)[i < 15 ? 0 : 1], s = ((i % 15) / 15 + t * (0.03 + o.iShown * 0.01)) % 1
      lead.userData.curve.getPointAt(i < 15 ? s : 1 - s, b.position)
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

const LABELS = [['whole', 'Whole kit'], ['unit', 'Instrument unit'], ['sinks', 'Heat sinks'], ['module', 'Peltier module'], ['probes', 'Probes']]
const HINTS = {
  seebeck: 'Drag the upper heat sink up or down to set the hot side, and the lower one for the cold side. Press MODE, MAINS and the probe sockets on the unit. Drag the background to look around.',
  peltier: 'Turn VOLTAGE on the unit and watch the sinks change. Click a TO MODULE socket to swap the leads and reverse the heat flow. Press MODE, MAINS and the probe sockets. Drag the background to look around.',
}

function make(exp, kind) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({})
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, kind, exp.controls, { set: (k, x) => api.current.set(k, x) }) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
        </div>
        <p className="stage3d-hint">{HINTS[kind]}</p>
      </div>
    )
  }
}

export const seebeck3D = seebeck.map((e) => {
  const kind = e.id === 'seebeck-effect' ? 'seebeck' : 'peltier'
  const name = kind === 'seebeck' ? 'SEEBECK' : 'PELTIER'
  return {
    ...e,
    wide: true,
    state: () => ({ pwr: true, mode: kind, p1: true, p2: true, ...(kind === 'peltier' ? {} : { rev: false }) }),
    out: (v, t) => {
      const live = v.pwr && v.mode === kind
      if (kind === 'seebeck') { const o = e.out(v, t); return { ...o, temps: [v.Th, v.Tc], vShown: live ? o.V : 0, iShown: 0 } }
      const o = e.out(live ? v : { ...v, V: 0 }, t), s = v.rev ? -1 : 1
      return { ...o, temps: [28 + (s * o.dT) / 2 + o.I * 1.1, 28 - (s * o.dT) / 2 + o.I * 1.1], vShown: live ? v.V : 0, iShown: live ? o.I : 0 }
    },
    read: (v, o) => (v.pwr && v.mode === kind ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: (v, o) => {
      if (!v.pwr) return { error: 'The unit is off. Press the MAINS switch.' }
      if (v.mode !== kind) return { error: `Set MODE to ${name} first.` }
      if (!v.p1 || !v.p2) return { error: 'Plug in both temperature probes first.' }
      return e.sample(v, o)
    },
    Stage: make(e, kind),
  }
})
