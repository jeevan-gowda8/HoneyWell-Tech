import { opAmp, wave, VSAT } from './electrical'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU } from './kit3d'

/* The operational amplifier trainer, modelled on the photo of the real kit: a black panel in a
   black case with the ±5 V, ±12 V and variable supplies, three resistor banks, diodes and
   capacitors, two µA741 sockets, a breadboard, the function generator and eight pots.
   Panel coordinates are pixels of the photo turned to landscape (1060 × 760). Metres in 3D. */

const B = { W: 1060, H: 760, pw: 0.9, tilt: 0.2 }
B.ph = (B.pw * B.H) / B.W
const SLOPE = Math.PI / 2 - B.tilt, CY = (B.ph / 2) * Math.sin(B.tilt) + 0.078
const BANK = { 1: 65, 10: 275, 100: 485 }
const colX = (val, c) => BANK[val] + 24 + 36 * c
const CAPX = { 1: 893, 10: 925, 100: 990 }
const RT = 505, RB = 588
const P2 = [305, 335], P3 = [305, 405], P4 = [425, 445], P7 = [425, 290], P6 = [495, 360]
const GND = [125, 258], V1 = [105, 372], V2 = [225, 372]
const OUT = { sine: [855, 100], square: [915, 100], tri: [975, 100] }
const rs = (c, val) => [[colX(val, c), RT], [colX(val, c), RB]]
const O = 0xf5a623, G = 0x22a899, Y = 0xe8c53a, KK = 0x17181c, VI = 0x8e5bd0

function cordsFor(id, v) {
  const GEN = OUT[v.w] || OUT.sine
  const list = []
  if (v.rp) list.push([[125, 225], P7, 0xd42b24])
  if (v.rn) list.push([[125, 290], P4, 0x1f62c4])
  const ri = rs(0, v.Ri ?? v.R ?? 10), rf = rs(1, v.Rf ?? 10), r1 = rs(0, v.R ?? 10), r2 = rs(2, v.R ?? 10), r3 = rs(3, v.Rf ?? 10), c0 = [CAPX[v.C ?? 10], RT], c1 = [CAPX[v.C ?? 10], RB]
  const fb = [[P2, rf[0], Y], [rf[1], P6, Y]]
  const map = {
    'voltage-follower': [[GEN, P3, O], [P6, P2, G]],
    inverting: [[GEN, ri[0], O], [ri[1], P2, G], ...fb, [P3, GND, KK]],
    'non-inverting': [[GEN, P3, O], [GND, ri[0], KK], [ri[1], P2, G], ...fb],
    adder: [[V1, r1[0], O], [V2, r2[0], VI], [r1[1], P2, G], [r2[1], P2, G], ...fb, [P3, GND, KK]],
    subtractor: [[V1, r1[0], O], [r1[1], P2, G], [V2, r2[0], VI], [r2[1], P3, G], ...fb, [P3, r3[0], KK], [r3[1], GND, KK]],
    integrator: [[GEN, r1[0], O], [r1[1], P2, G], [P2, c0, Y], [c1, P6, Y], [P3, GND, KK]],
    differentiator: [[GEN, c0, O], [c1, P2, G], [P2, r1[0], Y], [r1[1], P6, Y], [P3, GND, KK]],
    comparator: [[GEN, P3, O], [V2, P2, VI]],
  }
  return [...list, ...map[id]]
}
const PLUGS = { inverting: ['Ri', 'Rf'], 'non-inverting': ['Ri', 'Rf'], adder: ['R', 'Rf'], subtractor: ['R', 'Rf'], integrator: ['R', 'C'], differentiator: ['R', 'C'] }

