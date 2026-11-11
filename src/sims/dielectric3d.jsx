import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { dielectric } from './thermal'
import { createStudio, face, quant } from './studio3d'

/* The dielectric constant kit as a working 3D model: digital capacitance meter, concentric-cylinder
   cell, parallel plates with a micrometer gap, liquid bottle and solid samples. Metres. */

const METER = { x: -0.56, z: -0.04, ry: 0.16, w: 0.46, h: 0.25, d: 0.22, x0: 122, y0: 392, W: 536, H: 266, pw: 0.42 }
METER.ph = (METER.pw * METER.H) / METER.W
const P = (x, y) => [((x - METER.x0) / METER.W - 0.5) * METER.pw, (0.5 - (y - METER.y0) / METER.H) * METER.ph]
const CELL_X = 0.02, CELL_Z = 0.06, ZERO_Y = 0.04, MM = 0.0022 // cell scale: metres on the model per mm of liquid
const PL_X = 0.52, PL_Z = 0.06, PL_Y = 0.106, GAP = 0.008 // plate gap drawn 8 times true size
const RANGES = [200, 1000]
const SOLIDS = [['gl', 'Glass', 0xbfe0ee, 0.36], ['pp', 'Perspex', 0xeae6da, 0.52], ['bk', 'Bakelite', 0x5e3020, 0.68]]
const LIQUIDS = { eth: 'ETHANOL', ace: 'ACETONE', met: 'METHANOL' }
const rad = (d) => (d * Math.PI) / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

function drawPanel(g, W, H) {
  const k = W / METER.W, X = (x) => (x - METER.x0) * k, Y = (y) => (y - METER.y0) * k
  const text = (t, x, y, s, bold = true, col = '#26303C') => { g.fillStyle = col; g.font = `${bold ? 'bold ' : ''}${s * k}px Arial`; g.textAlign = 'center'; g.fillText(t, X(x), Y(y)) }
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#EDEFF2'); bg.addColorStop(1, '#D9DCE1'); g.fillStyle = bg; g.fillRect(0, 0, W, H)
  text('DIGITAL CAPACITANCE METER', 390, 426, 19); text('1 pF – 1000 pF', 390, 446, 11, false, '#566273')
  g.fillStyle = '#0C0D10'; g.fillRect(X(150), Y(462), 300 * k, 96 * k)
  text('200 pF', 506, 475, 10.5); text('1000 pF', 578, 475, 10.5); text('RANGE', 540, 565, 10.5); text('Cx INPUT', 500, 635, 10.5); text('MAINS', 605, 635, 10.5)
}
const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' }
function drawDisplay(g, w, h, text, tag) {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  if (text === null) return
  const s = 56, step = 94, n = text.replace('.', '').length
  let x = w - 110 - n * step + 36
  g.lineCap = 'round'; g.lineWidth = 11
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - 22, 32 + s * 2, 8, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] || '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, 32 + p[1] * s); g.lineTo(x + p[2] * s, 32 + p[3] * s); g.stroke() })
    x += step
  })
  g.fillStyle = '#FF6B5E'; g.font = 'bold 34px Arial'; g.textAlign = 'right'; g.fillText('pF', w - 16, h - 28)
  if (tag) { g.textAlign = 'left'; g.font = 'bold 26px Arial'; g.fillText(tag, 16, 36) }
}
function drawGrad(g, w, h) {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#17324C'; g.fillStyle = '#17324C'; g.font = 'bold 28px Arial'; g.textAlign = 'right'
  for (let mm = 0; mm <= 100; mm += 5) { const y = h - 20 - (mm / 100) * (h - 40), big = mm % 10 === 0; g.lineWidth = big ? 4 : 2; g.beginPath(); g.moveTo(w - 70, y); g.lineTo(w - (big ? 8 : 34), y); g.stroke(); if (big) g.fillText(String(mm / 10), w - 80, y + 10) }
}
const drawLabel = (g, w, h, name) => { g.fillStyle = '#FBF8EF'; g.fillRect(0, 0, w, h); g.fillStyle = '#1C1C1C'; g.textAlign = 'center'; g.font = 'bold 40px Arial'; g.fillText(name, w / 2, 76); g.font = '26px Arial'; g.fillStyle = '#555'; g.fillText('polar liquid', w / 2, 122); g.fillText('sample', w / 2, 156) }
const text = (t, size, col) => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2) }

