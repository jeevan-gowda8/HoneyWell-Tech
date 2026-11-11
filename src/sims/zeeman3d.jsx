import { zeeman } from './magnetism'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, drawSeg, glowDot, silk } from './kit3d'

/* Zeeman effect kit: electromagnet with Hg lamp, optical bench, power supply and Gauss meter. */

const HB = 0.27, RAIL_Y = 0.04, Z0 = -0.14
const VIEWS = {
  whole: { p: [0, 0.72, 2.1], t: [0, 0.18, 0.02] },
  magnet: { p: [-0.62, 0.42, 0.72], t: [-0.66, 0.26, Z0] },
  optics: { p: [0.12, 0.42, 0.86], t: [0.12, 0.25, Z0] },
  meters: { p: [-0.42, 0.36, 1.08], t: [-0.42, 0.1, 0.44] },
}
const R_COIL = 5
const artPsu = (g, W, H) => { const k = W / 380, X = (x) => (x - 120) * k, Y = (y) => (y - 890) * k, t = (s, x, y, z = 13) => { g.fillStyle = '#17202B'; g.font = `bold ${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }; g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, W, H); t('DC POWER SUPPLY 0–40 V / 0–10 A', 310, 920, 15); g.fillStyle = '#0C0D10'; g.fillRect(X(144), Y(932), 160 * k, 58 * k); g.fillRect(X(314), Y(932), 160 * k, 58 * k); t('V', 214, 1026, 14); t('I', 304, 1026, 14) }
const artGm = (g, W, H) => { const k = W / 340, X = (x) => (x - 560) * k, Y = (y) => (y - 890) * k, t = (s, x, y, z = 13) => { g.fillStyle = '#17202B'; g.font = `bold ${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }; g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, W, H); t('DIGITAL GAUSS METER', 730, 920, 15); g.fillStyle = '#0C0D10'; g.fillRect(X(584), Y(932), 200 * k, 58 * k); t('ZERO', 660, 1026, 13); t('InAs PROBE', 820, 1026, 12) }

function paintRings(g, w, s) {
  const im = g.createImageData(w, w), F = 160 / (1 + (s.f / 0.018) ** 2), ord = s.ord
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w - 0.5, y = (j + 0.5) / w - 0.5, r2 = u * u + y * y, m = r2 * 18 + 0.15
    const air = (a) => 1 / (1 + F * Math.sin(Math.PI * (m + a)) ** 2)
    const I = !s.lit ? 0 : s.pol === 'pi' ? air(0) : s.pol === 'sigma' ? 0.5 * (air(ord) + air(-ord)) : air(0) * 0.5 + 0.25 * (air(ord) + air(-ord))
    const v = Math.min(1, I * 1.25) * (r2 < 0.24 ? 1 : 0.2), p = (j * w + i) * 4
    im.data[p] = 40 * v; im.data[p + 1] = 255 * v; im.data[p + 2] = 120 * v; im.data[p + 3] = 255
  }
  g.putImageData(im, 0, 0)
}