function signals(id, v, o) {
  if (id === 'adder') return { vin: () => v.v1 + v.v2, vout: () => o.vo, range: 12.5, inp: 'V₁ + V₂' }
  if (id === 'subtractor') return { vin: () => v.v2 - v.v1, vout: () => o.vo, range: 12.5, inp: 'V₂ − V₁' }
  if (id === 'comparator') return { vin: (u) => (v.vp / 2) * Math.sin(TAU * 3 * u), vout: (u) => ((v.vp / 2) * Math.sin(TAU * 3 * u) > v.vr ? VSAT : -VSAT), range: 12.5, inp: 'Input', ac: true }
  if (id === 'integrator' || id === 'differentiator') return { vin: (u) => (v.vp / 2) * wave(v.w, u * 3), vout: (u) => o.arr[Math.floor(((((u * 3) % 1) + 1) % 1) * 359.99)], range: Math.max(5.5, Math.max(...o.arr.map(Math.abs)) * 1.15), inp: 'Input', ac: true }
  const range = Math.max(0.6, Math.max(o.vp, o.vo) / 2) * 1.25
  return { vin: (u) => (o.vp / 2) * wave(v.w, u * 3), vout: (u) => clamp(((o.G * o.vp) / 2) * wave(v.w, u * 3), -VSAT, VSAT), range, inp: 'Input', ac: true }
}
function drawScope(g, w, h, s, t) {
  g.fillStyle = '#071410'; g.fillRect(0, 0, w, h)
  for (let i = 0; i <= 10; i++) { g.strokeStyle = i === 5 ? '#245240' : '#123428'; g.lineWidth = 1.2; const x = (i * w) / 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let i = 0; i <= 6; i++) { g.strokeStyle = i === 3 ? '#245240' : '#123428'; g.lineWidth = 1.2; const y = (i * h) / 6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) { g.fillStyle = '#FFB0A0'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('No supply to the op-amp', w / 2, h / 2 + 8); return }
  const sh = s.ac ? t * 0.14 : 0
  const line = (f, col) => { g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= w; i += 2) { const y = h / 2 - (clamp(f(i / w + sh) / s.range, -1.05, 1.05) * h) / 2.2; if (i) g.lineTo(i, y); else g.moveTo(i, y) } g.stroke() }
  line(s.vin, '#FFC14D'); line(s.vout, '#62E6C2')
  g.font = 'bold 20px Arial'; g.textAlign = 'left'
  g.fillStyle = '#FFC14D'; g.fillRect(12, 16, 22, 4); g.fillText(s.inp, 42, 26); g.fillStyle = '#62E6C2'; g.fillRect(150, 16, 22, 4); g.fillText('Output', 180, 26)
}