const VIEWS = {
  whole: { p: [-0.02, 0.62, 1.84], t: [-0.02, 0.17, 0.08] },
  meter: { p: [-0.48, 0.3, 0.7], t: [METER.x, 0.13, METER.z] },
  cell: { p: [0.08, 0.3, 0.68], t: [CELL_X, 0.17, CELL_Z] },
  plates: { p: [0.5, 0.3, 0.66], t: [PL_X, 0.2, PL_Z] },
  samples: { p: [0.36, 0.34, 0.76], t: [0.36, 0.02, 0.34] },
}

function createScene(host, kind, ctl, api) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xdde0e3, exposure: 1, env: 0.6, shadow: { left: -1.2, right: 1.2, top: 1, bottom: -1, far: 6 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.74 }),
    case: new THREE.MeshStandardMaterial({ color: 0x8b929c, roughness: 0.42, metalness: 0.5 }),
    lid: new THREE.MeshStandardMaterial({ color: 0xa8aeb7, roughness: 0.42, metalness: 0.45 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1d2026, roughness: 0.42, metalness: 0.28 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xe0ba5c, metalness: 0.85, roughness: 0.3 }),
    key: new THREE.MeshStandardMaterial({ color: 0x24344a, roughness: 0.45 }),
    bottle: new THREE.MeshStandardMaterial({ color: 0x774b28, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0f8, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    liquid: new THREE.MeshBasicMaterial({ color: 0x8fc8ea, transparent: true, opacity: 0.42, depthWrite: false }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const hitBox = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const plain = (m) => { m.castShadow = false; return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const sign = (t, w, h, size, col) => { const f = face(Math.round(w * 4000), Math.round(h * 4000), text(t, size, col)); f.set(1); return new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }) }

  plain(add(box(4.4, 0.04, 2.6), M.table, 0, -0.02, 0))
  plain(add(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xdee1e4, roughness: 0.95 }), 0, 1.3, -1.2))

  /* meter */
  const meter = new THREE.Group(); meter.position.set(METER.x, 0, METER.z); meter.rotation.y = METER.ry; scene.add(meter)
  add(box(METER.w, METER.h, METER.d), M.case, 0, METER.h / 2, 0, meter)
  add(box(METER.w * 0.92, 0.012, METER.d * 0.86), M.lid, 0, METER.h + 0.006, 0, meter)
  const panel = new THREE.Group(); panel.position.set(0, METER.h / 2, METER.d / 2 + 0.0008); meter.add(panel)
  const art = face(1072, 532, drawPanel); art.set(1)
  panel.add(new THREE.Mesh(new THREE.PlaneGeometry(METER.pw, METER.ph), new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.55 })))
  const dispF = face(620, 200, drawDisplay), [da, db] = P(300, 510)
  const disp = new THREE.Mesh(new THREE.PlaneGeometry((284 / METER.W) * METER.pw, (82 / METER.H) * METER.ph), new THREE.MeshBasicMaterial({ map: dispF.tex, toneMapped: false })); disp.position.set(da, db, 0.0006); panel.add(disp)
  const [ka, kb] = P(540, 510), knob = new THREE.Group(); knob.position.set(ka, kb, 0); panel.add(knob)
  alongZ(add(cyl(0.028, 0.002, 40), M.chrome, 0, 0, 0.001, knob)); alongZ(add(cyl(0.021, 0.018, 36), M.black, 0, 0, 0.01, knob))
  add(box(0.0026, 0.016, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.012, 0.0195, knob)
  alongZ(hitBox(cyl(0.034, 0.05, 12), 0, 0, 0.014, 'range', knob))
  ;[[180, 'ZERO', 'zero'], [270, 'HOLD', 'hold'], [360, 'RECALL', 'recall']].forEach(([x, t, d]) => {
    const [a, b] = P(x, 597), w = 0.047, h = 0.0235
    add(box(w, h, 0.005), M.key, a, b, 0.0025, panel)
    plain(add(new THREE.PlaneGeometry(w, h), sign(t, w, h, 42, '#FFFFFF'), a, b, 0.0054, panel))
    hitBox(box(w * 1.1, h * 1.3, 0.02), a, b, 0.008, d, panel)
  })
  const [ra, rb] = P(605, 597)
  add(box(0.04, 0.026, 0.003), M.black, ra, rb, 0.0015, panel)
  const rocker = add(box(0.018, 0.021, 0.006), new THREE.MeshStandardMaterial({ color: 0xd92b20, roughness: 0.35 }), ra - 0.009, rb, 0.004, panel)
  hitBox(box(0.055, 0.04, 0.03), ra, rb, 0.01, 'pwr', panel)
  scene.updateMatrixWorld(true)
  const sockets = [[470, 0xd92b20], [530, 0x15161a]].map(([x, c]) => {
    const [a, b] = P(x, 596)
    alongZ(add(cyl(0.0125, 0.004, 22), M.chrome, a, b, 0.002, panel)); alongZ(add(cyl(0.0085, 0.006, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), a, b, 0.004, panel))
    hitBox(new THREE.SphereGeometry(0.02, 10, 8), a, b, 0.012, 'leads', panel)
    return panel.localToWorld(V(a, b, 0.008))
  })

  /* concentric-cylinder cell */
  add(cyl(0.088, 0.03, 56), M.black, CELL_X, 0.015, CELL_Z)
  const signCell = plain(add(new THREE.PlaneGeometry(0.15, 0.016), sign('CONCENTRIC CYLINDER CELL', 0.15, 0.016, 34, '#D5D9DF'), CELL_X, 0.014, CELL_Z + 0.0885)); void signCell
  const tube = plain(add(new THREE.CylinderGeometry(0.066, 0.066, 0.27, 56, 1, true), M.glass, CELL_X, 0.165, CELL_Z)); tube.renderOrder = 3
  add(cyl(0.016, 0.255, 32), M.brass, CELL_X, 0.165, CELL_Z)
  const liquid = plain(add(cyl(0.0635, 1, 56), M.liquid, CELL_X, ZERO_Y, CELL_Z)); liquid.renderOrder = 2
  add(cyl(0.074, 0.016, 56), M.black, CELL_X, 0.306, CELL_Z)
  add(cyl(0.0052, 0.024, 14), M.brass, CELL_X - 0.02, 0.326, CELL_Z); add(new THREE.SphereGeometry(0.0105, 18, 14), new THREE.MeshStandardMaterial({ color: 0xd63a34, roughness: 0.35 }), CELL_X - 0.02, 0.344, CELL_Z)
  add(cyl(0.0052, 0.024, 14), M.chrome, CELL_X + 0.03, 0.326, CELL_Z); add(new THREE.SphereGeometry(0.0095, 18, 14), M.black, CELL_X + 0.03, 0.342, CELL_Z)
  const grad = face(320, 1040, drawGrad); grad.set(1)
  const gr = plain(add(new THREE.PlaneGeometry(0.0677, 0.22), new THREE.MeshBasicMaterial({ map: grad.tex, transparent: true, depthWrite: false }), CELL_X + 0.03, ZERO_Y + 0.11, CELL_Z + 0.0668)); gr.renderOrder = 4
  hitBox(cyl(0.07, 0.27, 14), CELL_X, 0.165, CELL_Z, 'level')

  /* parallel plates */
  add(box(0.36, 0.03, 0.22), M.black, PL_X, 0.015, PL_Z)
  plain(add(new THREE.PlaneGeometry(0.18, 0.016), sign('PARALLEL PLATE ARRANGEMENT', 0.18, 0.016, 34, '#D5D9DF'), PL_X, 0.015, PL_Z + 0.1105))
  ;[-0.13, 0.13].forEach((dx) => add(cyl(0.011, 0.3, 24), M.chrome, PL_X + dx, 0.18, PL_Z))
  add(box(0.32, 0.034, 0.09), M.black, PL_X, 0.325, PL_Z)
  add(cyl(0.018, 0.058, 28), M.chrome, PL_X, 0.058, PL_Z)
  add(cyl(0.068, 0.014, 48), M.black, PL_X, 0.092, PL_Z); add(cyl(0.064, 0.005, 48), M.brass, PL_X, 0.1015, PL_Z)
  const upper = new THREE.Group(); upper.position.set(PL_X, PL_Y, PL_Z); scene.add(upper)
  add(cyl(0.064, 0.005, 48), M.brass, 0, 0.0025, 0, upper); add(cyl(0.068, 0.014, 48), M.black, 0, 0.012, 0, upper); add(cyl(0.006, 0.2, 18), M.chrome, 0, 0.115, 0, upper)
  const sample = add(cyl(0.056, 0.016, 48), new THREE.MeshStandardMaterial({ color: 0xbfe0ee, roughness: 0.3 }), PL_X, PL_Y + 0.008, PL_Z)
  add(cyl(0.012, 0.06, 24), M.chrome, PL_X, 0.372, PL_Z)
  const thimble = new THREE.Group(); thimble.position.set(PL_X, 0.424, PL_Z); scene.add(thimble)
  add(cyl(0.024, 0.05, 32), M.chrome, 0, 0, 0, thimble); add(cyl(0.018, 0.03, 28), M.black, 0, 0.038, 0, thimble)
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; add(box(0.0014, 0.046, 0.0014), M.black, Math.cos(a) * 0.0243, 0, Math.sin(a) * 0.0243, thimble) }
  hitBox(cyl(0.034, 0.1, 12), 0, 0.012, 0, 'gap', thimble)
  const [plR, plB] = [V(PL_X - 0.165, 0.2, PL_Z + 0.02), V(PL_X - 0.165, 0.098, PL_Z + 0.02)]
  ;[[plR, 0xd92b20], [plB, 0x15161a]].forEach(([p, c]) => { alongZ(add(cyl(0.0115, 0.006, 20), M.chrome, p.x, p.y, p.z)); alongZ(add(cyl(0.0078, 0.008, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), p.x, p.y, p.z)) })
  const redWire = add(cyl(0.0016, 1, 8), new THREE.MeshStandardMaterial({ color: 0xc42a26 }), 0, 0, 0)
  alongX(add(cyl(0.0016, 0.1, 8), M.black, PL_X - 0.115, 0.098, PL_Z + 0.02))

  /* liquid bottle and solid samples */
  const bottle = new THREE.Group(); bottle.position.set(-0.22, 0, 0.36); scene.add(bottle)
  add(new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.04, 0.09], [0.03, 0.115], [0.0145, 0.125], [0.0145, 0.15], [0, 0.15]].map(([a, b]) => new THREE.Vector2(a, b)), 40), M.bottle, 0, 0, 0, bottle)
  add(cyl(0.018, 0.028, 24), M.black, 0, 0.162, 0, bottle)
  const labelF = face(320, 180, drawLabel)
  plain(add(new THREE.PlaneGeometry(0.064, 0.038), new THREE.MeshBasicMaterial({ map: labelF.tex }), 0, 0.052, 0.0404, bottle))
  hitBox(cyl(0.05, 0.19, 12), 0, 0.09, 0, 'bottle', bottle)
  const discs = SOLIDS.map(([k, n, c, x]) => {
    const m = add(cyl(0.05, 0.016, 40), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }), x, 0.008, 0.36)
    plain(add(new THREE.PlaneGeometry(0.1, 0.022), sign(n, 0.1, 0.022, 42, '#E9EBEF'), x, 0.0005, 0.44)).rotation.x = -Math.PI / 2
    hitBox(cyl(0.056, 0.05, 12), x, 0.02, 0.36, `s:${k}`)
    return { k, c, m }
  })

  /* leads, plugged or dropped */
  const tgt = kind === 'liquid' ? [V(CELL_X - 0.02, 0.352, CELL_Z), V(CELL_X + 0.03, 0.35, CELL_Z)] : [plR.clone().add(V(0, 0, 0.004)), plB.clone().add(V(0, 0, 0.004))]
  const leads = sockets.map((s, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: i ? 0x101114 : 0xc42a26, roughness: 0.55 }), t = tgt[i]
    const make = (pts) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.0032, 8), mat, 0, 0, 0)
    const a = V(s.x + 0.05, s.y - 0.05, s.z + 0.1)
    const on = make([s, a, V((s.x + t.x) / 2 - i * 0.03, Math.max(t.y, 0.25) + 0.13 - i * 0.03, (s.z + t.z) / 2 + 0.08), V(t.x - 0.04, t.y + 0.05, t.z + 0.02), t])
    const off = make([s, a, V(s.x + 0.1 + i * 0.05, 0.02, s.z + 0.18), V(s.x + 0.2 + i * 0.05, 0.006, s.z + 0.2)])
    return { on, off }
  })

  function draw() { renderer.render(scene, camera) }
  const applyView = (n) => { const w = VIEWS[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.2; orbit.maxDistance = 3; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.2; orbit.maxAzimuthAngle = 1.2
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3(), el = renderer.domElement
  const facing = new THREE.Plane(new THREE.Vector3(0, 0, 1), -CELL_Z)
  const pick = (e) => {
    const r = el.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d)
  }
  const Q = { v: null, o: null, drag: null, mem: null, zeroTill: 0, t: 0 }
  const c = (k) => ctl.find((q) => q.k === k)
  const usable = (d) => {
    if (d === 'level' || d === 'bottle') return kind === 'liquid'
    if (d === 'gap' || d.startsWith('s:')) return kind === 'solid'
    return true
  }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d || !usable(d)) return
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    const v = Q.v
    Q.drag = { none: true }
    if (d === 'level') { Q.drag = { level: true }; return }
    if (d === 'gap') { Q.drag = { gap: true, y: e.clientY, x: e.clientX, val: v.d }; return }
    if (d.startsWith('s:')) { api.set('s', d.slice(2)); return }
    if (d === 'bottle') { const k = Object.keys(LIQUIDS); api.set('l', k[(k.indexOf(v.l) + 1) % k.length]); return }
    if (d === 'range') { api.set('range', v.range ? 0 : 1); return }
    if (d === 'zero') { Q.zeroTill = Q.t + 0.8; return }
    if (d === 'hold') { if (!v.hold) Q.mem = Q.o.meter; api.set('hold', !v.hold); return }
    if (d === 'recall') { api.set('recall', !v.recall); return }
    api.set(d, !v[d])
  }
  const onMove = (e) => {
    const s = Q.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d || !usable(d) ? 'move' : d === 'level' ? 'ns-resize' : d === 'gap' ? 'grab' : 'pointer'; return }
    if (s.level) { pick(e); const p = ray.ray.intersectPlane(facing, hitP); if (p) api.set('h', quant(c('h'), (p.y - ZERO_Y) / MM)) }
    if (s.gap) { const q = c('d'); api.set('d', quant(q, s.val + (((e.clientX - s.x) - (e.clientY - s.y)) / 320) * (q.max - q.min))) }
  }
  const onUp = () => { Q.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const fmt = (x, r) => (x > RANGES[r] ? '1' : r ? x.toFixed(0) : x.toFixed(1))
  function update(v, o, t) {
    Q.v = v; Q.o = o; Q.t = t
    const h = kind === 'liquid' ? v.h * MM : 0
    liquid.visible = h > 0.0005
    liquid.scale.y = Math.max(h, 0.001); liquid.position.y = ZERO_Y + h / 2
    labelF.set(v.l, LIQUIDS[v.l] || 'METHANOL')
    const d = kind === 'solid' ? v.d : 3.5
    upper.position.y = PL_Y + d * GAP
    thimble.rotation.y = d * 3
    const a = V(plR.x + 0.006, plR.y, plR.z), b = V(PL_X - 0.068, upper.position.y + 0.012, PL_Z + 0.02)
    redWire.position.copy(a).add(b).multiplyScalar(0.5); redWire.scale.y = a.distanceTo(b); redWire.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize())
    sample.visible = kind === 'solid'
    if (kind === 'solid') {
      discs.forEach((q) => { q.m.visible = q.k !== v.s; if (q.k === v.s) sample.material.color.set(q.c) })
    }
    let txt = null, tag = ''
    if (v.pwr) {
      if (t < Q.zeroTill) txt = v.range ? '0' : '0.0'
      else if (v.recall) { txt = Q.mem === null ? '0' : fmt(Q.mem, v.range); tag = 'MEM' }
      else if (v.hold) { txt = fmt(Q.mem ?? 0, v.range); tag = 'HOLD' }
      else txt = fmt(o.meter, v.range)
    }
    dispF.set(`${txt}${tag}`, txt, tag)
    knob.rotation.z = v.range ? rad(-45) : rad(45)
    rocker.position.x = ra + (v.pwr ? -0.009 : 0.009)
    leads.forEach((l) => { l.on.visible = v.leads; l.off.visible = !v.leads })
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

const LABELS = { liquid: [['whole', 'Whole kit'], ['meter', 'Meter'], ['cell', 'Liquid cell']], solid: [['whole', 'Whole kit'], ['meter', 'Meter'], ['plates', 'Parallel plates'], ['samples', 'Samples']] }
const HINTS = {
  liquid: 'Drag up or down on the glass cell to set the liquid level. Click the bottle to change the liquid. Turn RANGE, press HOLD and RECALL, and click a Cx socket to unplug the leads. Drag the background to look around.',
  solid: 'Drag the micrometer on top to change the plate gap. Click a sample on the bench to load it. Turn RANGE, press HOLD and RECALL, and click a Cx socket to unplug the leads. Drag the background to look around.',
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
          <div className="view-btns">{LABELS[kind].map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
        </div>
        <p className="stage3d-hint">{HINTS[kind]}</p>
      </div>
    )
  }
}

