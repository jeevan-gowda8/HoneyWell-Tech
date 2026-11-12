import { amKit } from './comm'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, silk } from './kit3d'
import boardUrl from './am-board.webp'

/* The Amplitude Modulation & Demodulation trainer board: AF, RF and audio generators, three
   balanced modulators, a balanced demodulator, SSB block, 1 MHz amplifiers, 455 kHz and 1 MHz
   band-pass filters and an audio power amplifier. The printed face is the bench board drawing
   (am-board.webp, 1168 × 828 px of PCB). Panel pixel coordinates are the drawing's own, offset by
   16 px for the wooden frame; sizes in 3D are metres. */

const BOARD = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = boardUrl })
const B = { x0: 16, y0: 16, W: 1168, H: 828, pw: 0.95 }
B.ph = (B.pw * B.H) / B.W
const SL = 0.56, HT = 0.42, A = Math.atan2(SL, HT), CY = HT / 2 + 0.006, N = [0, Math.sin(A), Math.cos(A)]

/* sockets */
const BS = {
  afOut: [338, 190], rfOut: [338, 440], preOut: [338, 696],
  bm1Mod: [446, 184], bm1Car: [530, 278], bm1Out: [752, 202], bm2Mod: [446, 442], bm2Car: [530, 536], bm2Out: [752, 460], bm3Mod: [446, 698], bm3Car: [530, 792], bm3Out: [752, 716],
  demSig: [844, 190], demCar: [952, 262], demOut: [1142, 190],
  afIn: [834, 354], afOut90: [904, 354], rfIn: [834, 422], rfOut90: [904, 422], sumA: [1022, 354], sumB: [1022, 422], ssbOut: [1140, 388],
  paIn: [828, 610], paOut: [962, 610], preIn: [1018, 610], preOutR: [1152, 610],
  b455In: [828, 708], b455Out: [962, 708], b1mIn: [1018, 708], b1mOut: [1152, 708], apaIn: [832, 802], spk: [1072, 802],
}
/* blue preset trimmers */
const BK = { fm: [215, 176], Am: [215, 260], Ac: [160, 522], bal: [548, 134], bal2: [548, 392], bal3: [548, 648], phAf: [960, 354], phRf: [960, 422], vol: [950, 800] }
/* status LED beside each block title */
const BLOCK_LED = { af: [362, 90], rf: [362, 348], mic: [362, 604], bm1: [782, 90], bm2: [782, 348], bm3: [782, 604], demod: [1162, 130], ssb: [1162, 308], pa: [972, 478], pre: [1162, 478], bpf455: [972, 654], bpf1m: [1162, 654], apa: [1162, 762] }
const ACTIVE = {
  'dsb-fc': ['af', 'rf', 'bm1', 'pa'], 'dsb-sc': ['af', 'rf', 'bm1', 'pa'], 'ssb-sc': ['af', 'rf', 'bm1', 'bpf455'],
  'ssb-demodulation': ['af', 'rf', 'bm1', 'bpf455', 'demod', 'apa'],
  'fault-diagnosis': ['af', 'rf', 'bm1', 'bpf455', 'demod', 'apa'],
}
const TXCH = [[BS.afOut, BS.bm1Mod], [BS.rfOut, BS.bm1Car]]
const DEMOD = [[BS.bm1Out, BS.b455In], [BS.b455Out, BS.demSig], [BS.rfOut, BS.demCar], [BS.demOut, BS.apaIn]]
const CORDS = {
  'dsb-fc': [...TXCH, [BS.bm1Out, BS.paIn]], 'dsb-sc': [...TXCH, [BS.bm1Out, BS.paIn]], 'ssb-sc': [...TXCH, [BS.bm1Out, BS.b455In]],
  'ssb-demodulation': [...TXCH, ...DEMOD], 'fault-diagnosis': [...TXCH, ...DEMOD],
}
const SCOPE_AT = { 'dsb-fc': BS.bm1Out, 'dsb-sc': BS.bm1Out, 'ssb-sc': BS.b455Out, 'ssb-demodulation': BS.demOut }
/* fault test points, in chain order: AF gen, RF gen, balanced modulator, 455k BPF, demodulator, audio amplifier */
const TP = [BS.afOut, BS.rfOut, BS.bm1Out, BS.b455Out, BS.demOut, BS.spk]
const KNOBS = {
  'dsb-fc': { fm: BK.fm, Am: BK.Am, Ac: BK.Ac }, 'dsb-sc': { fm: BK.fm, Am: BK.Am, bal: BK.bal }, 'ssb-sc': { fm: BK.fm },
  'ssb-demodulation': { fm: BK.fm }, 'fault-diagnosis': {},
}
const NEED_RF = { 'dsb-fc': 1000, 'dsb-sc': 1000, 'ssb-sc': 455, 'ssb-demodulation': 455 }
const SIGNALS = {
  'dsb-fc': (v, o, t) => ({ f: (u) => (v.Ac * (1 + o.m * Math.cos(TAU * 2 * u + t)) * Math.cos(TAU * 44 * u)) / (v.Ac * 2.5), title: 'CH2 · DSB-FC output', bars: [[-0.65, (o.m * v.Ac) / 2, 'LSB'], [0, v.Ac, 'fc'], [0.65, (o.m * v.Ac) / 2, 'USB']] }),
  'dsb-sc': (v, o, t) => ({ f: (u) => (v.Am * Math.cos(TAU * 2 * u + t) + v.bal / 100) * Math.cos(TAU * 44 * u) * 0.9, title: 'CH2 · DSB-SC output', bars: [[-0.65, v.Am / 2, 'LSB'], [0, Math.max(0.002, v.bal / 100), 'fc'], [0.65, v.Am / 2, 'USB']] }),
  'ssb-sc': (v, o, t) => ({ f: (u) => (0.85 * (o.U * Math.cos(TAU * 44 * u + t) + o.L * Math.cos(TAU * 40 * u))) / (o.U + o.L), title: 'CH2 · 455 kHz BPF output', bars: [[-0.65, o.L, 'LSB'], [0.65, o.U, 'USB']] }),
  'ssb-demodulation': (v, o, t) => ({ f: (u) => 0.85 * Math.sin(TAU * (o.fo / 1000) * 3 * u + t * 2), g: (u) => 0.45 * Math.sin(TAU * (v.fm / 1000) * 3 * u + t * 2), title: 'Demodulator output (yellow: sent tone)' }),
  'fault-diagnosis': (v, o, t) => ({ f: (u) => (o.ok ? 0.82 * Math.sin(TAU * 8 * u + t * 4) * (0.7 + 0.3 * Math.cos(TAU * u * 2)) : 0.02 * Math.sin(u * 300)), title: 'Probe signal' }),
}
function drawScope(g, w, h, s) {
  g.fillStyle = '#071410'; g.fillRect(0, 0, w, h)
  const Hh = s?.bars ? h * 0.62 : h
  g.strokeStyle = '#123428'; g.lineWidth = 1.2; for (let i = 0; i <= 10; i++) { const x = (i * w) / 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke() } for (let i = 0; i <= 6; i++) { const y = (i * Hh) / 6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) { g.fillStyle = '#FFB0A0'; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.fillText('No signal: check power and cords', w / 2, h / 2); return }
  const line = (f, c) => { g.strokeStyle = c; g.lineWidth = 2.4; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= w; i++) { const y = Hh / 2 - clamp(f(i / w), -1.05, 1.05) * (Hh / 2) * 0.92; if (i) g.lineTo(i, y); else g.moveTo(i, y) } g.stroke() }
  line(s.f, '#62E6C2'); if (s.g) line(s.g, '#FFC14D')
  g.font = 'bold 19px Arial'; g.textAlign = 'left'; g.fillStyle = '#E8F2F8'; g.fillText(s.title, 12, 26)
  if (s.bars) {
    g.fillStyle = '#0B1A25'; g.fillRect(0, Hh, w, h - Hh); const base = h - 32, mx = Math.max(...s.bars.map((q) => q[1]), 1)
    g.strokeStyle = '#4A5A68'; g.beginPath(); g.moveTo(16, base); g.lineTo(w - 16, base); g.stroke()
    s.bars.forEach(([p, a, l]) => { const x = w / 2 + p * (w / 2 - 34), bh = (a / mx) * (h - Hh - 50); g.fillStyle = '#62C6F2'; g.fillRect(x - 6, base - bh, 12, Math.max(1, bh)); g.fillStyle = '#E8F2F8'; g.font = 'bold 18px Arial'; g.textAlign = 'center'; g.fillText(l, x, base + 22) })
  }
}