/* the black front panel, drawn in photo coordinates */
function drawPanel(g, W, H) {
  const k = W / B.W, X = (x) => x * k, Yp = (y) => y * k, INK = '#ECEDEE'
  const t = (s, x, y, z = 11, al = 'center', c = INK) => { g.fillStyle = c; g.font = `bold ${z * k}px Arial`; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, X(x), Yp(y)) }
  const line = (pts, lw = 1.7, c = INK) => { g.strokeStyle = c; g.lineWidth = lw * k; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(X(a), Yp(b)) : g.moveTo(X(a), Yp(b)))); g.stroke() }
  const box = (x, y, w, h) => { g.strokeStyle = INK; g.lineWidth = 2.2 * k; g.beginPath(); g.roundRect(X(x), Yp(y), w * k, h * k, 6 * k); g.stroke() }
  const ring = (x, y) => { g.strokeStyle = '#C9CCD1'; g.lineWidth = 2 * k; g.beginPath(); g.arc(X(x), Yp(y), 6.5 * k, 0, 7); g.stroke() }
  const zigV = (x, y1, y2) => { const m = (y1 + y2) / 2, pts = [[x, y1], [x, m - 18]]; for (let i = 0; i < 6; i++) pts.push([x + (i % 2 ? -6 : 6), m - 15 + i * 6]); pts.push([x, m + 18], [x, y2]); line(pts) }
  const zigH = (x1, x2, y) => { const m = (x1 + x2) / 2, pts = [[x1, y], [m - 18, y]]; for (let i = 0; i < 6; i++) pts.push([m - 15 + i * 6, y + (i % 2 ? -6 : 6)]); pts.push([m + 18, y], [x2, y]); line(pts) }
  g.fillStyle = '#111215'; g.fillRect(0, 0, W, H)
  const sheen = g.createLinearGradient(0, 0, W, H); sheen.addColorStop(0, 'rgba(255,255,255,.05)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.03)'); g.fillStyle = sheen; g.fillRect(0, 0, W, H)
  t('OPERATIONAL AMPLIFIER TRAINER KIT', 530, 34, 26)
  g.strokeStyle = INK; g.lineWidth = 2 * k; g.strokeRect(X(860), Yp(18), 110 * k, 32 * k); t('HONEYWELL', 915, 34, 12)
  /* supplies */
  box(62, 66, 186, 128); t('DC POWER SUPPLY', 155, 80, 11); t('FIXED POWER SUPPLY', 155, 182, 8.5)
  ;[['+5V', 105], ['0V', 135], ['−5V', 165]].forEach(([s, y]) => { t(s, 236, y, 10, 'right'); [125, 170].forEach((x) => ring(x, y)) })
  box(62, 200, 186, 112); t('FIXED POWER SUPPLY', 155, 300, 8.5)
  ;[['+12V', 225], ['0V', 258], ['−12V', 290]].forEach(([s, y]) => { t(s, 238, y, 10, 'right'); [125, 170].forEach((x) => ring(x, y)) })
  box(62, 318, 186, 150); t('VARIABLE POWER SUPPLY', 155, 457, 8.5)
  t('+1.2V~+10V', 105, 342, 8); t('0V', 165, 342, 8); t('−1.2V~−10V', 225, 342, 8); [105, 165, 225].forEach((x) => { ring(x, 372); ring(x, 400) })
  /* resistor, diode and capacitor banks */
  ;[[1, 'RESISTOR 1KΩ'], [10, 'RESISTOR 10KΩ'], [100, 'RESISTOR 100KΩ']].forEach(([val, s]) => { const x0 = BANK[val]; box(x0, 474, 196, 130); t(s, x0 + 98, 487, 10); for (let c = 0; c < 5; c++) { const x = colX(val, c); zigV(x, RT + 7, RB - 7); ring(x, RT); ring(x, RB) } })
  box(695, 474, 160, 130); t('DIODE 1N4007', 775, 487, 10)
  ;[715, 750, 785, 820].forEach((x) => { line([[x, RT + 7], [x, RB - 7]]); g.fillStyle = INK; g.beginPath(); g.moveTo(X(x - 9), Yp(538)); g.lineTo(X(x + 9), Yp(538)); g.lineTo(X(x), Yp(552)); g.closePath(); g.fill(); line([[x - 9, 554], [x + 9, 554]], 2.2); ring(x, RT); ring(x, RB) })
  box(870, 474, 150, 130); ;[[893, '1nF'], [925, '10nF'], [957, '1uF'], [990, '100nF']].forEach(([x, s]) => { line([[x, RT + 7], [x, 541]]); line([[x - 10, 541], [x + 10, 541]], 2.4); line([[x - 10, 549], [x + 10, 549]], 2.4); line([[x, 549], [x, RB - 7]]); ring(x, RT); ring(x, RB); t(s, x, 598, 8) })
  /* pots */
  ;[[62, '1KΩ'], [317, '10KΩ'], [560, '100KΩ'], [780, '1MΩ']].forEach(([x0, s]) => { box(x0, 612, 228, 136); t(s, x0 + 114, 625, 10);[x0 + 60, x0 + 170].forEach((kx) => { zigH(kx - 42, kx + 42, 700); line([[kx, 690], [kx, 680]]); g.fillStyle = INK; g.beginPath(); g.moveTo(X(kx - 5), Yp(688)); g.lineTo(X(kx + 5), Yp(688)); g.lineTo(X(kx), Yp(695)); g.closePath(); g.fill(); [kx - 42, kx, kx + 42].forEach((sx) => ring(sx, 730)) }) })
  /* op-amp sockets */
  ;[0, 270].forEach((dx) => {
    box(258 + dx, 270, 262, 198)
    line([[345 + dx, 300], [345 + dx, 440], [470 + dx, 370], [345 + dx, 300]], 2.4)
    t('2', 335 + dx, 335, 10); t('3', 335 + dx, 405, 10); t('−', 357 + dx, 335, 14); t('+', 357 + dx, 405, 13); t('4', 438 + dx, 432, 10); t('7', 438 + dx, 304, 10); t('6', 482 + dx, 378, 10)
    t('−V', 425 + dx, 458, 9); t('+V', 425 + dx, 279, 9)
    line([[305 + dx, 290], [305 + dx, 335], [345 + dx, 335]]); line([[305 + dx, 445], [305 + dx, 405], [345 + dx, 405]]); line([[425 + dx, 290], [425 + dx, 323]]); line([[425 + dx, 445], [425 + dx, 417]]); line([[470 + dx, 370], [495 + dx, 370], [495 + dx, 360]]); line([[495 + dx, 370], [495 + dx, 400]])
    ;[[305, 290], [305, 335], [305, 405], [305, 445], [425, 290], [425, 445], [495, 360], [495, 400]].forEach(([x, y]) => ring(x + dx, y))
  })
  /* breadboard */
  g.fillStyle = '#F2F1EC'; g.beginPath(); g.roundRect(X(268), Yp(70), 534 * k, 190 * k, 5 * k); g.fill()
  g.fillStyle = '#E2E0D6'; g.fillRect(X(270), Yp(160), 530 * k, 10 * k)
  ;[[78, '#D42B24'], [86, '#1F62C4'], [244, '#D42B24'], [252, '#1F62C4']].forEach(([y, c]) => line([[275, y], [795, y]], 1.2, c))
  g.fillStyle = '#5A5D63'; for (let x = 280; x < 794; x += 7.5) { [81, 89, 241, 249].forEach((y) => g.fillRect(X(x), Yp(y - 1.5), 3 * k, 3 * k)); for (let y = 98; y < 158; y += 9) g.fillRect(X(x), Yp(y), 3 * k, 3 * k); for (let y = 175; y < 236; y += 9) g.fillRect(X(x), Yp(y), 3 * k, 3 * k) }
  /* function generator */
  box(828, 64, 194, 404); t('FUNCTION GENERATOR', 925, 78, 11); t('OUTPUT', 915, 92, 9)
  ;[[855, 'sine'], [915, 'square'], [975, 'tri']].forEach(([x, w]) => { ring(x, 100); const y0 = 125; g.strokeStyle = INK; g.lineWidth = 1.8 * k; g.beginPath(); if (w === 'sine') for (let i = 0; i <= 20; i++) { const a = x - 12 + (24 * i) / 20, b = y0 - Math.sin((TAU * i) / 20) * 6; if (i) g.lineTo(X(a), Yp(b)); else g.moveTo(X(a), Yp(b)) } if (w === 'square') { g.moveTo(X(x - 12), Yp(y0 + 6)); g.lineTo(X(x - 12), Yp(y0 - 6)); g.lineTo(X(x), Yp(y0 - 6)); g.lineTo(X(x), Yp(y0 + 6)); g.lineTo(X(x + 12), Yp(y0 + 6)); g.lineTo(X(x + 12), Yp(y0 - 6)) } if (w === 'tri') { g.moveTo(X(x - 12), Yp(y0 + 6)); g.lineTo(X(x), Yp(y0 - 6)); g.lineTo(X(x + 12), Yp(y0 + 6)) } g.stroke() })
  t('10', 858, 222, 10); t('AMPLITUDE', 930, 222, 9); t('FREQUENCY SET', 930, 318, 9); t('RANGE', 935, 448, 9); t('100Hz', 893, 372, 8); t('1KHz', 935, 357, 8); t('10KHz', 978, 372, 8)
  ;[[18, 18], [1042, 18], [18, 742], [1042, 742]].forEach(([x, y]) => { g.fillStyle = '#3B3E44'; g.beginPath(); g.arc(X(x), Yp(y), 7 * k, 0, 7); g.fill() })
}

