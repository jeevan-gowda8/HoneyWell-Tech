import { millikan } from './modern'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, drawSeg, glowDot } from './kit3d'

/* Millikan's oil drop kit: chamber, atomizer, microscope and camera, monitor, supply and clock. */

const VIEWS = {
  whole: { p: [-0.05, 0.92, 2.18], t: [-0.05, 0.4, 0] },
  chamber: { p: [-0.42, 0.74, 0.92], t: [-0.42, 0.54, -0.26] },
  monitor: { p: [0.42, 0.72, 0.92], t: [0.42, 0.72, -0.42] },
  supply: { p: [-0.5, 0.42, 1.0], t: [-0.5, 0.11, 0.42] },
  clock: { p: [0.3, 0.32, 0.92], t: [0.3, 0.1, 0.42] },
}
const artSupply = (g, W, H) => {
  const k = W / 560, X = (x) => (x - 90) * k, Y = (y) => (y - 860) * k, t = (s, x, y, z = 14, al = 'center') => { g.fillStyle = '#17202B'; g.font = `bold ${z * k}px Arial`; g.textAlign = al; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, W, H); t('MILLIKAN OIL DROP · POWER SUPPLY', 370, 894, 17)
  g.fillStyle = '#0C0D10'; g.fillRect(X(114), Y(906), 200 * k, 64 * k); t('PLATE VOLTAGE 0–300 V DC', 214, 992, 12); t('VOLTAGE', 370, 984, 13)
  g.fillStyle = '#D7DBE0'; g.fillRect(X(420), Y(916), 90 * k, 56 * k); t('+', 434, 950, 18); t('0', 465, 950, 16); t('−', 498, 950, 18); t('FIELD REVERSE', 465, 992, 12); t('PLATES', 570, 962, 12); t('12 V LED', 570, 1042, 12); t('POWER', 200, 1026, 13, 'left')
}
const artClock = (g, W, H) => { const k = W / 330, X = (x) => (x - 900) * k, Y = (y) => (y - 870) * k; g.fillStyle = '#EDF0F4'; g.fillRect(0, 0, W, H); g.fillStyle = '#0C0D10'; g.fillRect(X(930), Y(912), 270 * k, 64 * k); g.fillStyle = '#17202B'; g.font = `bold ${15 * k}px Arial`; g.textAlign = 'center'; g.fillText('DIGITAL STOP CLOCK · 0.1 s', X(1065), Y(900)) }

const OTHERS = Array.from({ length: 18 }, (_, i) => ({ x: Math.sin(i * 9.1) * 0.82, y: (i * 0.137) % 1, f: 0.5 + ((i * 7) % 5) * 0.28, q: 0.4 + ((i * 5) % 7) * 0.22 }))
function drawMonitor(g, w, h, s) {
  g.fillStyle = '#05070A'; g.fillRect(0, 0, w, h)
  if (!s.lit) { g.fillStyle = '#6E7681'; g.font = 'bold 28px Arial'; g.textAlign = 'center'; g.fillText('NO ILLUMINATION', w / 2, h / 2); return }
  const cx = w / 2, cy = h / 2, R = h * 0.47
  g.fillStyle = '#0B1720'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill()
  const y0 = cy - h * 0.2, mm = h * 0.4
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip()
  for (let i = -3; i <= 13; i++) { const y = y0 + (i * mm) / 10 * 2; g.strokeStyle = '#27404F'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - R, y); g.lineTo(cx + R, y); g.stroke() }
  g.strokeStyle = '#8FA7B5'; g.lineWidth = 3;[y0, y0 + mm].forEach((y) => { g.beginPath(); g.moveTo(cx - R, y); g.lineTo(cx + R, y); g.stroke() }); g.strokeStyle = '#35505F'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke()
  g.fillStyle = '#FFF3C4'; s.others.forEach((d) => { g.beginPath(); g.arc(cx + d.x * R, cy - R + d.py * 2 * R, 3 + d.f, 0, 7); g.fill() })
  const y = y0 + (s.y * mm); g.beginPath(); g.arc(cx, y, 6, 0, 7); g.fillStyle = '#FFE08A'; g.fill(); g.strokeStyle = '#FFD45E'; g.lineWidth = 3; g.beginPath(); g.arc(cx, y, 18, 0, 7); g.stroke()
  g.restore()
  g.fillStyle = '#A6B4BF'; g.font = 'bold 24px Arial'; g.textAlign = 'left'; g.fillText('DIGI-EYE · 30× · tracked drop', 30, 44); g.fillText('start', cx + R * 0.86, y0 + 8); g.fillText('stop (1.0 mm)', cx + R * 0.86, y0 + mm + 8)
  g.textAlign = 'right'; g.fillText(s.state, w - 30, 44)
}

