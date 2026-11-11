import { bhHardSoft, MAT, loop, loopStats } from './magnetism'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, silk } from './kit3d'

/* The hard and soft B-H kit: laminated U-I core with two coils, sensors and a data logger. */

const C = { x: -0.46, z: -0.02 }
const VIEWS = {
  whole: { p: [-0.06, 0.62, 1.86], t: [-0.06, 0.16, 0.06] },
  core: { p: [-0.46, 0.34, 0.86], t: [-0.46, 0.17, 0] },
  logger: { p: [0.34, 0.34, 0.92], t: [0.34, 0.08, 0.08] },
}
const hmOf = (v) => (v.n !== undefined ? Math.max(2, 600 * 0.8 ** v.n) : v.I * 600)

function drawLogger(g, W, H) {
  const k = W / 370, X = (x) => (x - 970) * k, Y = (y) => (y - 585) * k
  const t = (s, x, y, z = 13) => { g.fillStyle = '#F2F4F7'; g.font = `bold ${z * k}px Arial`; g.textAlign = 'center'; g.fillText(s, X(x), Y(y)) }
  g.fillStyle = '#E9702A'; g.fillRect(0, 0, W, H); g.fillStyle = '#292C33'; g.fillRect(X(976), Y(592), 352 * k, 136 * k)
  t('DATA LOGGER · 4 CH · 12-bit · 100 ksps', 1150, 616, 13.5)
  ;[[1006, 'CH1'], [1068, 'CH2'], [1130, 'CH3'], [1192, 'CH4']].forEach(([x, s]) => t(s, x, 698)); t('DRIVE', 1240, 694, 11.5); t('DAC ±12 V', 1290, 712, 10)
}
function plot(g, w, h, s) {
  g.fillStyle = '#081019'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1E3A4D'; g.lineWidth = 1.4
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke()
  if (!s) { g.fillStyle = '#FFB0A0'; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.fillText('Connect the coils and sensors', w / 2, h / 2 - 12); return }
  const X = (x) => w / 2 + (x / 680) * (w / 2) * 0.95, Y = (b) => h / 2 - (b / 1.75) * (h / 2) * 0.95
  g.strokeStyle = s.col; g.lineWidth = 3.2; g.beginPath()
  for (let i = 0; i <= 160; i++) { const H = -s.Hm + (i / 160) * 2 * s.Hm, b = s.L.up(H); if (i) g.lineTo(X(H), Y(b)); else g.moveTo(X(H), Y(b)) }
  for (let i = 160; i >= 0; i--) { const H = -s.Hm + (i / 160) * 2 * s.Hm; g.lineTo(X(H), Y(s.L.down(H))) }
  g.stroke(); g.fillStyle = '#FFD45E'; g.beginPath(); g.arc(X(s.H), Y(s.B), 8, 0, 7); g.fill()
  g.font = 'bold 20px Arial'; g.textAlign = 'left'; g.fillStyle = '#E8F2F8'; g.fillText(s.name, 14, 28); g.fillText(`Br ${s.st.Br.toFixed(3)} T   Hc ${s.st.Hc.toFixed(1)} A/m`, 14, h - 14)
}