const N = [0, Math.cos(B.tilt), Math.sin(B.tilt)]
const vw = (px, py, d) => { const lx = (px / B.W - 0.5) * B.pw, ly = (0.5 - py / B.H) * B.ph, t = [lx, CY + ly * Math.sin(B.tilt), -ly * Math.cos(B.tilt)]; return { p: [t[0], t[1] + N[1] * d, t[2] + N[2] * d + d * 0.55], t } }
const VIEWS = { whole: vw(530, 400, 1.05), supply: vw(155, 270, 0.52), gen: vw(925, 260, 0.5), ic: vw(530, 370, 0.5), bank: vw(530, 600, 0.6) }

function build(host, api, exp) {
  const id = exp.id, ctl = (k) => exp.controls.find((q) => q.k === k)
  const K = kitScene(host, { background: 0xeceef1, floor: { base: '#C9B79C', tint: ['120,100,80', '235,225,210'], wall: 0xeceef1 }, views: VIEWS, zoom: [0.2, 2.6] })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, M, stdM, scene } = K
  const U = K.unit({ x: 0, z: 0, y: CY, slope: SLOPE, art: drawPanel, x0: 0, y0: 0, W: B.W, H: B.H, pw: B.pw, artW: 2800 })
  const panel = U.panel, P = U.P
  /* black case under the panel */
  const caseM = stdM(0x1c1d21, 0.55, 0.2)
  add(box(B.pw + 0.05, B.ph + 0.05, 0.07), caseM, 0, 0, -0.036, panel)
  add(box(B.pw + 0.06, 0.012, 0.075), stdM(0x2a2c31, 0.5, 0.2), 0, -(B.ph / 2 + 0.03), -0.034, panel)
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => add(cyl(0.012, 0.012, 16), M.black, sx * (B.pw / 2 - 0.03), sy * (B.ph / 2 - 0.03), -0.076, panel).rotation.x = Math.PI / 2)
  /* sockets */
  const sockG = cyl(0.0068, 0.004, 18), coreG = cyl(0.0042, 0.0055, 14), coreM = {}
  const sock = (x, y, c = 0x26272b) => { const [a, b] = P(x, y); alongZ(add(sockG, M.chrome, a, b, 0.002, panel)); coreM[c] ||= stdM(c, 0.4); alongZ(add(coreG, coreM[c], a, b, 0.0035, panel)) }
  ;[105, 135, 165].forEach((y) => [125, 170].forEach((x) => sock(x, y, y === 105 ? 0xd42b24 : y === 165 ? 0x1f62c4 : 0x26272b)))
  ;[225, 258, 290].forEach((y) => [125, 170].forEach((x) => sock(x, y, y === 225 ? 0xd42b24 : y === 290 ? 0x1f62c4 : 0x26272b)))
  ;[105, 165, 225].forEach((x) => [372, 400].forEach((y) => sock(x, y)))
  ;[1, 10, 100].forEach((val) => { for (let c = 0; c < 5; c++) { sock(colX(val, c), RT); sock(colX(val, c), RB) } })
  ;[715, 750, 785, 820, 893, 925, 957, 990].forEach((x) => { sock(x, RT); sock(x, RB) })
  ;[[62, 0], [317, 0], [560, 0], [780, 0]].forEach(([x0]) => [x0 + 60, x0 + 170].forEach((kx) => [kx - 42, kx, kx + 42].forEach((sx) => sock(sx, 730))))
  ;[0, 270].forEach((dx) => [[305, 290], [305, 335], [305, 405], [305, 445], [425, 290], [425, 445], [495, 360], [495, 400]].forEach(([x, y]) => sock(x + dx, y)))
  Object.values(OUT).forEach(([x, y]) => sock(x, y, 0xe5b52e))
  /* LEDs on the ±5 V supply */
  const led = (x, y, c) => { const [a, b] = P(x, y), m = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 10), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.position.set(a, b, 0.002); panel.add(m); return m }
  const ledR = led(90, 120, 0xff3b30), ledG = led(90, 152, 0x2fd47a)
  hit(new THREE.SphereGeometry(0.02, 8, 6), ...P(90, 136), 0.01, 'on', panel)
  /* grey ridged knobs, as on the real kit */
  const knobM = stdM(0xc9ccd2, 0.5, 0.15), knobs = {}
  const knob = (x, y, name, r = 0.0155) => {
    const [a, b] = P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g)
    const body = new THREE.CylinderGeometry(r * 0.86, r, 0.017, 24); alongZ(add(body, knobM, 0, 0, 0.0085, g))
    for (let i = 0; i < 18; i++) { const an = (i / 18) * TAU; add(box(0.0016, 0.0016, 0.015), stdM(0xb3b7be, 0.55, 0.1), Math.cos(an) * r * 0.95, Math.sin(an) * r * 0.95, 0.008, g) }
    add(box(0.0018, r * 0.6, 0.0012), new THREE.MeshBasicMaterial({ color: 0x1b1d22 }), 0, r * 0.45, 0.0172, g)
    if (name) { alongZ(hit(cyl(r * 1.7, 0.04, 12), 0, 0, 0.012, name, g)); knobs[name] = g }
    return g
  }
  knob(100, 432, 'v1'); knob(205, 432, 'v2')
  knob(858, 190, null).rotation.z = rad(40); knob(930, 190, 'ampl'); knob(930, 275, 'freq'); knob(935, 405, 'range')
  ;[62, 317, 560, 780].forEach((x0) => [x0 + 60, x0 + 170].forEach((kx) => { knob(kx, 652, null, 0.0145).rotation.z = rad(60) }))
  /* the two µA741 chips in their sockets */
  ;[0, 270].forEach((dx) => {
    const [a, b] = P(410 + dx, 370), w = 0.022, h = 0.03
    add(box(w + 0.006, h + 0.004, 0.003), stdM(0x2a2c31, 0.5, 0.2), a, b, 0.0015, panel)
    add(box(w, h, 0.006), stdM(0x121316, 0.5, 0.1), a, b, 0.006, panel)
    add(new THREE.CircleGeometry(0.0022, 12), new THREE.MeshBasicMaterial({ color: 0x3a3e45 }), a - w / 2 + 0.004, b + h / 2 - 0.004, 0.0092, panel)
    for (let i = 0; i < 4; i++) [-1, 1].forEach((s) => add(box(0.004, 0.0018, 0.002), M.chrome, a + s * (w / 2 + 0.002), b - h / 2 + 0.005 + i * 0.0068, 0.004, panel))
  })
  /* a few parts on the breadboard */
  const [ba, bb] = P(560, 165); add(box(0.022, 0.012, 0.005), stdM(0x121316, 0.5, 0.1), ba, bb, 0.0025, panel)
  ;[[420, 120, 470, 120, 0x2e8b4c], [640, 205, 700, 205, 0xc42a26]].forEach(([x1, y1, x2, y2, c]) => { const [a, b] = P(x1, y1), [e, f] = P(x2, y2); add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(a, b, 0), V((a + e) / 2, (b + f) / 2, 0.012), V(e, f, 0)]), 20, 0.0014, 6), stdM(c, 0.5, 0), 0, 0, 0, panel) })

  /* patch cords */
  const cordG = new THREE.Group(); panel.add(cordG)
  const cordM = {}, plugG = cyl(0.0044, 0.011, 14)
  const matOf = (c) => (cordM[c] ||= stdM(c, 0.5, 0))
  const LOCAL = (x, y, z) => { const [a, b] = P(x, y); return V(a, b, z) }
  const buildCords = (v) => {
    cordG.children.slice().forEach((m) => { if (m.geometry !== plugG) m.geometry.dispose(); cordG.remove(m) })
    cordsFor(id, v).forEach(([a, b, c]) => {
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]) * U.K, up = 0.012 + dist * 0.12, A2 = LOCAL(...a, 0.01), B2 = LOCAL(...b, 0.01)
      const mid = A2.clone().lerp(B2, 0.5); mid.z = up; mid.y -= dist * 0.05
      const curve = new THREE.CatmullRomCurve3([A2, LOCAL(...a, up * 0.7), mid, LOCAL(...b, up * 0.7), B2])
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.0026, 8), matOf(c)); m.castShadow = true; cordG.add(m)
      ;[a, b].forEach((p) => { const q = new THREE.Mesh(plugG, matOf(c)); q.position.copy(LOCAL(...p, 0.01)); q.rotation.x = Math.PI / 2; cordG.add(q) })
    })
  }
  /* movable plugs and their drop zones */
  const plugPos = (k, v) => (k === 'C' ? [CAPX[v.C], RT] : [colX(v[k], k === 'Rf' ? 1 : 0), RT])
  const plugs = (PLUGS[id] || []).map((k) => { const g = new THREE.Group(); panel.add(g); add(new THREE.TorusGeometry(0.0095, 0.0018, 8, 22), new THREE.MeshBasicMaterial({ color: k === 'Rf' || k === 'C' ? 0xffd45e : 0x65e0ff }), 0, 0, 0.016, g); hit(new THREE.SphereGeometry(0.016, 10, 8), 0, 0, 0.016, `plug:${k}`, g); return { k, g } })
  const drops = new Set()
  if (PLUGS[id]) {
    ;[1, 10, 100].forEach((val) => { const [a, b] = P(BANK[val] + 98, 546); hit(box(196 * U.K, 110 * U.K, 0.02), a, b, 0.01, `row:${val}`, panel); drops.add(`row:${val}`) })
    if (PLUGS[id].includes('C')) [1, 10, 100].forEach((val) => { const [a, b] = P(CAPX[val], 546); hit(box(28 * U.K, 110 * U.K, 0.02), a, b, 0.01, `cap:${val}`, panel); drops.add(`cap:${val}`) })
  }
  ;[[[125, 225], 'rp'], [[125, 290], 'rn'], [P7, 'rp'], [P4, 'rn']].forEach(([p, k]) => hit(new THREE.SphereGeometry(0.013, 10, 8), ...P(...p), 0.01, `rail:${k}`, panel))
  if (ctl('w')) Object.entries(OUT).forEach(([w, p]) => { if (ctl('w').options.some((o) => o[0] === w)) hit(new THREE.SphereGeometry(0.014, 10, 8), ...P(...p), 0.011, `w:${w}`, panel) })
  const preview = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0x4fc3ff })); preview.visible = false; panel.add(preview)
  scene.updateMatrixWorld(true)
  const facing = new THREE.Plane().setFromNormalAndCoplanarPoint(V(0, Math.cos(B.tilt), Math.sin(B.tilt)), U.world(530, 380, 0.016))

  const Q = { v: null, range: 1, l1: 3, l2: -3, lf: 1, la: 2 }
  K.listen({
    ignore: (d) => drops.has(d),
    grab: (d) => {
      const v = Q.v
      if (d === 'on') { api.set('on', !v.on); return }
      if (d.startsWith('rail:')) { const k = d.slice(5); api.set(k, !v[k]); return }
      if (d.startsWith('w:')) { api.set('w', d.slice(2)); return }
      if (d === 'range') { Q.range = (Q.range + 1) % 3; if (ctl('f')) api.set('f', Q.range === 2 ? Math.max(10, v.f) : Math.min(10, v.f)); update.redo(); return }
      if (d.startsWith('plug:')) { const k = d.slice(5); preview.visible = true; return { plug: k, from: LOCAL(...plugPos(k, v), 0.016) } }
      const key = d === 'v1' ? (ctl('v1') ? 'v1' : null) : d === 'v2' ? (ctl('v2') ? 'v2' : ctl('vr') ? 'vr' : null) : d === 'freq' ? (ctl('f') ? 'f' : null) : d === 'ampl' ? (ctl('vp') ? 'vp' : null) : null
      return { key, val: key ? v[key] : d === 'v1' ? Q.l1 : d === 'v2' ? Q.l2 : d === 'freq' ? Q.lf : Q.la }
    },
    drag: (s, e, mv) => {
      if (s.plug) { const p = K.castTo(e, facing); if (p) { const q = panel.worldToLocal(p.clone()); q.z = 0.016; preview.geometry.setFromPoints([s.from, q]); K.draw() } return }
      if (s.key) {
        const q = ctl(s.key), fk = s.key === 'f'
        const lo = fk ? (Q.range === 2 ? 10 : 1) : q.min, hi = fk ? (Q.range === 2 ? 100 : 10) : q.max
        api.set(s.key, clamp(quant(q, s.val + (mv / 240) * (hi - lo)), lo, hi))
      } else {
        if (s.d === 'v1') Q.l1 = +clamp(s.val + (mv / 240) * 10, -5, 5).toFixed(1)
        if (s.d === 'v2') Q.l2 = +clamp(s.val + (mv / 240) * 10, -5, 5).toFixed(1)
        if (s.d === 'freq') Q.lf = +clamp(s.val + (mv / 240) * 99, 1, 100).toFixed(0)
        if (s.d === 'ampl') Q.la = +clamp(s.val + (mv / 240) * 5, 0, 5).toFixed(1)
        update.redo()
      }
    },
    up: (s, e) => {
      if (!s.plug) return
      preview.visible = false
      const d = K.cast(e).find((h) => drops.has(h.object.userData.d))?.object.userData.d
      if (d) { const [kind, val] = d.split(':'); if ((kind === 'cap') === (s.plug === 'C')) api.set(s.plug, +val) }
      K.draw()
    },
    cursor: (d) => (['v1', 'v2', 'freq', 'ampl'].includes(d) || d.startsWith('plug:') ? 'grab' : 'pointer'),
  })
  const ang = (u) => rad(135 - clamp(u, 0, 1) * 270)
  let sig = null
  const update = K.loop((v, o, t, tc) => {
    Q.v = v
    const s = `${v.rp}${v.rn}${v.R}${v.Ri}${v.Rf}${v.C}${v.w}`
    if (s !== sig) { sig = s; buildCords(v) }
    plugs.forEach((q) => { const [a, b] = P(...plugPos(q.k, v)); q.g.position.set(a, b, 0) })
    const val1 = v.v1 ?? Q.l1, val2 = v.v2 ?? v.vr ?? Q.l2
    knobs.v1.rotation.z = ang((val1 + 5) / 10); knobs.v2.rotation.z = ang(v.vr !== undefined ? (val2 + 2.4) / 4.8 : (val2 + 5) / 10)
    const f = v.f ?? Q.lf
    if (f > 10) Q.range = 2; else if (f < 10 && Q.range === 2) Q.range = 1
    knobs.range.rotation.z = ang([0.15, 0.5, 0.85][Q.range]); knobs.freq.rotation.z = ang(Q.range === 2 ? (f - 10) / 90 : (f - 1) / 9)
    const q = ctl('vp'); knobs.ampl.rotation.z = ang(q ? (v.vp - q.min) / (q.max - q.min) : Q.la / 5)
    ledR.material.color.set(v.on ? 0xff3b30 : 0x3a1412); ledG.material.color.set(v.on ? 0x2fd47a : 0x123a22)
    if (tc) drawScope(tc.getContext('2d'), tc.width, tc.height, o.live ? signals(id, v, o) : null, t)
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['supply', 'Supplies'], ['gen', 'Generator'], ['ic', 'Op-amps'], ['bank', 'Components']]
const hintFor = (id) => {
  if (PLUGS[id]) return `Drag a ringed plug onto another resistor bank${PLUGS[id].includes('C') ? ' or capacitor' : ''} to change the value, and use the function generator or the variable supply knobs for the input.`
  if (id === 'comparator') return 'Turn the lower variable supply knob to move the reference and AMPLITUDE to change the input.'
  if (id === 'adder' || id === 'subtractor') return 'Turn the two variable power supply knobs to set V₁ and V₂.'
  return 'Turn FREQUENCY SET, RANGE and AMPLITUDE, and click a generator OUTPUT socket to choose sine, square or triangle.'
}

export const opAmp3D = opAmp.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ on: true, rp: true, rn: true }),
  out: (v, t) => ({ ...e.out(v, t), live: v.on && v.rp && v.rn }),
  read: (v, o) => (o.live ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
  sample: (v, o) => {
    if (!v.on) return { error: 'The trainer is off. Click the supply LEDs to switch it on.' }
    if (!v.rp || !v.rn) return { error: 'The op-amp has no supply. Click the +12V and −12V sockets to plug the cords in.' }
    return e.sample(v, o)
  },
  Stage: stage3D(e, (host, api) => build(host, api, e), { labels: LABELS, hint: `${hintFor(e.id)} Click the +12V or −12V socket to pull a supply cord, and the supply LEDs to switch the kit. Drag the background to look around.`, overlay: { w: 520, h: 260, alt: 'Input and output waveforms', caption: 'Oscilloscope: input and output', cls: 'low' } }),
}))