function drawBoard(g, W, H) {
  g.fillStyle = '#0F6337'; g.fillRect(0, 0, W, H)
  if (BOARD) g.drawImage(BOARD, 0, 0, W, H)
}

const vw = (x, y, d, sx = 0) => { const lx = ((x - B.x0) / B.W - 0.5) * B.pw, ly = (0.5 - (y - B.y0) / B.H) * B.ph, t = [lx + sx, CY + ly * Math.cos(A), -ly * Math.sin(A)]; return { p: [t[0], t[1] + N[1] * d, t[2] + N[2] * d], t } }
const VIEWS = { whole: vw(600, 430, 1.3), gen: vw(330, 430, 0.75, 0.06), mod: vw(800, 300, 0.75, 0.06), power: vw(1000, 110, 0.42) }

function build(host, api, exp) {
  const id = exp.id, ctl = (k) => exp.controls.find((q) => q.k === k)
  const K = kitScene(host, { background: 0xe3e6e9, exposure: 0.7, env: 0.45, floor: { base: '#C9B79C', tint: ['120,100,80', '235,225,210'], wall: 0xe3e6e9 }, views: VIEWS, zoom: [0.15, 2.6], azimuth: 1.1 })
  const { add, cyl, box, alongZ, plain, hit, V, M, stdM, scene, label } = K
  /* wooden case on a sloped stand */
  const shape = new THREE.Shape([[SL / 2, 0], [SL / 2, 0.006], [-SL / 2, HT + 0.006], [-SL / 2, 0]].map(([p, q]) => new THREE.Vector2(p, q)))
  const wg = new THREE.ExtrudeGeometry(shape, { depth: B.pw + 0.05, bevelEnabled: false }); wg.rotateY(-Math.PI / 2); wg.translate((B.pw + 0.05) / 2, 0, 0)
  const wedge = new THREE.Mesh(wg, stdM(0xc9a874, 0.6, 0)); wedge.castShadow = wedge.receiveShadow = true; scene.add(wedge)
  const U = K.unit({ x: 0, z: 0, y: CY, slope: A, art: drawBoard, x0: B.x0, y0: B.y0, W: B.W, H: B.H, pw: B.pw, artW: 2336 })
  const panel = U.panel, P = U.P
  add(box(B.pw + 0.04, B.ph + 0.04, 0.02), stdM(0xd8bd86, 0.55, 0), 0, 0, -0.0105, panel)
  /* red 2 mm sockets */
  Object.values(BS).forEach(([x, y]) => U.sock(x, y, 0xc7221e, null, 0.0102))
  /* ICs sit on the printed outlines */
  const icM = stdM(0x151619, 0.5, 0.1)
  const chip = (x, y, w, h, name) => { const [a, b] = P(x, y); add(box(w * U.K, h * U.K, 0.006), icM, a, b, 0.003, panel); label(w * U.K * 0.85, 0.009, name, 40, '#C9CDD2', a, b, 0.0062, panel); for (let i = 0; i < Math.round(w / 12); i++) [-1, 1].forEach((s) => add(box(0.0016, 0.004, 0.002), M.chrome, a - (w * U.K) / 2 + 0.005 + i * 12 * U.K, b + s * ((h * U.K) / 2 + 0.0015), 0.002, panel)) }
  ;[[90, 144, 52, '8038'], [230, 400, 80, 'XR2206'], [196, 670, 52, 'TL072'], [638, 114, 84, 'MC1496'], [638, 372, 84, 'MC1496'], [638, 628, 84, 'MC1496'], [1074, 248, 84, 'MC1496'], [1076, 326, 52, 'TL072'], [892, 800, 48, 'LM386']].forEach(([x, y, w, n]) => chip(x, y, w, 24, n))
  /* mic and speaker jacks */
  const jack = (x, y) => { const [a, b] = P(x, y); add(box(0.028, 0.026, 0.01), M.black, a, b, 0.005, panel); alongZ(add(cyl(0.0042, 0.0105, 14), stdM(0x3a3d43, 0.4, 0.4), a, b, 0.005, panel)) }
  jack(67, 653); jack(1130, 800)
  /* slide switches: MIC ON and the SSB summer A+B / A−B */
  const toggle = (x, y, name) => { const [a, b] = P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g); add(box(0.05, 0.018, 0.006), M.black, 0, 0, 0.003, g); const lev = add(box(0.014, 0.012, 0.007), stdM(0xe6e8ea, 0.4, 0.2), 0.012, 0, 0.007, g); if (name) hit(box(0.06, 0.03, 0.03), 0, 0, 0.01, name, g); return lev }
  const micLev = toggle(77, 696, 'mic'), abLev = toggle(1085, 428, 'ab')
  /* supply LEDs: click them to switch the trainer */
  const pwrLeds = [[948, 54, 0x2fd47a], [972, 54, 0xffd23f], [996, 54, 0xff3b30]].map(([x, y, c]) => { const [a, b] = P(x, y), m = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 12, 10), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.userData.on = c; m.position.set(a, b, 0.002); panel.add(m); return m })
  hit(box(0.075, 0.035, 0.03), ...P(972, 58), 0.012, 'pwr', panel)
  const blockLeds = Object.fromEntries(Object.entries(BLOCK_LED).map(([k2, [x, y]]) => { const [a, b] = P(x, y), m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), new THREE.MeshBasicMaterial({ color: 0x2b3a2f, toneMapped: false })); m.position.set(a, b, 0.0018); panel.add(m); return [k2, m] }))
  /* DIP switches on the printed red (SW1 carrier select) and blue (FAULT SW2) bodies */
  const lever = (x, y, w, h, sw) => { const [a, b] = P(x, y); add(box(w, h, 0.003), stdM(0xf4f4f2, 0.5, 0), a, b, 0.0035, panel); const m = add(box(w * 0.8, h * 0.4, 0.004), stdM(0x2b2b2b, 0.5, 0), a, b, 0.006, panel); m.userData.base = b; m.userData.sw = sw; return m }
  const rfSw = [61, 89, 117, 145].map((x) => lever(x, 396, 0.011, 0.028, 0.0085)); hit(box(0.105, 0.04, 0.03), ...P(103, 396), 0.012, 'rf', panel)
  const faults = Array.from({ length: 8 }, (_, i) => { const x = 1025 + i * 14, m = lever(x, 60, 0.0079, 0.0236, 0.0071); if (id === 'fault-diagnosis') hit(box(0.011, 0.026, 0.02), ...P(x, 60), 0.012, `dip:${i + 1}`, panel); return m })
  /* blue preset trimmers with a white cross */
  const ctlKnobs = KNOBS[id] || {}, kmeshes = {}
  const trimmer = (x, y, name) => { const [a, b] = P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g); add(box(0.024, 0.024, 0.009), stdM(0x2065c9, 0.38, 0.1), 0, 0, 0.0045, g); alongZ(add(cyl(0.0078, 0.003, 22), stdM(0xf4f4f2, 0.5, 0), 0, 0, 0.0105, g)); add(box(0.012, 0.0022, 0.0014), stdM(0x2065c9, 0.4, 0.1), 0, 0, 0.0125, g); add(box(0.0022, 0.012, 0.0014), stdM(0x2065c9, 0.4, 0.1), 0, 0, 0.0125, g); if (name) alongZ(hit(cyl(0.024, 0.04, 12), 0, 0, 0.012, name, g)); return g }
  Object.values(BK).forEach(([x, y]) => {
    const name = Object.entries(ctlKnobs).find(([, q]) => q[0] === x && q[1] === y)?.[0]
    const g = trimmer(x, y, name ? `k:${name}` : null); if (name) kmeshes[name] = g; else g.rotation.z = rad(25)
  })
  /* value tags printed under the trimmers */
  const tagF = () => face(320, 64, (g2, w, h, s) => { g2.clearRect(0, 0, w, h); g2.fillStyle = '#C7ECD3'; g2.font = 'bold 40px "Courier New", monospace'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(s, w / 2, h / 2) })
  const tags = Object.fromEntries([['fm', BK.fm], ['Am', BK.Am], ['Ac', BK.Ac], ['bal', BK.bal]].map(([k2, [x, y]]) => { const f = tagF(), [a, b] = P(x, y + 42); plain(add(new THREE.PlaneGeometry(0.075, 0.015), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), a, b, 0.0012, panel)); return [k2, f] }))
  /* patch cords */
  const palette = [0xf5a623, 0x22a899, 0x8e5bd0, 0xe8c53a, 0x1f62c4, 0xd42b24, 0x2e9e43]
  const local = (p, z) => V(...P(p[0], p[1]), z)
  const cords = (CORDS[id] || []).map(([a, b], i) => {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) * U.K, up = 0.012 + d * 0.09, A2 = local(a, 0.012), B2 = local(b, 0.012), mid = A2.clone().lerp(B2, 0.5); mid.z = up
    const curve = new THREE.CatmullRomCurve3([A2, local(a, up * 0.7), mid, local(b, up * 0.7), B2])
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.0028, 8), stdM(palette[i % palette.length], 0.5, 0)); m.castShadow = true; panel.add(m)
    ;[a, b].forEach((p) => { const q = local(p, 0.012); add(cyl(0.0042, 0.012, 12), stdM(palette[i % palette.length], 0.5, 0), q.x, q.y, q.z, panel).rotation.x = Math.PI / 2; if (id !== 'fault-diagnosis') hit(new THREE.SphereGeometry(0.016, 8, 6), q.x, q.y, q.z, 'c', panel) })
    return { m, curve }
  })
  const eM = new THREE.MeshBasicMaterial({ color: 0xfff1a6, toneMapped: false })
  const beads = cords.flatMap((c, i) => Array.from({ length: 3 }, (_, j) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), eM); m.userData = { c, u: j / 3 + i * 0.09 }; panel.add(m); return m }))
  /* telescopic antenna on the 1 MHz power amplifier */
  scene.updateMatrixWorld(true)
  const antenna = (x, y, lean, sockAt) => {
    const base = U.world(x, y, 0.012), g = new THREE.Group(); g.position.copy(base); scene.add(g)
    add(box(0.034, 0.024, 0.034), M.black, 0, 0.012, 0, g); add(new THREE.SphereGeometry(0.011, 18, 12), M.chrome, 0, 0.03, 0, g)
    const rod = new THREE.Group(); rod.position.y = 0.033; rod.rotation.z = lean; rod.rotation.x = -0.1; g.add(rod)
    const radii = [0.0058, 0.0049, 0.0041, 0.0034, 0.0028, 0.0023, 0.0019]
    radii.forEach((r, i) => { add(cyl(r, 0.085, 16), M.chrome, 0, 0.042 + i * 0.075, 0, rod); add(cyl(r + 0.0008, 0.005, 16), M.steel, 0, 0.083 + i * 0.075, 0, rod) })
    add(new THREE.SphereGeometry(0.0048, 14, 10), M.chrome, 0, 0.042 + radii.length * 0.075, 0, rod)
    const s = U.world(...sockAt, 0.012)
    K.tube([V(base.x, base.y + 0.008, base.z), V(base.x, base.y - 0.012, base.z + 0.05), V((base.x + s.x) / 2, Math.max(base.y, s.y) + 0.025, (base.z + s.z) / 2 + 0.05), s], 0x101114, 0.0025)
    scene.updateMatrixWorld(true)
    return rod.localToWorld(V(0, 0.36, 0))
  }
  const txTop = antenna(895, 536, -0.38, BS.paOut)
  const waves = Array.from({ length: 6 }, () => { const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 6, 40), new THREE.MeshBasicMaterial({ color: 0x2f8cff, transparent: true, opacity: 0, depthWrite: false })); w.rotation.x = Math.PI / 2; scene.add(w); return w })
  /* CH1 / CH2 probe tags */
  const probe = (txt, col) => { const g = new THREE.Group(); panel.add(g); add(box(0.03, 0.015, 0.004), stdM(col, 0.45, 0), 0, 0.024, 0.008, g); const f = face(136, 72, silk(txt, 46, '#17181C')); f.set(1); plain(add(new THREE.PlaneGeometry(0.026, 0.013), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), 0, 0.024, 0.0104, g)); return g }
  const ch1 = probe('CH1', 0xf0c419), ch2 = probe('CH2', 0x56d1f0)
  { const [a, b] = P(BS.afOut[0] - 18, BS.afOut[1] - 25); ch1.position.set(a, b - 0.024, 0) }
  if (id === 'fault-diagnosis') TP.forEach(([x, y], i) => hit(new THREE.SphereGeometry(0.017, 8, 6), ...P(x, y), 0.016, `tp:${i + 1}`, panel))

  const Q = { v: null, mic: true, ab: true }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'c') { api.set('c', !v.c); return }
      if (d === 'pwr') { api.set('pwr', !v.pwr); return }
      if (d === 'mic') { Q.mic = !Q.mic; update.redo(); return }
      if (d === 'ab') { Q.ab = !Q.ab; update.redo(); return }
      if (d === 'rf') { const seq = [100, 200, 455, 1000]; api.set('rf', seq[(seq.indexOf(v.rf) + 1) % 4]); return }
      if (d.startsWith('tp:')) { api.set('tp', +d.slice(3)); return }
      if (d.startsWith('dip:')) { const n = +d.slice(4); api.set('f', v.f === n ? 0 : n); return }
      if (d.startsWith('k:')) { const key = d.slice(2); return { key, val: v[key] } }
    },
    drag: (s, e, mv) => { const q = ctl(s.key); api.set(s.key, quant(q, s.val + (mv / 240) * (q.max - q.min))) },
    cursor: (d) => (d.startsWith('k:') ? 'grab' : 'pointer'),
  })
  const fmt = { fm: (x) => `${(x / 1000).toFixed(2)} kHz`, Am: (x) => `${(x * 2).toFixed(2)} Vpp`, Ac: (x) => `${(x * 500).toFixed(0)} mVpp`, bal: (x) => (x / 100).toFixed(2) }
  const dflt = { fm: '1.00 kHz', Am: '2.00 Vpp', Ac: '500 mVpp', bal: '0.00' }
  const update = K.loop((v, o, t, tc) => {
    Q.v = v
    Object.entries(kmeshes).forEach(([k2, g]) => { const q = ctl(k2); g.rotation.z = rad(135 - clamp((v[k2] - q.min) / (q.max - q.min), 0, 1) * 270) })
    Object.entries(tags).forEach(([k2, f]) => { const val = v[k2] !== undefined && ctl(k2) ? fmt[k2](v[k2]) : dflt[k2]; f.set(val, val) })
    const rfIdx = [100, 200, 455, 1000].indexOf(v.rf); rfSw.forEach((m, i) => { m.position.y = m.userData.base + m.userData.sw * (i === rfIdx ? 1 : -1) })
    faults.forEach((m, i) => { m.position.y = m.userData.base + m.userData.sw * (id === 'fault-diagnosis' && v.f === i + 1 ? 1 : -1) })
    micLev.position.x = Q.mic ? 0.012 : -0.012; abLev.position.x = Q.ab ? -0.012 : 0.012
    pwrLeds.forEach((m) => m.material.color.set(v.pwr ? m.userData.on : 0x1c2a1c))
    const act = new Set(ACTIVE[id] || [])
    Object.entries(blockLeds).forEach(([k2, m]) => m.material.color.set(v.pwr && act.has(k2) ? 0x4bff78 : 0x2b3a2f))
    cords.forEach((c) => { c.m.visible = v.c })
    const live = v.pwr && v.c
    beads.forEach((m) => { m.visible = live; if (live) m.userData.c.curve.getPoint((m.userData.u + t * 0.5) % 1, m.position) })
    waves.forEach((w, i) => { const u = (t * 0.35 + i / 6) % 1; w.visible = live; w.position.copy(txTop); w.position.y -= 0.1; const r = 0.03 + u * 0.22; w.scale.set(r, r, r * 0.6); w.material.opacity = (1 - u) * 0.3 })
    const at = id === 'fault-diagnosis' ? TP[v.tp - 1] : SCOPE_AT[id]
    ch2.visible = !!at; if (at) { const [a, b] = P(...at); ch2.position.set(a, b - 0.004, 0) }
    if (tc) drawScope(tc.getContext('2d'), tc.width, tc.height, live ? SIGNALS[id](v, o, t) : null)
  })
  return K.finish(update)
}