export const dielectric3D = dielectric.map((e) => {
  const kind = e.id === 'polar-liquid' ? 'liquid' : 'solid'
  const controls = e.controls.map((c) => (c.k === 'h' ? { ...c, max: 100 } : c))
  const live = { ...e, controls }
  return {
    ...e,
    wide: true,
    controls,
    state: () => ({ pwr: true, leads: true, range: kind === 'liquid' ? 1 : 0, hold: false, recall: false, ...(kind === 'liquid' ? { l: 'met' } : {}) }),
    out: (v, t) => { const o = e.out(v, t); return { ...o, meter: v.pwr && v.leads ? o.C : 0 } },
    read: (v, o) => {
      const r = [['Capacitance', o.meter ? o.meter.toFixed(1) : '–', 'pF']]
      if (kind === 'solid') r.push(['1/C', o.meter ? (1 / o.meter).toFixed(5) : '–', '1/pF'])
      return r
    },
    sample: (v, o) => {
      if (!v.pwr) return { error: 'The meter is off. Press the MAINS switch.' }
      if (!v.leads) return { error: 'The leads are unplugged. Click a Cx INPUT socket.' }
      if (v.hold || v.recall) return { error: 'The display is showing a stored value. Release HOLD or RECALL.' }
      if (o.C > RANGES[v.range]) return { error: 'The meter is over range. Turn RANGE to 1000 pF.' }
      return e.sample(v, o)
    },
    ...(kind === 'liquid' ? { sweep: { k: 'h', n: 10, from: 10, to: 100 } } : {}),
    Stage: make(live, kind),
  }
})
