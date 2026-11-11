import { ofcKit } from './comm'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, drawSeg, glowDot, silk } from './kit3d'

/* The fibre optic trainer: Tx and Rx board with SMA sockets, the PMMA fibre and its bend mandrel,
   cable spools, the NA jig, and test points for fault finding. Metres. */

const U = { x: 0, z: -0.16, w: 0.9, h: 0.16, d: 0.3, x0: 0, y0: 0, W: 900, H: 300, pw: 0.86 }
const VIEWS = {
  whole: { p: [-0.06, 0.92, 1.86], t: [-0.06, 0.1, 0.08] },
  panel: { p: [0, 0.42, 0.78], t: [0, 0.1, -0.08] },
  fibre: { p: [0.02, 0.48, 0.66], t: [0.02, 0.04, 0.2] },
  jig: { p: [-0.52, 0.32, 0.74], t: [-0.55, 0.06, 0.34] },
}
const KIND = { 'numerical-aperture': 'na', 'bending-loss': 'bend', 'propagation-loss': 'prop', 'led-vi': 'led', photodetector: 'photo', 'am-fm-pwm-link': 'mod', 'rs232-duplex': 'duplex', 'fault-diagnosis': 'fault' }
const BLOCKS = ['Mic', 'AC amp', 'Tx driver', 'Fibre', 'Rx', 'Comparator', 'Filter', 'Speaker']
const TPX = [80, 175, 270, 365, 535, 630, 725, 820]

