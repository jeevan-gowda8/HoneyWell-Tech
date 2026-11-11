import { curieKit } from './thermal'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, drawSeg, glowDot } from './kit3d'

/* The Curie temperature kit: Ni-Fe sample and coil in a test tube inside a beaker of hot water,
   kettle, probe thermometer and the two-display unit. Metres. */

const VIEWS = {
  whole: { p: [-0.02, 0.8, 2.05], t: [-0.02, 0.24, 0] },
  tube: { p: [-0.34, 0.5, 0.62], t: [-0.36, 0.34, 0.02] },
  kettle: { p: [0.12, 0.34, 0.74], t: [0.08, 0.13, 0.12] },
  unit: { p: [0.56, 0.3, 0.94], t: [0.56, 0.15, -0.1] },
}
const BX = -0.36, BZ = 0.02
const art = (g, W, H) => {
  const k = W / 580, X = (x) => (x - 1070) * k, Y = (y) => (y - 440) * k, t = (s, x, y, z = 13, c = '#17202B') => { g.fillStyle = c; g.font = `bold ${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, W, H); t('FERROMAGNETIC CURIE TEMPERATURE KIT', 1360, 472, 20, '#1F4D3A'); g.fillStyle = '#0C0D10'; g.fillRect(X(1090), Y(500), 260 * k, 96 * k); g.fillRect(X(1370), Y(500), 260 * k, 96 * k)
  t('AC PRIMARY VOLTAGE', 1220, 618); t('SECONDARY OUTPUT (AC)', 1500, 618); t('AC VOLTAGE ADJ.', 1150, 735); t('PRIMARY OUT', 1290, 716); t('SECONDARY IN', 1420, 716); t('POWER', 1588, 722); t('BNC · 2 mm patch cords to coil', 1355, 738, 11)
}
const drawProbe = (g, w, h, s) => { g.fillStyle = '#C7D69E'; g.fillRect(0, 0, w, h); g.fillStyle = '#20301A'; g.font = `bold ${h * 0.66}px "Courier New", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, w / 2, h / 2) }

