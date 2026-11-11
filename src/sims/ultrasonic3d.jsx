import { ultrasonic } from './modern'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, glowDot } from './kit3d'

/* The ultrasonic kit: 2 MHz interferometer with its liquid cell, and the 40 kHz distance unit
   with its transducer pair and target. Metres. */

const VIEWS = {
  whole: { p: [0.04, 0.66, 2.2], t: [0.04, 0.2, 0.08] },
  cell: { p: [0.04, 0.48, 0.74], t: [0.04, 0.27, -0.12] },
  inter: { p: [-0.62, 0.34, 0.92], t: [-0.62, 0.17, -0.18] },
  dist: { p: [0.66, 0.36, 0.96], t: [0.66, 0.15, -0.18] },
  track: { p: [0.55, 0.42, 1.08], t: [0.55, 0.06, 0.42] },
}
const CX = 0.04, CZ = -0.12, S0 = 0.2, SCALE = 0.6
const LIQ = { water: [1482, 0x8fc6e6], benz: [1322, 0xe6dd9a], cc: [938, 0xc9c0e0] }

const artBlue = (g, W, H) => {
  const k = W / 504, X = (x) => (x - 98) * k, Y = (y) => (y - 408) * k, t = (s, x, y, z = 13, c = '#17202B', al = 'center') => { g.fillStyle = c; g.font = `bold ${z * k}px Arial`; g.textAlign = al; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, W, H); t('ULTRASONIC INTERFEROMETER', 350, 440, 19, '#1D3F66'); t('HIGH-FREQUENCY GENERATOR', 350, 460, 12.5, '#3F4B5C')
  g.fillStyle = '#17181C'; g.fillRect(X(125), Y(470), 230 * k, 150 * k); g.fillStyle = '#F2EEDF'; g.fillRect(X(135), Y(480), 210 * k, 130 * k)
  g.strokeStyle = '#26282D'; g.fillStyle = '#26282D'; g.textBaseline = 'middle'
  for (let i = 0; i <= 50; i++) { const a = rad(90 + 55 - (i / 50) * 110), big = i % 10 === 0, r1 = 92 * k, r2 = (big ? 80 : 86) * k; g.lineWidth = (big ? 2.4 : 1.1) * k; g.beginPath(); g.moveTo(X(240) + r1 * Math.cos(a), Y(600) - r1 * Math.sin(a)); g.lineTo(X(240) + r2 * Math.cos(a), Y(600) - r2 * Math.sin(a)); g.stroke(); if (big) { g.font = `bold ${13 * k}px Arial`; g.textAlign = 'center'; g.fillText(String(i * 2), X(240) + 70 * k * Math.cos(a), Y(600) - 70 * k * Math.sin(a)) } }
  g.textBaseline = 'alphabetic'; t('µA', 240, 590, 14); t('FREQ ADJ', 430, 562, 13); t('GAIN', 530, 562, 13); t('TO CELL (coaxial)', 200, 675, 12.5, '#17202B', 'left')
}
const artGreen = (g, W, H) => {
  const k = W / 504, X = (x) => (x - 1158) * k, Y = (y) => (y - 408) * k, t = (s, x, y, z = 12, c = '#17202B') => { g.fillStyle = c; g.font = `bold ${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, W, H); t('ULTRASONIC DISTANCE MEASUREMENT UNIT', 1410, 438, 16, '#1F4D3A'); g.fillStyle = '#17181C'; g.fillRect(X(1180), Y(456), 300 * k, 80 * k)
  t('THRESHOLD', 1540, 535, 11); t('40 kHz CLOCK', 1220, 650); t('BUZZER', 1310, 650); t('BUZZER', 1390, 650); t('TX', 1460, 650); t('RX', 1520, 650); t('FUSE 500 mA', 1613, 650, 11)
}
function drawLcd(g, w, h, a, b) { g.fillStyle = '#A8D44B'; g.fillRect(0, 0, w, h); g.fillStyle = '#1B2A0D'; g.font = `bold ${h * 0.34}px "Courier New", monospace`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(a, 16, h * 0.3); g.fillText(b, 16, h * 0.74) }
function drawRuler(g, w, h) { g.fillStyle = '#EDE4CF'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2A2E35'; g.fillStyle = '#2A2E35'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; for (let i = 0; i <= 80; i++) { const x = (i / 80) * w, big = i % 10 === 0; g.lineWidth = big ? 3 : 1.4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, big ? 38 : 20); g.stroke(); if (big) g.fillText(`${(20 + i).toFixed(0)}`, clamp(x, 26, w - 26), 74) } }

function build(host, api, exp, kind) {
  const K = kitScene(host, { background: 0xdfe3e7, floor: { base: '#A9794F', wall: 0xdfe3e7 }, views: VIEWS })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, tube, M, stdM, label, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  const air = kind === 'air'
  /* interferometer */
  const B = K.unit({ x: -0.62, z: -0.18, w: 0.55, h: 0.33, d: 0.26, body: 0x264e7a, lid: 0x4f7fae, art: artBlue, x0: 98, y0: 408, W: 504, H: 304, pw: 0.5 })
  const [na, nb] = B.P(240, 600), needle = new THREE.Group(); needle.position.set(na, nb, 0.001); B.panel.add(needle)
  add(box(0.0016, 0.08, 0.0008), stdM(0xc62828, 0.4), 0, 0.04, 0, needle); add(cyl(0.005, 0.002, 14), M.black, 0, 0, 0, needle).rotation.x = Math.PI / 2
  const freqK = B.knob(430, 520, 'ft'), gainK = B.knob(530, 520, 'gain'), toCell = B.sock(170, 670, 0x15161a, 'cC'), rockB = B.rocker(545, 670, 'pwrB')
  const keys = [[1, 420], [2, 480], [3, 540]].map(([f, x]) => ({ f, k: B.key(x, 610, 52, 30, `${f} MHz`, 0xd7dbe0, `f:${f}`, '#17202B') }))
  /* liquid cell */
  add(cyl(0.11, 0.016, 48), M.steel, CX, 0.008, CZ); add(cyl(0.085, 0.02, 48), M.dark, CX, 0.026, CZ)
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.27, 48, 1, true, 0.55, TAU - 1.1), new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.85, roughness: 0.34, side: THREE.DoubleSide })); jacket.position.set(CX, 0.17, CZ); jacket.castShadow = true; scene.add(jacket)
  plain(add(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 40, 1, true), M.glass, CX, 0.17, CZ))
  const liquid = plain(add(cyl(0.048, 0.2, 40), new THREE.MeshPhysicalMaterial({ color: 0x8fc6e6, transparent: true, opacity: 0.55, roughness: 0.05 }), CX, 0.14, CZ))
  add(cyl(0.03, 0.005, 32), stdM(0xe0b12f, 0.35, 0.3), CX, 0.046, CZ)
  add(cyl(0.1, 0.012, 48), M.chrome, CX, 0.31, CZ)
  ;[[0.075, 0.08, 'in'], [-0.075, 0.26, 'out']].forEach(([s, y, n]) => { alongX(add(cyl(0.0065, 0.04, 14), M.chrome, CX + s + (s > 0 ? 0.018 : -0.018), y, CZ)); label(0.05, 0.018, `water ${n}`, 42, '#3F4B5C', CX + s + (s > 0 ? 0.075 : -0.075), y + 0.02, CZ) })
  label(0.15, 0.022, 'LIQUID CELL · 12 cm³', 42, '#1B2330', CX, 0.016, CZ + 0.1106)
  hit(cyl(0.085, 0.27, 12), CX, 0.17, CZ, 'liq')
  const carriage = new THREE.Group(); scene.add(carriage)
  add(cyl(0.04, 0.006, 40), M.steel, CX, 0, CZ, carriage); add(cyl(0.0055, 0.25, 14), M.chrome, CX, 0.126, CZ, carriage)
  const barrel = add(cyl(0.021, 0.12, 30), M.chrome, CX, 0.372, CZ)
  void barrel
  const thimble = new THREE.Group(); thimble.position.set(CX, 0, CZ); scene.add(thimble)
  add(cyl(0.024, 0.07, 30), M.black, 0, 0, 0, thimble)
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; add(box(0.0014, 0.064, 0.0014), new THREE.MeshBasicMaterial({ color: i % 4 ? 0x868b93 : 0xffffff }), Math.cos(a) * 0.0243, 0, Math.sin(a) * 0.0243, thimble) }
  hit(cyl(0.034, 0.09, 12), 0, 0, 0, 'd', thimble)
  label(0.09, 0.022, 'LC 0.01 mm', 42, '#3F4B5C', CX + 0.09, 0.38, CZ)
  const waves = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.046, 32), new THREE.MeshBasicMaterial({ color: 0x4dc3ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = Math.PI / 2; m.visible = false; scene.add(m); return m })
  tube([toCell, toCell.clone().add(V(0, -0.05, 0.08)), V(-0.3, 0.02, 0.18), V(CX - 0.2, 0.012, 0.02), V(CX - 0.11, 0.012, CZ + 0.04), V(CX - 0.085, 0.026, CZ + 0.02)], 0x101114)
  /* distance unit */
  const Gn = K.unit({ x: 0.66, z: -0.18, w: 0.55, h: 0.31, d: 0.26, body: 0x235a42, lid: 0x5e9a7c, art: artGreen, x0: 1158, y0: 408, W: 504, H: 284, pw: 0.5 })
  const lcd = Gn.disp(1186, 462, 288, 68, drawLcd, 720)
  const thr = Gn.knob(1540, 495, 'th'), clk = Gn.knob(1220, 615, 'clk'), buz = Gn.knob(1310, 615, 'buz'), rockG = Gn.rocker(1613, 612, 'pwrG'), ledB = Gn.led(1390, 612, 0.011)
  const tx = Gn.sock(1460, 612, 0x15161a, 'cT'), rx = Gn.sock(1520, 612, 0x15161a, 'cT')
  /* transducers and target */
  const TX = 0.18, TZ = 0.42
  add(box(0.1, 0.012, 0.1), M.dark, TX, 0.006, TZ); add(cyl(0.008, 0.1), M.steel, TX, 0.06, TZ)
  add(box(0.02, 0.06, 0.13), stdM(0x1565c0, 0.45), TX, 0.12, TZ)
  const canM = stdM(0x8d939c, 0.35, 0.6)
  ;[-0.032, 0.032].forEach((dz) => { alongX(add(cyl(0.022, 0.024, 26), canM, TX + 0.022, 0.12, TZ + dz)); alongX(add(cyl(0.016, 0.002, 22), M.black, TX + 0.035, 0.12, TZ + dz)) })
  const ruler = face(2400, 110, drawRuler); ruler.set(1); const rl = plain(add(new THREE.PlaneGeometry(0.48, 0.035), new THREE.MeshStandardMaterial({ map: ruler.tex, roughness: 0.6 }), S0 + 0.28 * SCALE + 0.24, 0.0014, TZ + 0.11)); rl.rotation.x = -Math.PI / 2
  label(0.34, 0.03, 'Distance (cm), 0.28–1.0 m', 48, '#3F2E1A', S0 + 0.28 * SCALE + 0.24, 0.0016, TZ + 0.14, scene, true)
  const target = new THREE.Group(); scene.add(target)
  add(box(0.07, 0.012, 0.09), M.dark, 0, 0.006, TZ, target); add(box(0.018, 0.2, 0.09), stdM(0x8b6e63, 0.5), 0, 0.11, TZ, target); hit(box(0.09, 0.24, 0.12), 0, 0.11, TZ, 'r', target)
  const trackPlane = new THREE.Plane(V(0, 1, 0), 0)
  ;[[tx, -0.032], [rx, 0.032]].forEach(([s, dz]) => {
    const end = V(TX, 0.15, TZ + dz)
    const on = tube([s, s.clone().add(V(0, -0.05, 0.1)), V(s.x - 0.08, 0.05, TZ - 0.15), V(TX - 0.06, 0.2, TZ + dz), end], 0x101114)
    const off = tube([s, s.clone().add(V(0, -0.05, 0.1)), V(s.x, 0.012, s.z + 0.2), V(s.x + 0.04, 0.006, s.z + 0.24)], 0x101114)
    s.u = { on, off }
  })
  const arcM = () => new THREE.MeshBasicMaterial({ color: 0x4ba5ff, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  const arcs = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.038, 0.041, 40, 1, -1, 2), arcM()); m.rotation.y = Math.PI / 2; m.position.set(0, 0.12, TZ); scene.add(m); return m })

  const Q = { v: null, ft: 0, gain: 1, clk: 0.5, buz: 0.5 }
  const toggle = { pwrB: 'pwrB', pwrG: 'pwrG', cC: 'cC', cT: 'cT' }
  K.listen({
    grab: (d, e) => {
      const v = Q.v
      if (d === 'ft') return { d, val: v.ft }
      if (d === 'gain') return { d, val: Q.gain }
      if (d === 'clk' || d === 'buz') return { d, val: Q[d] }
      if (toggle[d]) { api.set(d, !v[d]); return }
      if (d.startsWith('f:')) { if (ctl('f')) api.set('f', +d.slice(2)); return }
      if (d === 'liq') { if (!ctl('l')) return; const op = ctl('l').options, i = op.findIndex((q) => q[0] === v.l); api.set('l', op[(i + 1) % op.length][0]); return }
      if (d === 'd') return ctl('d') ? { d, val: v.d } : undefined
      if (d === 'th') return ctl('th') ? { d, val: v.th } : undefined
      if (d === 'r') return ctl('r') ? { d, val: v.r } : undefined
    },
    drag: (s, e, mv) => {
      if (s.d === 'ft') api.set('ft', +clamp(s.val + mv / 200, -1, 1).toFixed(2))
      if (s.d === 'gain') { Q.gain = clamp(s.val + mv / 200, 0.3, 1.6); update.redo() }
      if (s.d === 'clk' || s.d === 'buz') { Q[s.d] = clamp(s.val + mv / 240, 0, 1); update.redo() }
      if (s.d === 'd') { const q = ctl('d'); api.set('d', quant(q, s.val + (mv / 700) * (q.max - q.min))) }
      if (s.d === 'th') { const q = ctl('th'); api.set('th', quant(q, s.val + (mv / 240) * (q.max - q.min))) }
      if (s.d === 'r') { const p = K.castTo(e, trackPlane); if (p) { const q = ctl('r'); api.set('r', quant(q, (p.x - S0) / SCALE)) } }
    },
    cursor: (d) => (['ft', 'gain', 'clk', 'buz', 'd', 'th', 'r'].includes(d) ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t) => {
    Q.v = v
    /* interferometer */
    const lamM = v.l ? (LIQ[v.l][0] / (v.f * 1e6)) * 1000 : 0, d = v.d ?? 0
    const gap = d * 0.018 + 0.01, on = v.pwrB, y0 = 0.05
    const I = on && !air ? (v.cC ? o.I : 0) * (1 / (1 + (v.ft * 3) ** 2)) : 0
    needle.rotation.z = rad(55 - clamp((I * Q.gain) / 110, 0, 1.05) * 110)
    freqK.rotation.z = rad(135 - ((v.ft + 1) / 2) * 270); gainK.rotation.z = rad(135 - ((Q.gain - 0.3) / 1.3) * 270); rockB(on); rockG(v.pwrG)
    keys.forEach((q) => q.k.mat.color.set(v.f === q.f && !air ? 0x1565c0 : 0xd7dbe0))
    liquid.material.color.set(v.l ? LIQ[v.l][1] : 0x8fc6e6)
    carriage.position.y = y0 + gap
    thimble.position.y = 0.41 + gap * 0.9; thimble.rotation.y = -d * TAU * 2
    waves.forEach((m, i) => {
      const half = (lamM / 2) * 0.018 * 1.0, yy = y0 + 0.002 + i * half, vis = !air && on && v.cC && half > 0 && i * half < gap - 0.004
      m.visible = vis; if (vis) { m.position.set(CX, yy, CZ); m.material.opacity = 0.14 + clamp(I / 110, 0, 1) * 0.42 * (0.7 + 0.3 * Math.sin(t * 7 + i)) }
    })
    /* distance unit */
    const r = v.r ?? 0.5, tx2 = S0 + r * SCALE
    target.position.x = tx2
    thr.rotation.z = rad(135 - ((v.th ?? 4.5) / 9) * 270); clk.rotation.z = rad(135 - Q.clk * 270); buz.rotation.z = rad(135 - Q.buz * 270)
    tx.u.on.visible = rx.u.on.visible = v.cT; tx.u.off.visible = rx.u.off.visible = !v.cT
    const live = air && v.pwrG && v.cT
    const lineA = !v.pwrG ? '' : !air ? 'STANDBY' : !v.cT ? 'NO TRANSDUCER' : `DIST : ${r.toFixed(2)} m`
    const lineB = !live ? '' : o.det !== undefined ? (o.det ? 'OBJECT DETECTED' : 'NO OBJECT') : o.tof !== undefined ? `ECHO ${(o.tof * 1000).toFixed(3)} ms` : `SIGNAL ${o.a.toFixed(3)} V`
    lcd.set(lineA + lineB, lineA, lineB)
    ledB.material.color.set(live && o.det ? 0xff3b30 : 0x333333)
    arcs.forEach((m, i) => {
      m.visible = live; if (!live) return
      const u = (t * 0.45 + i / 8) % 1, out = u < 0.5, p = out ? u * 2 : 2 - u * 2, x = TX + 0.04 + p * (tx2 - TX - 0.05)
      m.position.x = x; const sc = 0.6 + p * 2.2; m.scale.set(sc, sc, sc); m.rotation.y = out ? Math.PI / 2 : -Math.PI / 2; m.material.opacity = (out ? 0.7 : 0.4) * (1 - p * 0.7)
    })
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['cell', 'Liquid cell'], ['inter', 'Interferometer'], ['dist', 'Distance unit'], ['track', 'Transducers']]
const HINTS = {
  air: 'Drag the target along the ruler to change the distance. The THRESHOLD knob sets detection where the experiment uses it. Click TX or RX to unplug the transducers and the FUSE switch to power off. Drag the background to look around.',
  liq: 'Drag the black micrometer thimble and watch the meter peak at each half-wavelength, holding Shift for fine steps. Click the cell to change the liquid and the MHz keys for the crystal. FREQ ADJ must sit at the centre to record.',
}
export const ultrasonic3D = ultrasonic.map((e) => {
  const kind = e.id === 'velocity-liquid' || e.id === 'compressibility' ? 'liq' : 'air'
  return {
    ...e,
    wide: true,
    state: () => ({ pwrB: true, pwrG: true, cC: true, cT: true, ft: 0 }),
    read: (v, o) => (kind === 'liq' ? (v.pwrB && v.cC ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])) : v.pwrG && v.cT ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: (v, o) => {
      if (kind === 'liq') {
        if (!v.pwrB) return { error: 'The interferometer is off. Press its switch.' }
        if (!v.cC) return { error: 'The coaxial cable is unplugged. Click TO CELL.' }
        if (Math.abs(v.ft) > 0.1) return { error: 'Tune FREQ ADJ back to the centre for the strongest signal.' }
      } else {
        if (!v.pwrG) return { error: 'The distance unit is off. Press its FUSE switch.' }
        if (!v.cT) return { error: 'The transducers are unplugged. Click TX or RX.' }
      }
      return e.sample(v, o)
    },
    Stage: stage3D(e, (host, api) => build(host, api, e, kind), { labels: LABELS, hint: HINTS[kind] }),
  }
})