function build(host, api, exp) {
  const K = kitScene(host, { background: 0xdfe3e7, floor: { base: '#A9794F', wall: 0xdfe3e7 }, views: VIEWS })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, tube, M, stdM, label, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  /* stand and chamber */
  const CX = -0.42, CZ = -0.26
  add(box(0.34, 0.03, 0.26), M.dark, CX, 0.015, CZ)
  ;[[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]].forEach(([a, b]) => add(cyl(0.0085, 0.34), M.chrome, CX + a, 0.2, CZ + b))
  add(box(0.34, 0.012, 0.26), M.steel, CX, 0.376, CZ)
  add(cyl(0.11, 0.018, 56), M.brass, CX, 0.392, CZ)
  plain(add(new THREE.CylinderGeometry(0.1, 0.1, 0.13, 56, 1, true), M.glass, CX, 0.466, CZ))
  add(cyl(0.11, 0.018, 56), M.brass, CX, 0.54, CZ)
  add(box(0.05, 0.03, 0.05), M.black, CX, 0.564, CZ)
  const beamS = face(128, 128, glowDot); beamS.set(1)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: beamS.tex, color: 0xffeeb0, opacity: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(0.2, 0.08, 1); glow.position.set(CX - 0.02, 0.466, CZ); scene.add(glow)
  const ledG = alongX(add(cyl(0.024, 0.09), M.black, CX - 0.18, 0.466, CZ))
  void ledG
  const lens = alongX(add(cyl(0.02, 0.006), new THREE.MeshBasicMaterial({ color: 0xfff4c8, toneMapped: false }), CX - 0.132, 0.466, CZ))
  hit(box(0.11, 0.07, 0.07), CX - 0.18, 0.466, CZ, 'led')
  add(cyl(0.006, 0.08), M.chrome, CX + 0.2, 0.42, CZ)
  alongX(add(cyl(0.024, 0.17), M.black, CX + 0.21, 0.466, CZ))
  alongX(add(cyl(0.01, 0.05), M.chrome, CX + 0.32, 0.466, CZ))
  add(box(0.1, 0.07, 0.07), stdM(0x263039, 0.45), CX + 0.4, 0.466, CZ)
  label(0.09, 0.022, 'DIGI-EYE', 60, '#FFF', CX + 0.4, 0.466, CZ + 0.0358)
  /* atomizer */
  const AX = CX + 0.2, AY = 0.66
  plain(add(cyl(0.015, 0.05), M.glass, AX - 0.06, AY, CZ)); add(cyl(0.0135, 0.022), stdM(0xe0bd4f, 0.3), AX - 0.06, AY - 0.012, CZ)
  alongX(add(cyl(0.0035, 0.06), M.black, AX - 0.03, AY, CZ))
  const bulb = add(new THREE.SphereGeometry(0.03, 24, 16), M.black, AX + 0.025, AY, CZ)
  hit(new THREE.SphereGeometry(0.05, 10, 8), AX, AY, CZ, 'atom')
  tube([V(AX - 0.08, AY + 0.02, CZ), V(AX - 0.16, AY + 0.03, CZ), V(CX + 0.02, 0.62, CZ), V(CX, 0.58, CZ)], 0xd8dbe0, 0.0028)
  const spray = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a })); m.visible = false; scene.add(m); return m })
  /* monitor */
  const MX = 0.42, MZ = -0.42
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.014, 48), M.dark, MX, 0.007, MZ); add(cyl(0.028, 0.34), M.chrome, MX, 0.18, MZ)
  add(box(0.98, 0.58, 0.04), M.black, MX, 0.64, MZ)
  const scr = face(1200, 672, drawMonitor), mon = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.527), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); mon.position.set(MX, 0.65, MZ + 0.0206); scene.add(mon)
  const camOut = V(CX + 0.45, 0.466, CZ)
  tube([camOut, V(CX + 0.56, 0.4, CZ + 0.05), V(MX - 0.25, 0.28, MZ + 0.08), V(MX - 0.1, 0.36, MZ - 0.02)], 0x101114)
  /* supply */
  const U = K.unit({ x: -0.5, z: 0.42, w: 0.56, h: 0.21, d: 0.26, body: 0x264e7a, lid: 0x4f7fae, art: artSupply, x0: 90, y0: 860, W: 560, H: 200, pw: 0.53 })
  const dV = U.disp(114, 906, 200, 64, drawSeg), knobV = U.knob(370, 942, 'V', 0.024)
  const rock = U.rocker(142, 1020, 'pwr')
  const [sa, sb] = U.P(465, 950), slider = add(box(0.016, 0.03, 0.006), stdM(0xdf3b30, 0.4), sa, sb, 0.003, U.panel); hit(box(0.1, 0.06, 0.03), sa, sb, 0.012, 'rev', U.panel)
  const plP = U.sock(550, 930, 0xd42b24, 'cP'), plN = U.sock(590, 930, 0x15161a, 'cP'), ledP = U.sock(550, 1010, 0xd42b24), ledN = U.sock(590, 1010, 0x15161a); void ledN
  const onT = V(CX, 0.578, CZ), RED = 0xc42a26
  const cP = [{ on: tube([plP, plP.clone().add(V(0, -0.02, 0.08)), V(-0.38, 0.2, 0.24), V(CX + 0.03, 0.64, CZ + 0.06), onT], RED), off: tube([plP, plP.clone().add(V(0, -0.04, 0.08)), V(plP.x + 0.06, 0.012, plP.z + 0.18), V(plP.x + 0.1, 0.006, plP.z + 0.22)], RED) }, { on: tube([plN, plN.clone().add(V(0, -0.02, 0.08)), V(-0.3, 0.18, 0.2), V(CX + 0.16, 0.34, CZ + 0.14), V(CX + 0.1, 0.388, CZ + 0.08)], 0x101114), off: tube([plN, plN.clone().add(V(0, -0.04, 0.08)), V(plN.x + 0.08, 0.012, plN.z + 0.18), V(plN.x + 0.13, 0.006, plN.z + 0.2)], 0x101114) }]
  tube([ledP, ledP.clone().add(V(0, -0.04, 0.08)), V(-0.82, 0.04, 0.36), V(CX - 0.24, 0.2, CZ + 0.05), V(CX - 0.225, 0.466, CZ)], 0xf5a623)
  /* clock and oil */
  const T = K.unit({ x: 0.3, z: 0.42, w: 0.34, h: 0.17, d: 0.2, body: 0x34404c, art: artClock, x0: 900, y0: 870, W: 330, H: 170, pw: 0.31 })
  const dC = T.disp(930, 912, 270, 64, drawSeg)
  ;[[970, 'START', 0x2e7d32, 'start'], [1065, 'STOP', 0xc62828, 'stop'], [1160, 'RESET', 0x455a64, 'reset']].forEach(([x, t, c, id]) => T.key(x, 1004, 80, 30, t, c, id))
  const OX = 0.74, OZ = 0.42
  add(cyl(0.05, 0.13), stdM(0xd4b25a, 0.22, 0), OX, 0.065, OZ); add(new THREE.CylinderGeometry(0.024, 0.05, 0.04, 20), stdM(0xd4b25a, 0.22, 0), OX, 0.15, OZ); add(cyl(0.024, 0.04), M.black, OX, 0.19, OZ)
  label(0.08, 0.05, 'MINERAL OIL', 62, '#1B2330', OX, 0.075, OZ + 0.0512)

  const Q = { v: null, y: 0.2, run: false, tm: 0, last: null, spray: -9, others: OTHERS.map((d) => ({ ...d, py: d.y })) }
  K.listen({
    grab: (d, e) => {
      const v = Q.v
      if (d === 'V') return { d, val: v.V }
      if (d === 'start') { Q.run = true; update.redo(); return }
      if (d === 'stop') { Q.run = false; update.redo(); return }
      if (d === 'reset') { Q.run = false; Q.tm = 0; update.redo(); return }
      if (d === 'atom') { api.set('d', (v.d + 1) % ctl('d').options.length); Q.y = 0.05; Q.spray = Q.lastT ?? 0; return }
      if (d === 'rev') { if (!v.on) { api.set('on', true); api.set('rev', false) } else if (!v.rev) api.set('rev', true); else { api.set('rev', false); api.set('on', false) } return }
      api.set(d, !v[d])
    },
    drag: (s, e, mv) => { const q = ctl('V'); api.set('V', quant(q, s.val + (mv / 240) * (q.max - q.min))) },
    cursor: (d) => (d === 'V' ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t) => {
    Q.v = v
    const dt = Q.lastT === undefined ? 0 : clamp(t - Q.lastT, 0, 0.25); Q.lastT = t
    const volts = v.pwr && v.cP && v.on ? (v.rev ? -v.V : v.V) : 0
    dV.set(`${v.pwr}${v.V}`, v.pwr ? v.V.toFixed(1).padStart(5, ' ') : null, 'V')
    knobV.rotation.z = rad(135 - (v.V / 300) * 270)
    rock(v.pwr)
    slider.position.x = sa + (v.on ? (v.rev ? 0.03 : -0.03) : 0)
    cP.forEach((q) => { q.on.visible = v.cP; q.off.visible = !v.cP })
    const lit = v.pwr && v.led; lens.material.color.set(lit ? 0xfff4c8 : 0x4a4638); glow.visible = lit
    if (Q.run) Q.tm += dt
    dC.set(Q.tm.toFixed(1), Q.tm.toFixed(1).padStart(5, '0'), 's')
    const sp = (t - Q.spray) / 0.9
    bulb.scale.setScalar(sp < 0.25 ? 0.75 : 1)
    spray.forEach((m, i) => { m.visible = sp >= 0 && sp < 1; if (m.visible) m.position.set(CX + Math.sin(i * 3.7) * 0.06 * sp, 0.56 - sp * 0.12, CZ + Math.cos(i * 2.3) * 0.06 * sp) })
    Q.y += dt * o.vel * 1000
    if (Q.y > 1.3) Q.y = -0.3; if (Q.y < -0.4) Q.y = 1.25
    Q.others.forEach((d) => { d.py += dt * (o.vf / 1e-4) * 0.1 * d.f * (1 - (volts / 300) * (1 / d.q) * 1.6); if (d.py > 1) d.py -= 1; if (d.py < 0) d.py += 1 })
    const state = Math.abs(o.vel) / o.vf < 0.01 ? 'BALANCED' : o.vel > 0 ? 'FALLING' : 'RISING'
    scr.set(`${t}`, { lit, y: Q.y, others: Q.others, state })
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['chamber', 'Chamber'], ['monitor', 'Monitor'], ['supply', 'Supply'], ['clock', 'Stop clock']]
const HINT = 'Turn VOLTAGE until the ringed drop stops on the monitor, holding Shift for fine steps. Click FIELD REVERSE for + , 0 and −, the atomizer bulb for a new drop and the clock keys to time it. Click the LED or a PLATES socket to disconnect them.'
export const millikan3D = millikan.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ pwr: true, led: true, cP: true, rev: false }),
  out: (v, t) => { const on = v.on && v.pwr && v.cP; return e.out({ ...v, on, V: v.rev ? -v.V : v.V }, t) },
  read: (v, o) => (v.pwr && v.led ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
  sample: (v, o) => {
    if (!v.pwr) return { error: 'The supply is off. Press POWER.' }
    if (!v.led) return { error: 'The chamber is dark. Click the LED to light it.' }
    if (!v.cP) return { error: 'The field plates are unplugged. Click a PLATES socket.' }
    if (v.rev) return { error: 'Set FIELD REVERSE to + before recording.' }
    return e.sample(v, o)
  },
  Stage: stage3D(e, (host, api) => build(host, api, e), { labels: LABELS, hint: HINT }),
}))