function art(g, W, H) {
  const k = W / 900, X = (x) => x * k, Y = (y) => y * k, t = (s, x, y, z = 13, c = '#F2F4F7') => { g.fillStyle = c; g.font = `bold ${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#1E2733'; g.fillRect(0, 0, W, H); g.fillStyle = '#E20001'; g.fillRect(0, 0, W, Y(30)); t('FIBER OPTIC COMMUNICATION TRAINER', 450, 21, 15)
  g.strokeStyle = '#5B6B80'; g.lineWidth = 2 * k; g.strokeRect(X(16), Y(42), 400 * k, 245 * k); g.strokeRect(X(484), Y(42), 400 * k, 245 * k)
  t('TRANSMITTER', 216, 62); t('RECEIVER', 684, 62); t('LED', 120, 160, 11); t('DRIVE', 210, 160, 11); t('FREQ', 300, 160, 11); t('Tx SMA', 380, 160, 11); t('Rx SMA', 520, 160, 11); t('POWER', 760, 160, 11); t('MODE', 216, 196, 11); t('FAULT', 820, 236, 11)
  g.fillStyle = '#0C0D10'; g.fillRect(X(600), Y(78), 200 * k, 60 * k); g.fillRect(X(60), Y(78), 150 * k, 48 * k)
  BLOCKS.forEach((b, i) => t(`P${i + 1}`, TPX[i], 276, 10, '#C9D3DE'))
}

function build(host, api, exp, kind) {
  const K = kitScene(host, { background: 0xeceef1, floor: { base: '#B98A5C', wall: 0xeceef1 }, views: VIEWS })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, M, stdM, label, scene, tubeG } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  const T = K.unit({ ...U, body: 0x2b3440, lid: 0x3d4a5a, art })
  const disp = T.disp(600, 78, 200, 60, drawSeg), dLed = T.disp(60, 78, 150, 48, drawSeg)
  const kD = T.knob(210, 120, 'drive'), kF = T.knob(300, 120, 'freq')
  const rock = T.rocker(760, 120, 'pwr')
  const keys = { 660: T.key(100, 140, 40, 22, '660', 0xd7dbe0, 'l:660', '#17202B'), 950: T.key(145, 140, 40, 22, '950', 0xd7dbe0, 'l:950', '#17202B') }
  const mkeys = { am: T.key(150, 214, 56, 22, 'AM', 0xd7dbe0, 'm:am', '#17202B'), fm: T.key(216, 214, 56, 22, 'FM', 0xd7dbe0, 'm:fm', '#17202B'), pwm: T.key(282, 214, 56, 22, 'PWM', 0xd7dbe0, 'm:pwm', '#17202B') }
  const kFault = T.knob(820, 205, 'fault', 0.015)
  const txLed = T.led(380, 95, 0.006), rxLed = T.led(520, 95, 0.006)
  const tx = T.sock(380, 120, 0x2a6fd1), rx = T.sock(520, 120, 0x2a6fd1)
  const tps = TPX.map((x, i) => { const p = T.sock(x, 256, 0xd9b24c, kind === 'fault' ? `tp:${i + 1}` : null, 0.008); return p })
  /* fibre */
  const fibM = stdM(0xf06a1c, 0.45, 0), fibre = add(tubeG([tx, rx], 0.004), fibM, 0, 0, 0)
  const mandrel = add(cyl(0.03, 0.03, 40), stdM(0x9aa3ad, 0.4, 0.5), 0, 0.015, 0.22); hit(cyl(0.05, 0.05, 12), 0, 0.02, 0.22, 'mandrel')
  const spools = [0.5, 1, 1.5].map((c, i) => { const g = new THREE.Group(); g.position.set(0.48 + i * 0.12, 0, 0.26); scene.add(g); add(cyl(0.045, 0.012, 32), M.dark, 0, 0.006, 0, g); add(new THREE.TorusGeometry(0.032, 0.006 + c * 0.004, 10, 32), fibM, 0, 0.018, 0, g).rotation.x = Math.PI / 2; label(0.06, 0.016, `${c} m`, 46, '#1B2330', 0, 0.0126, 0.05, g, true); hit(cyl(0.05, 0.04, 12), 0, 0.02, 0, `c:${c}`, g); return { c, g } })
  /* NA jig */
  const JX = -0.55, JZ = 0.34
  add(box(0.34, 0.012, 0.08), M.dark, JX, 0.006, JZ); alongX(add(cyl(0.004, 0.08, 12), fibM, JX - 0.12, 0.04, JZ)); add(box(0.02, 0.05, 0.03), M.black, JX - 0.15, 0.025, JZ)
  const screen = new THREE.Group(); scene.add(screen); add(box(0.004, 0.08, 0.07), stdM(0xf4f4f0, 0.8, 0), 0, 0.05, JZ, screen); add(box(0.03, 0.01, 0.06), M.black, 0, 0.012, JZ, screen); hit(box(0.04, 0.1, 0.09), 0, 0.05, JZ, 'L', screen)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); cone.rotation.z = Math.PI / 2; scene.add(cone)
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.8 })); spot.rotation.y = -Math.PI / 2; scene.add(spot)
  const jigPlane = new THREE.Plane(V(0, 1, 0), -0.012)
  const eM = new THREE.MeshBasicMaterial({ color: 0xffd0c0, toneMapped: false })
  const beads = Array.from({ length: 16 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), eM); m.userData.u = i / 16; scene.add(m); return m })

  const Q = { v: null, sig: '', curve: null }
  const route = (v) => {
    const R = kind === 'bend' ? v.R / 1000 * 1.2 + 0.012 : 0.03, len = kind === 'prop' ? v.c : 1
    mandrel.scale.set(R / 0.03, 1, R / 0.03)
    const pts = [tx, tx.clone().add(V(0, -0.05, 0.1)), V(-0.15 - len * 0.05, 0.03, 0.15 + len * 0.04)]
    if (kind === 'bend') for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; pts.push(V(Math.cos(a) * (R + 0.004), 0.02, 0.22 - Math.sin(a) * (R + 0.004))) }
    else pts.push(V(0, 0.012, 0.24 + len * 0.05))
    pts.push(V(0.15 + len * 0.05, 0.03, 0.15 + len * 0.04), rx.clone().add(V(0, -0.05, 0.1)), rx)
    Q.curve = new THREE.CatmullRomCurve3(pts); fibre.geometry.dispose(); fibre.geometry = new THREE.TubeGeometry(Q.curve, 160, 0.004, 8)
  }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'pwr') { api.set('pwr', !v.pwr); return }
      if (d.startsWith('l:')) { if (ctl('l')) api.set('l', +d.slice(2)); return }
      if (d.startsWith('m:')) { if (ctl('m')) api.set('m', d.slice(2)); return }
      if (d.startsWith('c:')) { if (ctl('c')) api.set('c', +d.slice(2)); return }
      if (d.startsWith('tp:')) { api.set('tp', +d.slice(3)); return }
      if (d === 'fault') { const c = ctl('f'); if (!c) return; const op = c.options, i = op.findIndex((q) => q[0] === v.f); api.set('f', op[(i + 1) % op.length][0]); return }
      if (d === 'mandrel') return ctl('R') ? { k: 'R', val: v.R } : undefined
      if (d === 'drive') { const k = ctl('V') ? 'V' : ctl('P') ? 'P' : ctl('r') ? 'r' : null; return k ? { k, val: v[k] } : undefined }
      if (d === 'freq') return ctl('f') && kind === 'mod' ? { k: 'f', val: v.f } : undefined
      if (d === 'L') return ctl('L') ? { k: 'L', plane: true } : undefined
    },
    drag: (s, e, mv) => {
      const q = ctl(s.k)
      if (s.plane) { const p = K.castTo(e, jigPlane); if (p) api.set('L', quant(q, ((p.x - (JX - 0.12)) / 0.25) * 30)); return }
      api.set(s.k, quant(q, s.val + (mv / 240) * (q.max - q.min)))
    },
    cursor: (d) => (['mandrel', 'drive', 'freq', 'L'].includes(d) ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t) => {
    Q.v = v
    const sig = `${kind}|${v.R}|${v.c}`; if (sig !== Q.sig) { Q.sig = sig; route(v) }
    const on = v.pwr, lc = v.l === 950 ? 0x9b6bff : 0xff3b30
    fibM.emissive?.set(on ? (v.l === 950 ? 0x2a1050 : 0x501000) : 0x000000)
    Object.entries(keys).forEach(([l, q]) => q.mat.color.set(+l === v.l ? 0x1565c0 : 0xd7dbe0))
    Object.entries(mkeys).forEach(([m, q]) => q.mat.color.set(m === v.m ? 0x1565c0 : 0xd7dbe0))
    rock(on); txLed.material.color.set(on ? lc : 0x333333); rxLed.material.color.set(on ? 0x4bff78 : 0x333333)
    const val = kind === 'bend' || kind === 'prop' ? o.P : kind === 'led' ? o.I : kind === 'photo' ? o.I : kind === 'na' ? o.D : kind === 'mod' ? o.H : kind === 'fault' ? (o.ok ? 1 : 0) : 0
    const unit = { bend: 'µW', prop: 'µW', led: 'mA', photo: 'µA', na: 'mm', mod: '', duplex: '', fault: '' }[kind]
    disp.set(`${on}${val}`, on ? (kind === 'fault' ? (o.ok ? '1' : '0') : kind === 'duplex' ? '19.2' : val.toFixed(val >= 100 ? 1 : 2)) : null, kind === 'duplex' ? 'kBd' : unit)
    dLed.set(`${on}${v.l}`, on && v.l ? String(v.l) : null, 'nm')
    const dk = ctl('V') ? 'V' : ctl('P') ? 'P' : ctl('r') ? 'r' : null
    if (dk) { const q = ctl(dk); kD.rotation.z = rad(135 - ((v[dk] - q.min) / (q.max - q.min)) * 270) }
    if (kind === 'mod') { const q = ctl('f'); kF.rotation.z = rad(135 - ((v.f - q.min) / (q.max - q.min)) * 270) }
    if (kind === 'fault') kFault.rotation.z = rad(135 - (v.f / 8) * 270)
    const flow = on && Q.curve && kind !== 'na'
    beads.forEach((m) => { m.visible = !!flow; m.material = eM; if (flow) Q.curve.getPoint((m.userData.u + t * 0.3) % 1, m.position) })
    eM.color.set(lc)
    /* NA jig */
    const L = (v.L ?? 12) / 1000, xs = JX - 0.12 + (L * 1000 / 30) * 0.25
    screen.position.x = xs - JX; screen.visible = true
    const len = xs - (JX - 0.08), rr = Math.tan(Math.asin(0.5)) * len * 0.55
    cone.visible = spot.visible = kind === 'na' && on
    cone.scale.set(rr, len, rr); cone.position.set(JX - 0.08 + len / 2, 0.04, JZ); spot.scale.setScalar(Math.max(0.003, (o.D || 0) / 1000 * 2.6)); spot.position.set(xs - 0.003, 0.05, JZ)
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['panel', 'Trainer'], ['fibre', 'Fibre'], ['jig', 'NA jig']]
const HINTS = {
  na: 'Drag the white screen along the NA jig and watch the spot grow.',
  bend: 'Drag the mandrel to change the bend radius, and press 660 or 950 for the LED.',
  prop: 'Click a cable spool to change the fibre length, and press 660 or 950 for the LED.',
  led: 'Turn DRIVE to change the LED forward voltage, and press 660 or 950.',
  photo: 'Turn DRIVE to change the optical power, and press 660 or 950.',
  mod: 'Press AM, FM or PWM and turn FREQ for the message frequency.',
  duplex: 'Turn DRIVE to change the display speed. The words are in the controls.',
  fault: 'Click the FAULT knob to choose a fault, then click the P1 to P8 test points.',
}
export const ofc3D = ofcKit.map((e) => {
  const kind = KIND[e.id]
  return {
    ...e,
    wide: true,
    state: () => ({ pwr: true }),
    read: (v, o) => (v.pwr ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: e.sample ? (v, o) => (!v.pwr ? { error: 'The trainer is off. Press its POWER switch.' } : e.sample(v, o)) : undefined,
    Stage: stage3D(e, (host, api) => build(host, api, e, kind), { labels: LABELS, hint: `${HINTS[kind]} Click POWER to switch the trainer.` }),
  }
})