const HINTS = {
  'dsb-fc': 'Turn the AF FREQUENCY and AMPLITUDE trimmers for the audio and the RF AMPLITUDE trimmer for the carrier.',
  'dsb-sc': 'Turn the AF trimmers for the audio, and CARRIER NULL on Balanced Modulator 1 to leak carrier through.',
  'ssb-sc': 'Set SW1 to 455k, turn the AF FREQUENCY trimmer and watch the 455 kHz band-pass filter keep one sideband.',
  'ssb-demodulation': 'The 455 kHz BPF output feeds the balanced demodulator with the RF carrier. Set a carrier offset in the controls and watch the recovered tone shift. SW1 must be at 455k.',
  'fault-diagnosis': 'Click a switch on FAULT SW2 (F1–F8), then click the stage outputs to move the CH2 probe along the chain.',
}
const LABELS = [['whole', 'Whole board'], ['gen', 'Generators'], ['mod', 'Modulators'], ['power', 'Power and faults']]

export const am3D = amKit.map((e) => {
  const need = NEED_RF[e.id]
  return {
    ...e,
    wide: true,
    state: () => ({ pwr: true, c: true, rf: need || 1000 }),
    read: (v, o) => (v.pwr && v.c ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: (v, o) => {
      if (!v.pwr) return { error: 'The trainer is off. Click the supply LEDs to switch it on.' }
      if (!v.c) return { error: 'The patch cords are out. Click a socket to plug them in.' }
      if (need && v.rf !== need) return { error: `Set SW1 on the RF signal generator to ${need === 455 ? '455k' : '1M'}.` }
      return e.sample(v, o)
    },
    Stage: stage3D(e, (host, api) => build(host, api, e), { labels: LABELS, hint: `${HINTS[e.id]} Click SW1 to choose the carrier, a patch cord plug to pull the cords, and the supply LEDs to switch the trainer. Drag the background to look around.`, overlay: { w: 520, h: 360, alt: 'Oscilloscope trace', caption: 'Oscilloscope at the CH2 probe', cls: 'low small' } }),
  }
})