function build(host, api, exp) {
  const K = kitScene(host, { background: 0xe1dfda, floor: { base: '#A9794F', wall: 0xe1dfda }, views: VIEWS })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, tube, M, stdM, label, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  /* stand */
  const SX = -0.82
  add(box(0.26, 0.03, 0.16), M.dark, SX + 0.02, 0.015, BZ); add(cyl(0.012, 0.62), M.chrome, SX, 0.34, BZ)
  add(box(0.05, 0.04, 0.05), M.black, SX, 0.56, BZ); alongX(add(cyl(0.007, 0.5), M.chrome, (SX + BX) / 2, 0.56, BZ)); add(box(0.05, 0.04, 0.05), M.black, BX, 0.56, BZ)
  add(new THREE.SphereGeometry(0.012, 16, 12), M.black, SX - 0.045, 0.56, BZ); add(new THREE.SphereGeometry(0.012, 16, 12), M.black, BX + 0.045, 0.56, BZ)
  /* beaker of hot water */
  plain(add(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 56, 1, true), M.glass, BX, 0.166, BZ)); plain(add(cyl(0.13, 0.006, 56), M.glass, BX, 0.006, BZ))
  const water = plain(add(cyl(0.125, 0.26, 56), new THREE.MeshPhysicalMaterial({ color: 0x7fb6dc, transparent: true, opacity: 0.72, roughness: 0.05 }), BX, 0.14, BZ))
  ;[[0.06, '200'], [0.11, '400'], [0.16, '600'], [0.21, '800'], [0.26, '1000']].forEach(([y, s]) => { add(box(0.022, 0.0012, 0.0006), new THREE.MeshBasicMaterial({ color: 0xffffff }), BX - 0.09, y, BZ + 0.13); label(0.05, 0.012, s, 40, '#F2F4F7', BX - 0.05, y, BZ + 0.1303) })
  /* test tube with coils */
  plain(add(new THREE.CylinderGeometry(0.027, 0.027, 0.36, 28, 1, true), M.glass, BX, 0.33, BZ)); plain(add(new THREE.SphereGeometry(0.027, 20, 12, 0, TAU, Math.PI / 2, Math.PI / 2), M.glass, BX, 0.15, BZ))
  add(new THREE.CylinderGeometry(0.03, 0.024, 0.04, 22), stdM(0x6e4a32, 0.8, 0), BX, 0.53, BZ)
  const stripe = (b, l) => { const f = face(256, 128, (g, w, h) => { g.fillStyle = b; g.fillRect(0, 0, w, h); g.fillStyle = l; for (let i = 0; i < h; i += 5) g.fillRect(0, i, w, 2) }); f.set(1); return new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.45, metalness: 0.4 }) }
  add(cyl(0.021, 0.11, 24), stripe('#C78C5A', '#8B5A31'), BX, 0.32, BZ); add(cyl(0.021, 0.1, 24), stripe('#2E8B4C', '#1A5A30'), BX, 0.21, BZ)
  add(cyl(0.012, 0.22, 16), stdM(0x55606e, 0.5, 0.5), BX, 0.265, BZ)
  add(cyl(0.0024, 0.3, 8), stdM(0xc42a26, 0.5, 0), BX - 0.012, 0.4, BZ); add(cyl(0.0024, 0.3, 8), stdM(0x2e8b4c, 0.5, 0), BX + 0.012, 0.4, BZ)
  /* probe thermometer */
  const TX = BX + 0.12, thermo = new THREE.Group(); thermo.position.set(TX, 0.6, BZ); scene.add(thermo)
  add(box(0.07, 0.16, 0.024), stdM(0xf2f2ee, 0.5, 0), 0, 0, 0, thermo)
  alongX(add(cyl(0.004, 0.09), M.chrome, -0.075, -0.04, 0, thermo))
  const pd = face(320, 110, drawProbe), scr = plain(add(new THREE.PlaneGeometry(0.05, 0.022), new THREE.MeshBasicMaterial({ map: pd.tex, toneMapped: false }), 0, 0.05, 0.0124, thermo))
  void scr
  add(cyl(0.006, 0.005, 14), stdM(0xf0671f, 0.4), -0.014, 0.01, 0.014, thermo).rotation.x = Math.PI / 2; add(cyl(0.006, 0.005, 14), stdM(0x3e5068, 0.4), 0.014, 0.01, 0.014, thermo).rotation.x = Math.PI / 2
  hit(new THREE.SphereGeometry(0.014, 8, 6), 0.014, 0.01, 0.02, 'hold', thermo)
  label(0.06, 0.012, 'ON/OFF · HOLD', 36, '#3F4B5C', 0, -0.012, 0.0125, thermo); add(cyl(0.0014, 0.32), M.steel, TX, 0.36, BZ)
  /* kettle */
  const KX = 0.08, KZ = 0.12
  add(cyl(0.135, 0.022, 56), M.black, KX, 0.011, KZ); add(new THREE.CylinderGeometry(0.095, 0.115, 0.2, 52), M.chrome, KX, 0.123, KZ); add(cyl(0.085, 0.014, 40), M.dark, KX, 0.229, KZ); add(box(0.04, 0.012, 0.018), M.black, KX, 0.243, KZ)
  add(new THREE.CylinderGeometry(0.03, 0.05, 0.04, 16), M.chrome, KX - 0.118, 0.2, KZ).rotation.z = 1.2
  add(new THREE.TorusGeometry(0.065, 0.013, 12, 30, Math.PI * 1.1), M.black, KX + 0.1, 0.13, KZ).rotation.z = -Math.PI / 2
  const switchMat = stdM(0xf0671f, 0.4), sw = add(box(0.028, 0.016, 0.008), switchMat, KX + 0.06, 0.1, KZ + 0.106); sw.rotation.y = 0.5
  hit(box(0.05, 0.04, 0.04), KX + 0.06, 0.1, KZ + 0.106, 'heat')
  const gauge = plain(add(new THREE.PlaneGeometry(0.014, 0.1), new THREE.MeshBasicMaterial({ color: 0x4aa3d8 }), KX - 0.05, 0.13, KZ + 0.098)); gauge.rotation.y = -0.5
  label(0.1, 0.02, 'ELECTRIC KETTLE · 1 L · 1000 W', 28, '#26303C', KX, 0.05, KZ + 0.116)
  tube([V(KX + 0.13, 0.012, KZ), V(KX + 0.2, 0.012, KZ + 0.02), V(KX + 0.3, 0.008, KZ + 0.1), V(KX + 0.36, 0.006, KZ + 0.14)], 0x101114)
  /* unit */
  const U = K.unit({ x: 0.56, z: -0.1, w: 0.6, h: 0.32, d: 0.24, body: 0x35654d, lid: 0x5e9a7c, art, x0: 1070, y0: 440, W: 580, H: 310, pw: 0.56 })
  const dV = U.disp(1090, 500, 260, 96, drawSeg), dS = U.disp(1370, 500, 260, 96, drawSeg)
  const kV = U.knob(1150, 685, 'V', 0.026), pOut = U.sock(1290, 680, 0xd42b24, 'cP'), sIn = U.sock(1420, 680, 0x2e8b4c, 'cS'), rock = U.rocker(1588, 685, 'pwr')
  const lead = (s, x, c) => ({ curve: new THREE.CatmullRomCurve3([V(x, 0.55, BZ), V(x + 0.02, 0.62, BZ), V(-0.08, 0.5, 0.04), V(s.x - 0.14, 0.24, s.z + 0.12), s]), c })
  const a = lead(pOut, BX - 0.012, 0xc42a26), b = lead(sIn, BX + 0.012, 0x2e8b4c)
  const onOf = (q) => add(new THREE.TubeGeometry(q.curve, 100, 0.0038, 8), stdM(q.c, 0.55, 0), 0, 0, 0)
  const offOf = (s, c) => tube([s, s.clone().add(V(0, -0.06, 0.09)), V(s.x - 0.02, 0.012, s.z + 0.2), V(s.x - 0.05, 0.006, s.z + 0.26)], c)
  const cP = { on: onOf(a), off: offOf(pOut, 0xc42a26) }, cS = { on: onOf(b), off: offOf(sIn, 0x2e8b4c) }
  const eMat = new THREE.MeshBasicMaterial({ color: 0xffef9a, toneMapped: false })
  const beads = Array.from({ length: 22 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 6), eMat); m.userData.u = i / 22; scene.add(m); return m })
  /* steam */
  const sf = face(128, 128, glowDot); sf.set(1)
  const steam = Array.from({ length: 14 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sf.tex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 })); s.scale.setScalar(0.08); s.userData = { i, kettle: i > 8 }; scene.add(s); return s })

  const Q = { v: null, hold: false, last: 30, acc: 0, lastT: undefined }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'V') return { d, val: v.V }
      if (d === 'hold') { Q.hold = !Q.hold; Q.last = v.T; update.redo(); return }
      api.set(d, !v[d])
    },
    drag: (s, e, mv) => { const q = ctl('V'); api.set('V', quant(q, s.val + (mv / 240) * (q.max - q.min))) },
    cursor: (d) => (d === 'V' ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t) => {
    Q.v = v
    const dt = Q.lastT === undefined ? 0 : clamp(t - Q.lastT, 0, 0.25); Q.lastT = t
    if (v.heat && v.T < 100) { Q.acc += dt * 0.7; if (Q.acc >= 1) { Q.acc -= 1; api.set('T', Math.min(100, v.T + 1)) } }
    if (v.heat && v.T >= 100) api.set('heat', false)
    switchMat.color.set(v.heat ? 0xff3b1f : 0x6b4a36)
    const on = v.pwr
    dV.set(`${on}${v.V}`, on ? v.V.toFixed(2) : null, 'V'); dS.set(`${on}${o.Vs.toFixed(1)}`, on ? o.Vs.toFixed(1).padStart(5, ' ') : null, 'mV')
    kV.rotation.z = rad(135 - ((v.V - 1) / 4) * 270); rock(on)
    pd.set(`${Q.hold ? Q.last : v.T}${Q.hold}`, (Q.hold ? Q.last : v.T).toFixed(1))
    water.material.color.setRGB(0.36 + (v.T - 30) / 280, 0.66 - (v.T - 30) / 700, 0.86 - (v.T - 30) / 500)
    cP.on.visible = v.cP; cP.off.visible = !v.cP; cS.on.visible = v.cS; cS.off.visible = !v.cS
    const flow = on && v.cP
    beads.forEach((m, i) => { m.visible = flow; if (flow) { const u = ((m.userData.u + t * 0.14) % 1), q = i % 2 ? a : b; q.curve.getPoint(i % 2 ? 1 - u : u, m.position) } })
    steam.forEach((s) => {
      const heat = s.userData.kettle ? (v.heat ? 0.6 : 0) : clamp((v.T - 52) / 48, 0, 0.42), cyc = ((t * 0.28 + s.userData.i * 0.37) % 1)
      if (s.userData.kettle) s.position.set(KX - 0.15 - cyc * 0.03, 0.26 + cyc * 0.32, KZ + Math.sin(s.userData.i) * 0.02)
      else s.position.set(BX + Math.sin(s.userData.i * 2.1) * 0.11, 0.3 + cyc * 0.34, BZ + Math.cos(s.userData.i * 1.3) * 0.11)
      s.material.opacity = heat * (1 - cyc); s.scale.setScalar(0.05 + cyc * 0.1)
    })
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['tube', 'Sample and coil'], ['kettle', 'Kettle'], ['unit', 'Control unit']]
const HINT = 'Click the kettle switch to heat the water and watch the secondary voltage fall at the Curie point. Turn AC VOLTAGE ADJ. for the primary, and click PRIMARY OUT or SECONDARY IN to unplug a cord. The thermometer HOLD button freezes its display.'
export const curie3D = curieKit.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ pwr: true, cP: true, cS: true, heat: false }),
  out: (v, t) => { const o = e.out(v, t); return v.pwr && v.cP && v.cS ? o : { ...o, Vs: 0 } },
  read: (v, o) => (v.pwr && v.cP && v.cS ? e.read(v, o) : e.read(v, o).map(([a, , u], i) => (i === 0 ? [a, '–', u] : [a, v.T.toFixed(0), u]))),
  sample: (v, o) => {
    if (!v.pwr) return { error: 'The kit is off. Press POWER.' }
    if (!v.cP) return { error: 'The primary coil is unplugged. Click PRIMARY OUT.' }
    if (!v.cS) return { error: 'The secondary coil is unplugged. Click SECONDARY IN.' }
    return e.sample(v, o)
  },
  Stage: stage3D(e, (host, api) => build(host, api, e), { labels: LABELS, hint: HINT }),
}))