function build(host, api, exp, fixed) {
  const K = kitScene(host, { background: 0xdfe2e6, floor: { base: '#A9794F', wall: 0xdfe2e6 }, views: VIEWS })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, tube, M, stdM, label, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  const stripe = (base, line) => { const f = face(256, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < h; i += 5) { g.fillStyle = i % 10 ? line : base; g.fillRect(0, i, w, 2) } }); f.set(1); return new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.5, metalness: 0.5 }) }
  const lam = stripe('#A4ABB5', '#7D848F')
  const CX = C.x, Z = C.z
  add(box(0.44, 0.012, 0.15), M.dark, CX, 0.006, Z)
  add(box(0.3, 0.075, 0.1), lam, CX, 0.0495, Z)
  ;[-0.11, 0.11].forEach((s) => add(box(0.08, 0.16, 0.1), lam, CX + s, 0.167, Z))
  const topMat = stripe('#BFC5CE', '#8A929D'), spareMat = stripe('#BFC5CE', '#8A929D')
  add(box(0.3, 0.075, 0.1), topMat, CX, 0.2845, Z)
  ;[-0.09, 0.09].forEach((s) => { add(cyl(0.006, 0.05), M.brass, CX + s, 0.335, Z); add(cyl(0.012, 0.012), M.black, CX + s, 0.36, Z) })
  const coil = (s, col, line, text) => {
    const m = stripe(col, line)
    add(cyl(0.065, 0.125, 48), m, CX + s, 0.167, Z)
    ;[-1, 1].forEach((q) => add(cyl(0.072, 0.006, 48), M.black, CX + s, 0.167 + q * 0.0655, Z))
    add(box(0.09, 0.034, 0.001), new THREE.MeshBasicMaterial({ color: 0xffffff }), CX + s, 0.167, Z + 0.0655)
    label(0.086, 0.03, text, 62, '#1B2330', CX + s, 0.167, Z + 0.0662)
  }
  coil(-0.11, '#B5553A', '#7F2F1C', 'PRIMARY 300 T'); coil(0.11, '#2E8B4C', '#1A5A30', 'SECONDARY 300 T')
  const tagF = () => face(620, 80, (g, w, h, s) => silk(s, 44, '#101418')(g, w, h)), topTag = tagF(), tagPlane = plain(add(new THREE.PlaneGeometry(0.2, 0.026), new THREE.MeshBasicMaterial({ map: topTag.tex, transparent: true }), CX, 0.2845, Z + 0.0504))
  void tagPlane
  const spareTag = tagF()
  add(box(0.3, 0.06, 0.075), spareMat, CX, 0.03, 0.32); plain(add(new THREE.PlaneGeometry(0.2, 0.026), new THREE.MeshBasicMaterial({ map: spareTag.tex, transparent: true }), CX, 0.03, 0.3579))
  hit(box(0.32, 0.08, 0.1), CX, 0.04, 0.32, 'swap')
  const socket = (x, y, col, d) => { alongX(add(cyl(0.01, 0.006, 20), M.chrome, x, y, Z + 0.03)); add(new THREE.SphereGeometry(0.0062, 12, 10), stdM(col, 0.4), x, y, Z + 0.03); hit(new THREE.SphereGeometry(0.018, 10, 8), x, y, Z + 0.03, d); return V(x, y, Z + 0.03) }
  const px = CX - 0.19, sx = CX + 0.19
  const pA = socket(px, 0.19, 0xd42b24, 'cP'), pB = socket(px, 0.15, 0x15161a, 'cP'), sA = socket(sx, 0.19, 0xd42b24, 'cS'), sB = socket(sx, 0.15, 0x15161a, 'cS')

  const L = K.unit({ x: 0.42, z: -0.08, w: 0.39, h: 0.17, d: 0.2, body: 0xe8661e, lid: 0xff9a5c, art: drawLogger, x0: 970, y0: 585, W: 370, H: 150, pw: 0.37 })
  const ch = [[1006, 0xd9b24c, 'cL'], [1068, 0xd9b24c, 'cL'], [1130, 0x15161a], [1192, 0x15161a]].map(([x, c, d]) => L.sock(x, 657, c, d))
  const dacP = L.sock(1280, 646, 0xd42b24), dacN = L.sock(1280, 680, 0x15161a)
  const drive = L.knob(1240, 650, 'drive', 0.0145)
  const pcb = (x, z, a, b, c) => { add(box(0.15, 0.03, 0.08), stdM(c, 0.45), x, 0.015, z); const f = face(320, 170, (g, w, h) => { g.fillStyle = `#${c.toString(16).padStart(6, '0')}`; g.fillRect(0, 0, w, h); g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = 'bold 30px Arial'; g.fillText(a, w / 2, 56); g.font = '24px Arial'; g.fillText(b, w / 2, 104) }); f.set(1); plain(add(new THREE.PlaneGeometry(0.148, 0.078), new THREE.MeshBasicMaterial({ map: f.tex }), x, 0.0304, z)).rotation.x = -Math.PI / 2 }
  pcb(0.1, 0.3, 'CURRENT SENSOR', '±1 A · auto-ID', 0x6a1b9a); pcb(0.34, 0.3, 'VOLTAGE SENSOR', '±1 V · auto-ID', 0x1565c0)
  const RED = 0xc42a26, BK = 0x101114, OR = 0xf5a623
  const pair = (onPts, offPts, col) => ({ on: tube(onPts, col), off: tube(offPts, col) })
  const curIn = V(0.06, 0.03, 0.27), volIn = V(0.3, 0.03, 0.27), hangP = (a) => [a, a.clone().add(V(-0.05, -0.05, 0.04)), V(a.x - 0.1, 0.01, a.z + 0.2), V(a.x - 0.06, 0.005, a.z + 0.26)], hangS = (a) => [a, a.clone().add(V(0.05, -0.05, 0.04)), V(a.x + 0.1, 0.01, a.z + 0.14), V(a.x + 0.14, 0.005, a.z + 0.14)]
  const P = [pair([pA, pA.clone().add(V(-0.05, -0.05, 0.05)), V(px - 0.03, 0.012, 0.3), V(-0.25, 0.012, 0.42), V(-0.02, 0.02, 0.36), curIn], hangP(pA), RED), pair([pB, pB.clone().add(V(-0.05, -0.05, 0.05)), V(px - 0.02, 0.012, 0.34), V(-0.1, 0.012, 0.48), V(0.45, 0.012, 0.36), V(dacN.x + 0.04, 0.03, dacN.z + 0.12), dacN], hangP(pB), BK)]
  const S = [pair([sA, sA.clone().add(V(0.05, -0.04, 0.05)), V(-0.1, 0.02, 0.14), V(0.25, 0.03, 0.2), volIn], hangS(sA), OR), pair([sB, sB.clone().add(V(0.05, -0.04, 0.06)), V(-0.1, 0.016, 0.17), V(0.24, 0.02, 0.22), volIn.clone().add(V(0.02, 0, 0))], hangS(sB), BK)]
  const lg = (a, b) => [a, V(a.x, 0.08, a.z - 0.04), V((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2 + 0.02), b.clone().add(V(0, -0.02, 0.08)), b]
  const off = (b) => [b, b.clone().add(V(0, -0.02, 0.08)), V(b.x, 0.01, b.z + 0.16), V(b.x + 0.02, 0.005, b.z + 0.2)]
  const LG = [pair(lg(V(0.1, 0.03, 0.26), ch[0]), off(ch[0]), BK), pair(lg(V(0.34, 0.03, 0.26), ch[1]), off(ch[1]), BK), pair([V(-0.02, 0.03, 0.3), V(-0.03, 0.05, 0.3), V(0.1, 0.08, 0.2), V(dacP.x, 0.1, dacP.z + 0.12), dacP], [V(-0.02, 0.03, 0.3), V(-0.04, 0.01, 0.3)], RED)]
  /* flux dots running round the iron circuit */
  const path = (u) => { const w = 0.22, h = 0.197; const q = ((u % 1) + 1) % 1, per = 2 * (w + h); let d = q * per; const bx = CX - w / 2, by = 0.05; if (d < w) return [bx + d, by]; d -= w; if (d < h) return [bx + w, by + d]; d -= h; if (d < w) return [bx + w - d, by + h]; d -= w; return [bx, by + h - d] }
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x67e0ff, toneMapped: false })
  const dots = Array.from({ length: 22 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), dotMat); m.userData.u = i / 22; scene.add(m); return m })

  const Q = { v: null }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'cP' || d === 'cS' || d === 'cL') { api.set(d, !v[d]); return }
      if (d === 'swap') { if (ctl('mat')) api.set('mat', v.mat === 'hard' ? 'soft' : 'hard'); return }
      const k = ctl('I') ? 'I' : 'n'
      return { k, val: v[k] }
    },
    drag: (s, e, mv) => { const q = ctl(s.k); api.set(s.k, quant(q, s.val + (mv / 240) * (q.max - q.min))) },
    cursor: (d) => (d === 'drive' ? 'grab' : d === 'swap' && !ctl('mat') ? 'not-allowed' : 'pointer'),
  })
  const update = K.loop((v, o, t, tc) => {
    Q.v = v
    const key = fixed || v.mat, m = MAT[key], other = key === 'hard' ? 'soft' : 'hard', Hm = hmOf(v)
    const tint = key === 'hard' ? 0xb7a68f : 0xc9d8e8
    topMat.color.set(tint); spareMat.color.set(other === 'hard' ? 0xb7a68f : 0xc9d8e8)
    topTag.set(key, `I-CORE · ${m.name}`); spareTag.set(other, `spare I-core · ${MAT[other].name}`)
    const live = v.cP && v.cS && v.cL
    P.forEach((q) => { q.on.visible = v.cP; q.off.visible = !v.cP }); S.forEach((q) => { q.on.visible = v.cS; q.off.visible = !v.cS }); LG.forEach((q) => { q.on.visible = v.cL; q.off.visible = !v.cL })
    const dq = ctl('I') ? (v.I - ctl('I').min) / (ctl('I').max - ctl('I').min) : v.n / ctl('n').max
    drive.rotation.z = rad(135 - clamp(dq, 0, 1) * 270)
    const L2 = loop(m, Hm), ph = ((t * 0.5) % 1) * TAU, H = Hm * Math.sin(ph), B = Math.cos(ph) > 0 ? L2.up(H) : L2.down(H)
    const flow = v.cP ? (B / 1.6) * 0.09 : 0
    dots.forEach((d) => { d.visible = v.cP; if (d.visible) { const [x, y] = path(d.userData.u + flow); d.position.set(x, y, Z + 0.0525) } })
    if (tc) plot(tc.getContext('2d'), tc.width, tc.height, live ? { L: L2, Hm, H, B, col: key === 'hard' ? '#FFB84D' : '#62C6F2', name: m.name, st: loopStats(m, Hm) } : null)
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['core', 'Core and coils'], ['logger', 'Data logger']]
const hint = (mat) => `Turn the DRIVE knob on the logger to change the field. ${mat ? 'Click the spare I-core to swap the core material. ' : ''}Click a coil or CH1 socket to unplug its leads. Drag the background to look around.`

export const bhHardSoft3D = bhHardSoft.map((e) => {
  const fixed = e.id === 'hard-material' ? 'hard' : e.id === 'soft-material' ? 'soft' : null
  return {
    ...e,
    wide: true,
    state: () => ({ cP: true, cS: true, cL: true }),
    read: (v, o) => (v.cP && v.cS && v.cL ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: (v, o) => {
      if (!v.cP) return { error: 'The primary coil is unplugged. Click one of its sockets.' }
      if (!v.cS) return { error: 'The secondary coil is unplugged. Click one of its sockets.' }
      if (!v.cL) return { error: 'The sensors are unplugged from the logger. Click CH1 or CH2.' }
      return e.sample(v, o)
    },
    Stage: stage3D(e, (host, api) => build(host, api, e, fixed), { labels: LABELS, hint: hint(!fixed), overlay: { w: 620, h: 460, alt: 'B-H loop', caption: 'Data logger: B against H', cls: '' } }),
  }
})