function build(host, api, exp) {
  const K = kitScene(host, { background: 0xeceef1, env: 0.65, floor: { flat: 0xc4c9d0, wall: 0xeceef1 }, views: VIEWS })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, tube, M, stdM, label, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  /* bench */
  add(box(1.48, 0.024, 0.07), M.steel, 0.02, RAIL_Y - 0.012, Z0)
  const benchF = face(2400, 60, (g, w, h) => { g.fillStyle = '#D5D9DE'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2A2E35'; for (let i = 0; i <= 150; i++) { const x = (i / 150) * w; g.lineWidth = i % 10 ? 1.2 : 2.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, i % 10 ? 18 : 36); g.stroke() } }); benchF.set(1)
  plain(add(new THREE.PlaneGeometry(1.46, 0.02), new THREE.MeshStandardMaterial({ map: benchF.tex, roughness: 0.5 }), 0.02, RAIL_Y + 0.0006, Z0 + 0.024)).rotation.x = -Math.PI / 2
  /* electromagnet */
  const MX = -0.66, copper = (() => { const f = face(256, 128, (g, w, h) => { g.fillStyle = '#B5553A'; g.fillRect(0, 0, w, h); g.fillStyle = '#7F2F1C'; for (let i = 0; i < h; i += 6) g.fillRect(0, i, w, 2) }); f.set(1); return new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.45, metalness: 0.45 }) })()
  add(box(0.36, 0.06, 0.15), M.steel, MX, 0.1, Z0); add(box(0.36, 0.06, 0.15), M.steel, MX, 0.44, Z0)
  ;[-0.14, 0.14].forEach((s) => { add(box(0.07, 0.3, 0.1), M.steel, MX + s, 0.27, Z0); alongX(add(cyl(0.068, 0.12, 36), copper, MX + s * 1.05, HB, Z0)) })
  ;[-1, 1].forEach((s) => { const c = alongX(add(new THREE.CylinderGeometry(0.03, 0.06, 0.08, 28), M.steel, MX + s * 0.06, HB, Z0)); c.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2 })
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xcfffe6, toneMapped: false })
  add(cyl(0.012, 0.13, 20), lampMat, MX, HB, Z0)
  const g1 = face(128, 128, glowDot); g1.set(1)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: g1.tex, color: 0x7dffb0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(0.24, 0.28, 1); halo.position.set(MX, HB, Z0); scene.add(halo)
  hit(cyl(0.03, 0.14, 12), MX, HB, Z0, 'lamp')
  const carrier = (x, parent = scene) => { add(box(0.06, 0.03, 0.06), M.black, x, RAIL_Y + 0.015, Z0, parent); add(cyl(0.0065, HB - RAIL_Y - 0.03), M.chrome, x, (HB + RAIL_Y + 0.03) / 2, Z0, parent) }
  const lens = (x, r, parent = scene) => { carrier(x, parent); alongX(add(new THREE.TorusGeometry(r, 0.005, 10, 40), M.black, x, HB, Z0, parent)).rotation.y = Math.PI / 2; alongX(add(new THREE.SphereGeometry(r * 0.96, 24, 12).scale(0.15, 1, 1), M.glass, x, HB, Z0, parent)).rotation.z = 0 }
  lens(-0.36, 0.034)
  label(0.09, 0.02, 'L1 · f 50 cm', 46, '#1B2330', -0.36, HB + 0.066, Z0)
  carrier(-0.2); alongX(add(cyl(0.04, 0.008, 40), M.black, -0.2, HB, Z0)); const filt = alongX(add(cyl(0.032, 0.0092, 40), new THREE.MeshBasicMaterial({ color: 0x31f56c, toneMapped: false }), -0.2, HB, Z0)); void filt; label(0.12, 0.022, 'FILTER 546.1 nm', 48, '#1B2330', -0.2, HB + 0.066, Z0)
  carrier(-0.04); add(box(0.08, 0.1, 0.09), M.black, -0.04, HB, Z0); ;[-0.012, 0.012].forEach((s) => plain(add(box(0.0035, 0.07, 0.075), M.glass, -0.04 + s, HB, Z0 + 0.011))); label(0.13, 0.022, 'FABRY–PEROT ETALON', 46, '#1B2330', -0.04, HB + 0.075, Z0)
  carrier(0.12); alongX(add(cyl(0.05, 0.01, 40), M.black, 0.12, HB, Z0)); const pw = alongX(add(cyl(0.034, 0.0104, 40), new THREE.MeshBasicMaterial({ color: 0xd8c8ff, transparent: true, opacity: 0.8 }), 0.12, HB, Z0)); void pw
  const polTag = face(460, 90, (g, w, h, s) => silk(s, 46, '#1B2330')(g, w, h)); plain(add(new THREE.PlaneGeometry(0.15, 0.03), new THREE.MeshBasicMaterial({ map: polTag.tex, transparent: true }), 0.12, HB + 0.078, Z0)); hit(cyl(0.056, 0.05, 16), 0.12, HB, Z0, 'pol')
  const L2 = new THREE.Group(); scene.add(L2); lens(0.3, 0.034, L2); label(0.09, 0.02, 'L2 · f 150 cm', 46, '#1B2330', 0.3, HB + 0.066, Z0, L2); hit(box(0.08, 0.3, 0.08), 0.3, HB - 0.08, Z0, 'focus', L2)
  lens(0.45, 0.03); label(0.09, 0.02, 'L3 · f 100 cm', 46, '#1B2330', 0.45, HB + 0.06, Z0)
  carrier(0.62); add(box(0.1, 0.09, 0.09), stdM(0x263039, 0.45), 0.62, HB, Z0); alongX(add(cyl(0.022, 0.05), M.black, 0.55, HB, Z0)); label(0.08, 0.022, 'CMOS', 60, '#FFF', 0.62, HB, Z0 + 0.0456)
  /* beam */
  const bMat = new THREE.MeshBasicMaterial({ color: 0x1fd16a, transparent: true, opacity: 0.7, depthWrite: false })
  const beam = alongX(add(cyl(0.0022, 1.16, 8), bMat, -0.05, HB, Z0)); beam.castShadow = false
  const dMat = new THREE.MeshBasicMaterial({ color: 0xc9ffe0, toneMapped: false })
  const beads = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), dMat); scene.add(m); return m })
  /* supply and meter */
  const S = K.unit({ x: -0.42, z: 0.44, w: 0.46, h: 0.2, d: 0.24, body: 0x264e7a, art: artPsu, x0: 120, y0: 890, W: 380, H: 170, pw: 0.44 })
  const dV = S.disp(144, 932, 160, 58, drawSeg), dA = S.disp(314, 932, 160, 58, drawSeg), kV = S.knob(180, 1020, 'vs'), kI = S.knob(270, 1020, 'I'), sP = S.sock(380, 1020, 0xd42b24, 'cP'), sN = S.sock(420, 1020, 0x15161a, 'cP'), rock = S.rocker(467, 1020, 'pwr')
  const G = K.unit({ x: 0.06, z: 0.44, w: 0.42, h: 0.2, d: 0.24, body: 0x264e7a, art: artGm, x0: 560, y0: 890, W: 340, H: 170, pw: 0.4 })
  const dG = G.disp(584, 932, 200, 58, drawSeg), kZ = G.knob(620, 1020, 'zero'), jack = G.sock(760, 1020, 0x15161a, 'probe')
  const k2 = G.key(838, 946, 76, 24, '2 kG', 0xd7dbe0, 'r2', '#1B2430'), k20 = G.key(838, 974, 76, 24, '20 kG', 0x1565c0, 'r20')
  const coilP = V(MX - 0.14, 0.09, Z0 + 0.09), coilN = V(MX + 0.14, 0.09, Z0 + 0.09)
  add(cyl(0.006, 0.02), stdM(0xd42b24, 0.4), coilP.x, 0.09, coilP.z).rotation.x = Math.PI / 2; add(cyl(0.006, 0.02), M.black, coilN.x, 0.09, coilN.z).rotation.x = Math.PI / 2
  const pair = (a, b, c, xx) => ({ on: tube([a, a.clone().add(V(0, -0.02, 0.09)), V(xx, 0.04, 0.3), V(b.x, 0.04, b.z + 0.12), b], c), off: tube([a, a.clone().add(V(0, -0.04, 0.08)), V(a.x + 0.06, 0.012, a.z + 0.2), V(a.x + 0.09, 0.006, a.z + 0.24)], c) })
  const leads = [pair(sP, coilP, 0xc42a26, -0.66), pair(sN, coilN, 0x101114, -0.5)]
  const probeG = new THREE.Group(); scene.add(probeG)
  const bar = alongZ(add(cyl(0.004, 0.11), M.chrome, MX, HB - 0.045, Z0 + 0.06, probeG))
  void bar
  const pTube = tube([jack, jack.clone().add(V(0, -0.04, 0.08)), V(-0.12, 0.04, 0.34), V(-0.45, 0.05, 0.2), V(MX + 0.03, 0.14, Z0 + 0.14), V(MX, HB - 0.045, Z0 + 0.12)], 0x101114)
  void pTube

  const Q = { v: null, range: 20, zero: 0, probe: true, key: '' }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'I' || d === 'vs') return { d, val: v[d] }
      if (d === 'zero') return { d, val: Q.zero }
      if (d === 'focus') return { d, val: v.fx, plane: new THREE.Plane(V(0, 1, 0), -RAIL_Y) }
      if (d === 'pol') { const op = ctl('pol').options, i = op.findIndex((q) => q[0] === v.pol); api.set('pol', op[(i + 1) % op.length][0]); return }
      if (d === 'r2') { Q.range = 2; update.redo(); return }
      if (d === 'r20') { Q.range = 20; update.redo(); return }
      if (d === 'probe') { api.set('probe', !v.probe); return }
      api.set(d, !v[d])
    },
    drag: (s, e, mv) => {
      if (s.d === 'I') { const q = ctl('I'); api.set('I', quant(q, s.val + (mv / 240) * (q.max - q.min))) }
      if (s.d === 'vs') api.set('vs', +clamp(s.val + (mv / 240) * 40, 0, 40).toFixed(1))
      if (s.d === 'zero') { Q.zero = +clamp(s.val + (mv / 240) * 1, -0.5, 0.5).toFixed(2); update.redo() }
      if (s.d === 'focus') { const p = K.castTo(e, s.plane); if (p) api.set('fx', +clamp(p.x - 0.3, -0.1, 0.1).toFixed(3)) }
    },
    cursor: (d) => (['I', 'vs', 'zero', 'focus'].includes(d) ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t, tc) => {
    Q.v = v
    const volts = v.pwr && v.cP ? Math.min(v.vs, o.Ie * R_COIL) : 0
    dV.set(`${v.pwr}${volts.toFixed(1)}`, v.pwr ? volts.toFixed(1).padStart(4, ' ') : null, 'V')
    dA.set(`${v.pwr}${o.Ie}`, v.pwr ? o.Ie.toFixed(2) : null, 'A')
    const kG = o.B * 10 + (v.probe ? Q.zero : 0), shown = v.probe ? kG : Q.zero
    dG.set(`${shown}${Q.range}${v.pwr}`, v.pwr ? (Q.range === 2 && shown > 2 ? '1   ' : shown.toFixed(2)) : null, 'kG')
    kI.rotation.z = rad(135 - (v.I / 8) * 270); kV.rotation.z = rad(135 - (v.vs / 40) * 270); kZ.rotation.z = rad(135 - (Q.zero + 0.5) * 270); rock(v.pwr)
    k2.mat.color.set(Q.range === 2 ? 0x1565c0 : 0xd7dbe0); k20.mat.color.set(Q.range === 20 ? 0x1565c0 : 0xd7dbe0)
    leads.forEach((q) => { q.on.visible = v.cP; q.off.visible = !v.cP })
    probeG.visible = v.probe; polTag.set(v.pol, v.pol === 'sigma' ? 'ANALYZER: σ' : v.pol === 'pi' ? 'ANALYZER: π' : 'ANALYZER: open')
    L2.position.x = v.fx
    lampMat.color.set(v.lamp ? 0xcfffe6 : 0x445049); halo.visible = v.lamp; beam.visible = v.lamp
    beads.forEach((m, i) => { m.visible = v.lamp; if (m.visible) m.position.set(-0.62 + ((i / 40 + t * 0.07) % 1) * 1.16, HB, Z0) })
    if (tc) { const key = `${o.B.toFixed(4)}|${v.pol}|${v.fx}|${v.lamp}`; if (key !== Q.key) { Q.key = key; paintRings(tc.getContext('2d'), tc.width, { ord: 2 * 3e-3 * o.dk, pol: v.pol, f: v.fx, lit: v.lamp }) } }
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['magnet', 'Electromagnet'], ['optics', 'Optical bench'], ['meters', 'Supply and meter']]
const HINT = 'Turn I on the supply to change the field and watch the rings split. Click the polarizer to change the analyzer and drag lens L2 along the bench to focus. V limits the current, and the lamp, POWER, red socket and probe socket all click.'
export const zeeman3D = zeeman.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ pwr: true, lamp: true, cP: true, probe: true, vs: 40, fx: 0 }),
  out: (v, t) => { const Ie = v.pwr && v.cP ? Math.min(v.I, v.vs / R_COIL) : 0; return { ...e.out({ ...v, I: Ie }, t), Ie } },
  sample: (v, o) => {
    if (!v.pwr) return { error: 'The supply is off. Press POWER.' }
    if (!v.cP) return { error: 'The magnet leads are unplugged. Click the red socket.' }
    if (!v.lamp) return { error: 'The Hg lamp is off. Click it to switch it on.' }
    if (!v.probe) return { error: 'The Gauss meter probe is unplugged. Click its socket.' }
    if (Math.abs(v.fx) > 0.012) return { error: 'The rings are out of focus. Drag lens L2 back along the bench.' }
    return e.sample(v, o)
  },
  Stage: stage3D(e, (host, api) => build(host, api, e), { labels: LABELS, hint: HINT, overlay: { w: 300, h: 300, alt: 'Fabry-Perot rings seen by the camera', caption: 'CMOS camera image', cls: 'low' } }),
}))
