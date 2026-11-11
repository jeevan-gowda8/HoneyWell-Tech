import { airWedge } from './optics'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, glowDot, silk } from './kit3d'

/* The air wedge and Newton's rings kit: sodium lamp, 45° glass plate, travelling microscope with
   a micrometer drum, the sample on its stage, and the spherometer. Metres. */

const NA = 589.3e-9
const VIEWS = {
  whole: { p: [0.24, 0.6, 1.12], t: [0.12, 0.14, 0.02] },
  scope: { p: [0.18, 0.42, 0.62], t: [0.04, 0.22, 0] },
  sample: { p: [0.12, 0.28, 0.42], t: [0.02, 0.1, 0] },
  sphero: { p: [0.5, 0.3, 0.62], t: [0.46, 0.08, 0.12] },
}
function paintField(g, w, s) {
  const im = g.createImageData(w, w)
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w - 0.5, y = (j + 0.5) / w - 0.5, p = (j * w + i) * 4
    let I
    if (s.kind === 'wedge') I = 0.5 + 0.5 * Math.cos(TAU * ((u * s.span) / s.beta + s.n))
    else { const r = Math.hypot(u, y) * s.span * 1e-3, t = (r * r) / (2 * s.R * 1e-3); I = 0.04 + 0.92 * Math.sin((TAU * t) / NA) ** 2 }
    const inside = u * u + y * y < 0.245 ? 1 : 0
    im.data[p] = 255 * I * inside; im.data[p + 1] = 196 * I * inside; im.data[p + 2] = 40 * I * inside; im.data[p + 3] = 255
  }
  g.putImageData(im, 0, 0)
  const c = w / 2; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c, 6); g.lineTo(c, w - 6); g.moveTo(6, c); g.lineTo(w - 6, c); g.stroke()
  if (s.kind === 'newton') { g.setLineDash([5, 4]); g.strokeStyle = '#7fd4ff'; g.beginPath(); g.arc(c, c, (s.D / 2 / s.span) * w, 0, 7); g.stroke(); g.setLineDash([]) }
}
const drawDrum = (g, w) => { const c = w / 2; g.fillStyle = '#D9DDE3'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill(); g.strokeStyle = '#1B2330'; g.fillStyle = '#1B2330'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let i = 0; i < 100; i++) { const a = (i / 100) * TAU, big = i % 10 === 0; g.lineWidth = big ? 4 : 1.6; g.beginPath(); g.moveTo(c + c * 0.97 * Math.cos(a), c + c * 0.97 * Math.sin(a)); g.lineTo(c + c * (big ? 0.82 : 0.9) * Math.cos(a), c + c * (big ? 0.82 : 0.9) * Math.sin(a)); g.stroke(); if (big) g.fillText(String(i), c + c * 0.68 * Math.cos(a), c + c * 0.68 * Math.sin(a)) } }

function build(host, api, exp, kind) {
  const K = kitScene(host, { background: 0xeceef1, floor: { base: '#B98A5C', wall: 0xeceef1 }, views: VIEWS, zoom: [0.15, 2.4] })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, M, stdM, label, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  /* sodium lamp */
  add(cyl(0.055, 0.34, 40), stdM(0x35587c, 0.4, 0.45), -0.42, 0.17, -0.02)
  const win = add(box(0.004, 0.06, 0.035), new THREE.MeshBasicMaterial({ color: 0xffc95c, toneMapped: false }), -0.364, 0.2, -0.02); win.castShadow = false
  const gf = face(128, 128, glowDot); gf.set(1)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gf.tex, color: 0xffb84a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); glow.scale.setScalar(0.2); glow.position.set(-0.35, 0.2, -0.02); scene.add(glow)
  hit(cyl(0.06, 0.34, 12), -0.42, 0.17, -0.02, 'lamp')
  label(0.09, 0.022, 'Na LAMP', 60, '#FFC95C', -0.42, 0.1, 0.0365)
  /* travelling microscope */
  add(box(0.42, 0.03, 0.2), stdM(0x2a2e35, 0.45, 0.35), 0.04, 0.015, 0)
  alongX(add(cyl(0.008, 0.38, 16), M.chrome, 0.04, 0.045, -0.07))
  const carriage = new THREE.Group(); scene.add(carriage)
  add(box(0.07, 0.04, 0.06), M.black, 0, 0.05, -0.07, carriage); add(cyl(0.012, 0.25), M.chrome, 0, 0.18, -0.07, carriage)
  add(box(0.03, 0.03, 0.05), M.black, 0, 0.27, -0.05, carriage)
  const tubeG = add(cyl(0.017, 0.16, 28), M.black, 0, 0.32, -0.02, carriage); void tubeG
  add(cyl(0.012, 0.04, 24), M.chrome, 0, 0.42, -0.02, carriage); add(cyl(0.019, 0.015, 28), M.chrome, 0, 0.235, -0.02, carriage)
  const plate = plain(add(box(0.05, 0.002, 0.05), M.glass, 0, 0.2, -0.02, carriage)); plate.rotation.z = Math.PI / 4
  const drumF = face(512, 512, drawDrum); drumF.set(1)
  const drum = new THREE.Group(); drum.position.set(0.28, 0.045, -0.07); scene.add(drum)
  alongX(add(cyl(0.035, 0.028, 40), M.chrome, 0, 0, 0, drum)); const df = add(new THREE.CircleGeometry(0.0345, 40), new THREE.MeshStandardMaterial({ map: drumF.tex, roughness: 0.45 }), 0.0145, 0, 0, drum); df.rotation.y = Math.PI / 2; df.castShadow = false
  hit(new THREE.SphereGeometry(0.05, 12, 8), 0.01, 0, 0, 'drum', drum)
  /* sample on the stage */
  const sample = new THREE.Group(); sample.position.set(0.02, 0.03, 0); scene.add(sample)
  add(box(0.1, 0.006, 0.07), stdM(0x111317, 0.6, 0), 0, 0.003, 0, sample)
  const wedgeG = new THREE.Group(); sample.add(wedgeG)
  plain(add(box(0.076, 0.002, 0.026), M.glass, 0, 0.007, 0, wedgeG)); const top = plain(add(box(0.076, 0.002, 0.026), M.glass, 0, 0.0095, 0, wedgeG)); top.rotation.z = 0.025
  const objM = add(box(0.004, 0.003, 0.026), stdM(0xefe6d2, 0.6, 0), -0.036, 0.0088, 0, wedgeG)
  const newtonG = new THREE.Group(); sample.add(newtonG)
  plain(add(box(0.06, 0.003, 0.06), M.glass, 0, 0.0075, 0, newtonG)); plain(add(new THREE.SphereGeometry(0.08, 40, 12, 0, TAU, 0, 0.3), M.glass, 0, 0.0095 - 0.08 * Math.cos(0.3) + 0.0, 0, newtonG)).position.y = 0.009 - 0.0763 + 0.003
  hit(box(0.1, 0.03, 0.08), 0, 0.015, 0, 'sample', sample)
  /* spherometer on its own plate */
  const SX = 0.46, SZ = 0.13
  plain(add(box(0.12, 0.006, 0.12), M.glass, SX, 0.003, SZ))
  plain(add(new THREE.SphereGeometry(0.1, 40, 12, 0, TAU, 0, 0.32), M.glass, SX, 0.006 - 0.1 * Math.cos(0.32), SZ))
  const sph = new THREE.Group(); sph.position.set(SX, 0, SZ); scene.add(sph)
  ;[0, 120, 240].forEach((a) => { const x = Math.cos(rad(a)) * 0.029, z = Math.sin(rad(a)) * 0.029; add(cyl(0.0022, 0.05, 10), M.brass, x, 0.03, z, sph); add(box(0.034, 0.006, 0.008), M.brass, x / 2, 0.055, z / 2, sph).rotation.y = -rad(a) })
  const screw = new THREE.Group(); sph.add(screw)
  add(cyl(0.0022, 0.07, 10), M.steel, 0, 0.04, 0, screw); add(cyl(0.026, 0.006, 40), M.chrome, 0, 0.078, 0, screw); add(cyl(0.006, 0.014, 16), M.black, 0, 0.088, 0, screw)
  hit(cyl(0.04, 0.06, 12), 0, 0.07, 0, 'screw', screw)
  add(box(0.006, 0.05, 0.016), M.brass, 0.036, 0.08, 0, sph)

  const Q = { v: null, key: '', lamp: true }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'lamp') { api.set('lamp', !v.lamp); return }
      if (d === 'drum' && ctl('n')) return { d, k: 'n', val: v.n }
      if (d === 'screw' && ctl('s')) return { d, k: 's', val: v.s }
      if (d === 'sample') { const c = ctl('obj') || ctl('f'); if (!c) return; const op = c.options, i = op.findIndex((q) => q[0] === v[c.k]); api.set(c.k, op[(i + 1) % op.length][0]); return }
    },
    drag: (s, e, mv) => { const q = ctl(s.k); api.set(s.k, quant(q, s.val + (mv / (s.k === 's' ? 900 : 240)) * (q.max - q.min))) },
    cursor: (d) => (d === 'drum' || d === 'screw' ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t, tc) => {
    Q.v = v
    win.material.color.set(v.lamp ? 0xffc95c : 0x4a3a18); glow.visible = v.lamp
    wedgeG.visible = kind === 'wedge'; newtonG.visible = kind === 'newton'
    if (kind === 'wedge') { objM.scale.y = v.obj / 75; carriage.position.x = 0.02 + (o.x / 1000) * 2 } else carriage.position.x = 0.02 + (kind === 'newton' ? (o.D / 2000) * 4 : 0)
    drum.rotation.x = -(kind === 'wedge' ? o.x : kind === 'newton' ? o.D : 0) * TAU
    screw.position.y = kind === 'sphero' ? (v.s - 6.5) * 0.002 : 0
    screw.rotation.y = kind === 'sphero' ? v.s * TAU : 0
    if (tc && kind !== 'sphero') { const k2 = `${kind}|${v.n}|${v.obj}|${v.L}|${v.R}|${v.lamp}`; if (k2 !== Q.key) { Q.key = k2; const g = tc.getContext('2d'); if (!v.lamp) { g.fillStyle = '#000'; g.fillRect(0, 0, tc.width, tc.height) } else paintField(g, tc.width, kind === 'wedge' ? { kind, span: 4, beta: o.beta * 1000, n: 0 } : { kind, span: 2.5, R: v.R, D: o.D }) } }
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['scope', 'Microscope'], ['sample', 'Sample'], ['sphero', 'Spherometer']]
const HINTS = {
  wedge: 'Drag the micrometer drum to move from fringe to fringe under the cross-wire. Click the sample to change the object in the wedge, and the lamp to switch it.',
  newton: 'Drag the micrometer drum to step through the ring order and watch the dashed ring on the cross-wire. Click the lamp to switch it.',
  sphero: 'Drag the spherometer screw head to lower it onto the lens, holding Shift for fine steps. Click the lens to change it.',
}
export const airWedge3D = airWedge.map((e) => {
  const kind = e.id === 'newtons-rings' ? 'newton' : e.id === 'spherometer' ? 'sphero' : 'wedge'
  return {
    ...e,
    wide: true,
    state: () => ({ lamp: true }),
    sample: (v, o) => (kind !== 'sphero' && !v.lamp ? { error: 'The sodium lamp is off. Click it to switch it on.' } : e.sample(v, o)),
    Stage: stage3D(e, (host, api) => build(host, api, e, kind), { labels: LABELS, hint: HINTS[kind], overlay: kind === 'sphero' ? null : { w: 260, h: 260, alt: 'View through the microscope', caption: 'Through the microscope', cls: 'low' } }),
  }
})
