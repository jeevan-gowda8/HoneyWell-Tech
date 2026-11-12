import { ofcKit } from './comm'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, drawSeg, silk } from './kit3d'

/* The fibre optics trainer, modelled on the photo of the real kit: a black panel with exposed PCB
   strips, RS232 and function generator blocks, FM and PWM modulators, two emitter and two
   detector circuits, switched faults, comparators, low-pass filters, PLL, AC amplifiers and the
   audio output. Panel coordinates are pixels of the photo turned to landscape (1110 × 840). */

const B = { W: 1110, H: 840, pw: 0.92, tilt: 0.2, z: -0.1 }
B.ph = (B.pw * B.H) / B.W
const SLOPE = Math.PI / 2 - B.tilt, CY = (B.ph / 2) * Math.sin(B.tilt) + 0.078
const KIND = { 'numerical-aperture': 'na', 'bending-loss': 'bend', 'propagation-loss': 'prop', 'led-vi': 'led', photodetector: 'photo', 'am-fm-pwm-link': 'mod', 'rs232-duplex': 'duplex', 'fault-diagnosis': 'fault' }
const EM = { 660: [450, 320], 950: [450, 480] }, DET = { 660: [540, 320], 950: [540, 480] }
const TPS = [[290, 645], [1080, 370], [450, 320], [540, 320], [665, 320], [870, 320], [870, 555], [925, 635]]
const MOD = { fm: [[165, 320], [290, 320]], pwm: [[165, 515], [290, 515]], am: [[160, 645], [290, 645]] }

function drawPanel(g, W, H) {
  const k = W / B.W, X = (x) => x * k, Yp = (y) => y * k, INK = '#ECEDEE'
  const t = (s, x, y, z = 10, al = 'center', c = INK) => { g.fillStyle = c; g.font = `bold ${z * k}px Arial`; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, X(x), Yp(y)) }
  const line = (pts, lw = 1.7, c = INK) => { g.strokeStyle = c; g.lineWidth = lw * k; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(X(a), Yp(b)) : g.moveTo(X(a), Yp(b)))); g.stroke() }
  const box = (x, y, w, h, s, ty = 12) => { g.strokeStyle = INK; g.lineWidth = 2 * k; g.strokeRect(X(x), Yp(y), w * k, h * k); if (s) t(s, x + w / 2, y + ty, 10.5) }
  const ring = (x, y) => { g.strokeStyle = '#C9CCD1'; g.lineWidth = 2 * k; g.beginPath(); g.arc(X(x), Yp(y), 6 * k, 0, 7); g.stroke() }
  const amp = (x, y, w = 40, h = 44) => { line([[x, y - h / 2], [x, y + h / 2], [x + w, y], [x, y - h / 2]], 2) }
  const pcb = (x, y, w, h, seed) => {
    g.fillStyle = '#16181C'; g.fillRect(X(x), Yp(y), w * k, h * k)
    let s = seed; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    for (let i = 0; i < (w * h) / 900; i++) {
      const px = x + 8 + r() * (w - 30), py = y + 8 + r() * (h - 26), kind = r()
      if (kind < 0.12) { g.fillStyle = '#0B0C0E'; g.fillRect(X(px), Yp(py), 46 * k, 16 * k); g.fillStyle = '#9EA3AB'; for (let j = 0; j < 7; j++) { g.fillRect(X(px + 3 + j * 6), Yp(py - 3), 2 * k, 3 * k); g.fillRect(X(px + 3 + j * 6), Yp(py + 16), 2 * k, 3 * k) } }
      else if (kind < 0.25) { g.fillStyle = '#E8C53A'; g.fillRect(X(px), Yp(py), 14 * k, 9 * k) }
      else if (kind < 0.3) { g.fillStyle = '#E3772B'; g.beginPath(); g.arc(X(px), Yp(py), 4 * k, 0, 7); g.fill() }
      else { g.strokeStyle = '#8A9098'; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(X(px - 6), Yp(py)); g.lineTo(X(px + 18), Yp(py)); g.stroke(); g.fillStyle = '#7CC0DA'; g.fillRect(X(px), Yp(py - 2.5), 12 * k, 5 * k); g.fillStyle = ['#C52A1E', '#6B3A1E', '#E8761E'][Math.floor(r() * 3)]; g.fillRect(X(px + 3), Yp(py - 2.5), 2 * k, 5 * k) }
    }
  }
  g.fillStyle = '#111215'; g.fillRect(0, 0, W, H)
  /* header */
  g.fillStyle = '#ECEDEE'; g.font = `900 ${58 * k}px Arial`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('HONEYWELL', X(40), Yp(52)); t('Fiber Optics Trainer', 640, 52, 26); t('Power', 1030, 30, 10)
  /* exposed PCB strips */
  pcb(145, 112, 960, 118, 7); pcb(135, 695, 770, 140, 13); pcb(15, 560, 120, 80, 3)
  /* RS232 and function generator */
  box(15, 112, 125, 195, 'RS232 INTERFACE', 12); t('INTXD', 92, 145, 8, 'left'); t('INRTS', 92, 180, 8, 'left'); t('OUTRXD', 92, 245, 8, 'left'); t('OUTCTS', 92, 285, 8, 'left'); ;[145, 180, 245, 285].forEach((y) => ring(125, y))
  box(15, 312, 125, 375, 'FUNCTION GENERATOR', 12); t('1KHz', 95, 380, 8); t('1KHz', 95, 495, 8)
  line([[50, 400], [50, 388], [62, 388], [62, 400], [74, 400], [74, 388]]); g.strokeStyle = INK; g.lineWidth = 1.7 * k; g.beginPath(); for (let i = 0; i <= 20; i++) { const a = 50 + i * 1.2, b = 470 - Math.sin((TAU * i) / 20) * 6; if (i) g.lineTo(X(a), Yp(b)); else g.moveTo(X(a), Yp(b)) } g.stroke()
  ring(120, 400); ring(120, 470)
  /* modulators and audio input */
  box(145, 235, 172, 170, 'FREQUENCY MODULATOR'); line([[195, 280], [255, 280], [255, 330], [195, 330], [195, 280]], 2); t('VCO', 225, 305, 11); t('IN FM', 165, 300, 8); t('OUT FM', 290, 300, 8); ring(165, 320); ring(290, 320); t('0V', 225, 380, 8)
  box(145, 410, 172, 175, 'PULSE WIDTH MODULATOR'); line([[195, 465], [255, 465], [255, 515], [195, 515], [195, 465]], 2); t('PWM', 225, 490, 11); t('IN PWM', 165, 495, 8); t('OUT PWM', 290, 495, 8); ring(165, 515); ring(290, 515); t('0V', 225, 565, 8)
  box(145, 590, 172, 100, 'AUDIO INPUT CIRCUIT'); amp(200, 650, 36, 38); t('IN', 160, 618, 8); t('OUT', 290, 618, 8); ring(290, 645)
  /* emitters and detectors */
  box(320, 235, 182, 350, 'EMITTER CIRCUITS'); box(507, 235, 180, 350, 'DETECTOR CIRCUITS')
  ;[[320, 'EMITTER 1'], [480, 'EMITTER 2']].forEach(([y, s], i) => { t(`IN E${i + 1}`, 340, y - 22, 8); ring(332, y); amp(360, y, 40, 40); t('DRIVER', 380, y + 30, 8); t('ANALOG', 362, y + 48, 7); t('DIGITAL', 400, y + 48, 7); t(s, 455, y + 32, 7.5); line([[400, y], [432, y]]) })
  ;[[320, 'PHOTO TRANSISTOR'], [480, 'PHOTO TRANSISTOR']].forEach(([y, s], i) => { t(s, 548, y + 32, 7); amp(580, y, 40, 40); line([[560, y], [580, y]]); line([[620, y], [655, y]]); t('AMPLIFIER', 600, y + 30, 7.5); t(`OUT D${i + 1}`, 665, y - 22, 8); ring(665, y) })
  box(320, 590, 367, 100, 'SWITCHED FAULTS'); t('SW3', 400, 615, 8); t('SW4', 590, 615, 8); t('OFF', 360, 632, 7); t('ON', 360, 662, 7); t('1 2 3 4', 400, 680, 8); t('5 6 7 8', 590, 680, 8)
  /* comparators and filters */
  box(692, 235, 210, 280, 'COMPARATOR CIRCUITS')
  ;[[320, 'BIAS1', 'COMPARATOR 1'], [465, 'BIAS2', 'COMPARATOR 2']].forEach(([y, b, s]) => { t(`IN C`, 712, y - 22, 8); ring(712, y); amp(800, y, 40, 40); line([[712, y], [800, y]]); line([[840, y], [870, y]]); t(b, 762, y - 66, 8); t(s, 820, y + 30, 7.5); t('OUT', 870, y - 22, 8); ring(870, y) })
  box(692, 520, 210, 170, 'LOW PASS FILTER')
  ;[[555, 'FILTER 1'], [645, 'FILTER 2']].forEach(([y, s]) => { ring(712, y); ring(870, y); line([[720, y], [760, y]]); g.strokeStyle = INK; g.lineWidth = 2 * k; g.strokeRect(X(760), Yp(y - 18), 70 * k, 36 * k); line([[770, y - 4], [780, y - 8], [790, y - 4], [800, y]]); line([[770, y + 6], [780, y + 2], [790, y + 6], [800, y + 10]]); line([[830, y], [862, y]]); t(s, 795, y + 26, 7.5) })
  /* PLL, AC amplifiers, audio output */
  box(907, 235, 198, 100, 'PHASE-LOCKED LOOP DETECTOR'); line([[960, 285], [1000, 285], [1000, 320], [960, 320], [960, 285]], 2); t('VCO', 980, 302, 9); ring(925, 302); ring(1080, 302)
  box(907, 340, 198, 255, 'A.C. AMPLIFIER CIRCUITS')
  ;[[370, 'GAIN ADJUST 1', 'AMPLIFIER 1'], [505, 'GAIN ADJUST 2', 'AMPLIFIER 2']].forEach(([y, gname, s]) => { ring(925, y); amp(1010, y, 40, 40); line([[925, y], [1010, y]]); line([[1050, y], [1080, y]]); ring(1080, y); t(gname, 955, y + 78, 7.5); t(s, 1030, y + 32, 7.5) })
  box(907, 600, 198, 235, 'AUDIO OUTPUT CIRCUIT'); ring(925, 635); amp(940, 690, 36, 38); t('HEAD PHONE', 1070, 735, 7.5)
  g.fillStyle = '#2C2F35'; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const dx = (i - 4) * 9, dy = (j - 4) * 9; if (dx * dx + dy * dy < 1600) { g.beginPath(); g.arc(X(1010 + dx), Yp(780 + dy), 2.6 * k, 0, 7); g.fill() } }
  ;[[10, 10], [1100, 10], [10, 830], [1100, 830], [555, 830]].forEach(([x, y]) => { g.fillStyle = '#3B3E44'; g.beginPath(); g.arc(X(x), Yp(y), 6 * k, 0, 7); g.fill() })
}
const drawDmm = (g, w, h) => { g.fillStyle = '#F4C21B'; g.fillRect(0, 0, w, h); g.fillStyle = '#26282D'; g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88); g.fillStyle = '#F2F4F7'; g.font = `bold ${h * 0.07}px Arial`; g.textAlign = 'center'; g.fillText('DIGITAL MULTIMETER', w / 2, h * 0.16); g.fillStyle = '#8A9098'; g.beginPath(); g.arc(w / 2, h * 0.68, w * 0.2, 0, 7); g.fill() }

const N = [0, Math.cos(B.tilt), Math.sin(B.tilt)]
const vw = (px, py, d, dz = 0.55) => { const lx = (px / B.W - 0.5) * B.pw, ly = (0.5 - py / B.H) * B.ph, t = [lx, CY + ly * Math.sin(B.tilt), B.z - ly * Math.cos(B.tilt)]; return { p: [t[0], t[1] + N[1] * d, t[2] + N[2] * d + d * dz], t } }
const VIEWS = { whole: { p: [0, 1.05, 1.42], t: [0, 0.08, 0.12] }, panel: vw(555, 420, 0.95), optics: vw(500, 400, 0.48), bench: { p: [0, 0.42, 0.95], t: [0, 0.03, 0.36] } }

function build(host, api, exp, kind) {
  const K = kitScene(host, { background: 0xeceef1, floor: { base: '#C9B79C', tint: ['120,100,80', '235,225,210'], wall: 0xeceef1 }, views: VIEWS, zoom: [0.2, 2.6] })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, M, stdM, label, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  const U = K.unit({ x: 0, z: B.z, y: CY, slope: SLOPE, art: drawPanel, x0: 0, y0: 0, W: B.W, H: B.H, pw: B.pw, artW: 2800 })
  const panel = U.panel, P = U.P
  add(box(B.pw + 0.05, B.ph + 0.05, 0.07), stdM(0x1c1d21, 0.55, 0.2), 0, 0, -0.036, panel)
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => add(cyl(0.012, 0.012, 16), M.black, sx * (B.pw / 2 - 0.03), sy * (B.ph / 2 - 0.03), -0.076, panel).rotation.x = Math.PI / 2)
  const sockG = cyl(0.0064, 0.004, 18), coreG = cyl(0.0038, 0.0055, 14), coreM = stdM(0x26272b, 0.4)
  const sock = (x, y, d) => { const [a, b] = P(x, y); alongZ(add(sockG, M.chrome, a, b, 0.002, panel)); alongZ(add(coreG, coreM, a, b, 0.0035, panel)); if (d) hit(new THREE.SphereGeometry(0.014, 8, 6), a, b, 0.01, d, panel) }
  ;[[125, 145], [125, 180], [125, 245], [125, 285], [120, 400], [120, 470], [165, 320], [290, 320], [165, 515], [290, 515], [290, 645], [332, 320], [332, 480], [665, 320], [665, 480], [712, 320], [870, 320], [712, 465], [870, 465], [712, 555], [870, 555], [712, 645], [870, 645], [925, 302], [1080, 302], [925, 370], [1080, 370], [925, 505], [1080, 505], [925, 635]].forEach(([x, y]) => sock(x, y))
  /* DB9 connectors, audio jacks, toggles, knobs, power switch */
  const db9 = (x, y) => { const [a, b] = P(x, y); add(box(0.05, 0.026, 0.008), M.steel, a, b, 0.004, panel); add(box(0.034, 0.013, 0.01), M.black, a, b, 0.006, panel) }
  db9(55, 205); db9(40, 762)
  const jack = (x, y) => { const [a, b] = P(x, y); alongZ(add(cyl(0.011, 0.008, 20), M.steel, a, b, 0.004, panel)); alongZ(add(cyl(0.0045, 0.0105, 14), M.black, a, b, 0.005, panel)) }
  jack(160, 645); jack(1070, 775)
  const port = (x, y, d) => { const [a, b] = P(x, y); alongZ(add(cyl(0.012, 0.014, 22), M.chrome, a, b, 0.007, panel)); alongZ(add(cyl(0.0042, 0.0145, 14), M.black, a, b, 0.0075, panel)); if (d) hit(new THREE.SphereGeometry(0.02, 8, 6), a, b, 0.014, d, panel); return U.world(x, y, 0.014) }
  const ports = { e660: port(...EM[660], 'l:660'), e950: port(...EM[950], 'l:950'), d660: port(...DET[660]), d950: port(...DET[950]) }
  ;[[375, 370], [375, 530]].forEach(([x, y], i) => { const [a, b] = P(x, y); add(box(0.014, 0.01, 0.004), M.steel, a, b, 0.002, panel); const lev = add(cyl(0.0018, 0.016, 8), M.chrome, a, b, 0.01, panel); lev.rotation.x = 0.5; lev.userData.i = i })
  const knobM = stdM(0xeceef1, 0.45, 0.05), knobs = {}
  const knob = (x, y, name) => { const [a, b] = P(x, y), g = new THREE.Group(); g.position.set(a, b, 0); panel.add(g); alongZ(add(new THREE.CylinderGeometry(0.012, 0.014, 0.016, 22), knobM, 0, 0, 0.008, g)); add(box(0.0016, 0.008, 0.0012), new THREE.MeshBasicMaterial({ color: 0x1b1d22 }), 0, 0.006, 0.0165, g); if (name) { alongZ(hit(cyl(0.022, 0.04, 12), 0, 0, 0.012, name, g)); knobs[name] = g } return g }
  knob(40, 510, 'drive'); knob(762, 254, null).rotation.z = 0.6; knob(762, 399, null).rotation.z = -0.4; knob(955, 448, null).rotation.z = 0.3; knob(955, 583, null).rotation.z = -0.2
  const [pa, pb] = P(1030, 62); add(box(0.034, 0.026, 0.006), stdM(0x111215, 0.5, 0.2), pa, pb, 0.003, panel)
  const pwrM = new THREE.MeshStandardMaterial({ color: 0x2fd47a, roughness: 0.3, emissive: 0x0a4a22 }), pwrKey = add(box(0.026, 0.018, 0.006), pwrM, pa, pb, 0.007, panel); hit(box(0.05, 0.04, 0.03), pa, pb, 0.012, 'pwr', panel)
  /* fault DIP switches */
  const dips = Array.from({ length: 8 }, (_, i) => { const x0 = i < 4 ? 385 : 575, [a, b] = P(x0 + (i % 4) * 11, 648); if (i % 4 === 0) add(box(0.04, 0.02, 0.004), stdM(0x1d5fbf, 0.45, 0.1), ...P(x0 + 16, 648), 0.002, panel); const m = add(box(0.006, 0.008, 0.004), stdM(0xf2f2f0, 0.5, 0), a, b, 0.005, panel); m.userData.base = b; if (kind === 'fault') hit(box(0.01, 0.022, 0.02), a, b, 0.01, `dip:${i + 1}`, panel); return m })
  if (kind === 'fault') TPS.forEach(([x, y], i) => hit(new THREE.SphereGeometry(0.015, 8, 6), ...P(x, y), 0.012, `tp:${i + 1}`, panel))
  if (kind === 'mod') Object.entries(MOD).forEach(([m, [a]]) => { const [u, w] = P(a[0] + 60, a[1] - 15); hit(box(0.08, 0.06, 0.02), u, w, 0.01, `m:${m}`, panel) })
  const tag = new THREE.Group(); panel.add(tag); add(box(0.03, 0.016, 0.004), stdM(0xf0b81e, 0.45, 0), 0, 0.022, 0.008, tag); const tf = face(136, 72, silk('CH1', 46, '#17181C')); tf.set(1); plain(add(new THREE.PlaneGeometry(0.026, 0.014), new THREE.MeshBasicMaterial({ map: tf.tex, transparent: true }), 0, 0.022, 0.0104, tag))

  /* bench accessories: mandrel, spools, NA jig and a multimeter */
  const fibM = stdM(0x111214, 0.4, 0.1), coreLit = new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })
  const MX = -0.1, MZ = 0.36
  const mandrel = add(cyl(0.03, 0.03, 40), stdM(0x9aa3ad, 0.4, 0.5), MX, 0.015, MZ); hit(cyl(0.05, 0.05, 12), MX, 0.02, MZ, 'mandrel')
  ;[0.5, 1, 1.5].forEach((c, i) => { const g = new THREE.Group(); g.position.set(0.14 + i * 0.11, 0, 0.42); scene.add(g); add(cyl(0.042, 0.012, 32), M.dark, 0, 0.006, 0, g); add(new THREE.TorusGeometry(0.03, 0.005 + c * 0.004, 10, 32), fibM, 0, 0.018, 0, g).rotation.x = Math.PI / 2; label(0.06, 0.016, `${c} m`, 46, '#1B2330', 0, 0.0126, 0.05, g, true); hit(cyl(0.05, 0.04, 12), 0, 0.02, 0, `c:${c}`, g) })
  const JX = -0.55, JZ = 0.38
  add(box(0.34, 0.012, 0.08), M.dark, JX, 0.006, JZ); add(box(0.02, 0.05, 0.03), M.black, JX - 0.15, 0.025, JZ)
  const screen = new THREE.Group(); scene.add(screen); add(box(0.004, 0.08, 0.07), stdM(0xf4f4f0, 0.8, 0), 0, 0.05, JZ, screen); add(box(0.03, 0.01, 0.06), M.black, 0, 0.012, JZ, screen); hit(box(0.04, 0.1, 0.09), 0, 0.05, JZ, 'L', screen)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })); cone.rotation.z = Math.PI / 2; scene.add(cone)
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85 })); spot.rotation.y = -Math.PI / 2; scene.add(spot)
  const jigPlane = new THREE.Plane(V(0, 1, 0), -0.012)
  const D = K.unit({ x: 0.58, z: 0.34, ry: -0.35, w: 0.12, h: 0.2, d: 0.04, body: 0x2a2c31, art: drawDmm, x0: 0, y0: 0, W: 120, H: 200, pw: 0.115, artW: 480 })
  D.group.rotation.x = -1.15; D.group.position.y = 0.03
  const dmm = D.disp(18, 34, 84, 40, drawSeg, 420)
  const leadA = K.tube([U.world(665, 320, 0.012), V(0.32, 0.12, 0.16), V(0.5, 0.03, 0.3), D.world(40, 180, 0.01)], 0xc42a26, 0.003)
  const leadB = K.tube([U.world(665, 480, 0.012), V(0.34, 0.1, 0.2), V(0.52, 0.03, 0.32), D.world(80, 180, 0.01)], 0x101114, 0.003)
  /* fibres */
  const fibres = [0, 1].map(() => ({ mesh: add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.01, 0, 0)]), 4, 0.0035, 8), fibM, 0, 0, 0), glow: add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.01, 0, 0)]), 4, 0.0012, 6), coreLit, 0, 0, 0), curve: null }))
  const beads = Array.from({ length: 24 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd0c0, toneMapped: false })); m.userData = { u: (i % 12) / 12, f: i < 12 ? 0 : 1 }; scene.add(m); return m })
  const nUp = V(0, Math.cos(B.tilt), Math.sin(B.tilt))
  const route = (f, from, to, mode, v) => {
    const up = (p, d) => p.clone().addScaledVector(nUp, d)
    const pts = [from, up(from, 0.05), V(from.x - 0.05, 0.05, 0.22)]
    if (mode === 'na') pts.push(V(JX + 0.05, 0.05, JZ - 0.06), V(JX - 0.12, 0.04, JZ))
    else {
      if (mode === 'bend') { const R = v.R / 1000 * 1.2 + 0.012; for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; pts.push(V(MX + Math.cos(a) * (R + 0.004), 0.02, MZ - Math.sin(a) * (R + 0.004))) } }
      else { const len = mode === 'prop' ? v.c : 0.6; pts.push(V(from.x - 0.02, 0.012, 0.26 + len * 0.06), V((from.x + to.x) / 2, 0.012, 0.3 + len * 0.08), V(to.x + 0.02, 0.012, 0.26 + len * 0.06)) }
      pts.push(V(to.x + 0.05, 0.05, 0.22), up(to, 0.05), to)
    }
    const cv = new THREE.CatmullRomCurve3(pts); f.curve = cv
    f.mesh.geometry.dispose(); f.mesh.geometry = new THREE.TubeGeometry(cv, 180, 0.0035, 8)
    f.glow.geometry.dispose(); f.glow.geometry = new THREE.TubeGeometry(cv, 180, 0.0014, 6)
  }
  /* patch cords on the panel for the modulation and fault exercises */
  const cordG = new THREE.Group(); panel.add(cordG)
  const LOCAL = (x, y, z) => V(...P(x, y), z)
  const cords = (list) => {
    cordG.children.slice().forEach((m) => { m.geometry.dispose(); cordG.remove(m) })
    list.forEach(([a, b, c]) => { const d = Math.hypot(a[0] - b[0], a[1] - b[1]) * U.K, up = 0.012 + d * 0.12, A2 = LOCAL(...a, 0.01), B2 = LOCAL(...b, 0.01), mid = A2.clone().lerp(B2, 0.5); mid.z = up; cordG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([A2, LOCAL(...a, up * 0.7), mid, LOCAL(...b, up * 0.7), B2]), 50, 0.0024, 8), stdM(c, 0.5, 0))) })
  }

  const Q = { v: null, sig: '' }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'pwr') { api.set('pwr', !v.pwr); return }
      if (d.startsWith('l:')) { if (ctl('l')) api.set('l', +d.slice(2)); return }
      if (d.startsWith('m:')) { api.set('m', d.slice(2)); return }
      if (d.startsWith('c:')) { if (ctl('c')) api.set('c', +d.slice(2)); return }
      if (d.startsWith('tp:')) { api.set('tp', +d.slice(3)); return }
      if (d.startsWith('dip:')) { const n = +d.slice(4), op = ctl('f').options; if (op.some((o) => o[0] === n)) api.set('f', v.f === n ? 0 : n); return }
      if (d === 'mandrel') return ctl('R') ? { k: 'R', val: v.R } : undefined
      if (d === 'drive') { const k = ctl('V') ? 'V' : ctl('P') ? 'P' : ctl('r') ? 'r' : kind === 'mod' ? 'f' : null; return k ? { k, val: v[k] } : undefined }
      if (d === 'L') return ctl('L') ? { k: 'L', plane: true } : undefined
    },
    drag: (s, e, mv) => {
      const q = ctl(s.k)
      if (s.plane) { const p = K.castTo(e, jigPlane); if (p) api.set('L', quant(q, ((p.x - (JX - 0.12)) / 0.25) * 30)); return }
      api.set(s.k, quant(q, s.val + (mv / 240) * (q.max - q.min)))
    },
    cursor: (d) => (['mandrel', 'drive', 'L'].includes(d) ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t) => {
    Q.v = v
    const on = v.pwr, l = v.l ?? 660, lc = l === 950 ? 0x9b6bff : 0xff3b30
    const sig = `${kind}|${v.R}|${v.c}|${l}|${v.m}`
    if (sig !== Q.sig) {
      Q.sig = sig
      route(fibres[0], ports[`e${l}`], ports[`d${l}`], kind === 'na' ? 'na' : kind, v)
      if (kind === 'duplex') route(fibres[1], ports.e950, ports.d950, 'duplex', v)
      fibres[1].mesh.visible = fibres[1].glow.visible = kind === 'duplex'
      const rx = [[[665, 320], [712, 555], 0x22a899], [[870, 555], [925, 635], 0xe8c53a]]
      if (kind === 'mod') { const [inp, out] = MOD[v.m]; cords([[[120, 470], inp, 0xf5a623], [out, [332, 320], 0xd42b24], ...rx]) }
      else if (kind === 'fault') cords([[[290, 645], [925, 370], 0xf5a623], [[1080, 370], [332, 320], 0xd42b24], ...rx, [[665, 320], [712, 320], 0x8e5bd0]])
      else cords([])
    }
    coreLit.color.set(on ? lc : 0x222222)
    pwrM.emissive.set(on ? 0x0a7a32 : 0x000000); pwrM.color.set(on ? 0x2fd47a : 0x1d5a35)
    const dq = ctl('V') ? 'V' : ctl('P') ? 'P' : ctl('r') ? 'r' : kind === 'mod' ? 'f' : null
    if (dq) { const q = ctl(dq); knobs.drive.rotation.z = rad(135 - ((v[dq] - q.min) / (q.max - q.min)) * 270) }
    dips.forEach((m, i) => { m.position.y = m.userData.base + (kind === 'fault' && v.f === i + 1 ? -0.004 : 0.004) })
    const at = kind === 'fault' ? TPS[v.tp - 1] : null
    tag.visible = !!at; if (at) { const [a, b] = P(...at); tag.position.set(a, b, 0) }
    beads.forEach((m) => { const f = fibres[m.userData.f]; m.visible = on && f.curve && (m.userData.f === 0 || kind === 'duplex') && kind !== 'na'; if (m.visible) { f.curve.getPoint((m.userData.u + t * 0.3) % 1, m.position); m.material.color.set(m.userData.f ? 0x9b6bff : lc) } })
    /* multimeter */
    const val = kind === 'bend' || kind === 'prop' ? [o.P, 'µW'] : kind === 'led' ? [o.I, 'mA'] : kind === 'photo' ? [o.I, 'µA'] : kind === 'mod' ? [o.H, ''] : null
    leadA.visible = leadB.visible = !!val
    dmm.set(`${on}${val?.[0]}`, on && val ? val[0].toFixed(val[0] >= 100 ? 1 : 3).slice(0, 6) : null, val?.[1] || '')
    /* NA jig */
    const L = (v.L ?? 12) / 1000, xs = JX - 0.12 + ((L * 1000) / 30) * 0.25
    screen.position.x = xs - JX
    const len = xs - (JX - 0.12), rr = Math.tan(Math.asin(0.5)) * len * 0.55
    cone.visible = spot.visible = kind === 'na' && on
    cone.scale.set(rr, len, rr); cone.position.set(JX - 0.12 + len / 2, 0.04, JZ); spot.scale.setScalar(Math.max(0.003, ((o.D || 0) / 1000) * 2.6)); spot.position.set(xs - 0.003, 0.05, JZ)
  })
  return K.finish(update)
}

const LABELS = [['whole', 'Whole kit'], ['panel', 'Trainer'], ['optics', 'Emitters and detectors'], ['bench', 'Bench']]
const HINTS = {
  na: 'Drag the white screen along the NA jig and watch the spot grow.',
  bend: 'Drag the mandrel to change the bend radius. Click EMITTER 1 for 660 nm or EMITTER 2 for 950 nm.',
  prop: 'Click a fibre spool to change the cable length. Click EMITTER 1 for 660 nm or EMITTER 2 for 950 nm.',
  led: 'Turn the function generator knob to change the LED forward voltage. Click EMITTER 1 or EMITTER 2 to change the LED.',
  photo: 'Turn the function generator knob to change the optical power. Click EMITTER 1 or EMITTER 2 to change the LED.',
  mod: 'Click the FREQUENCY MODULATOR, PULSE WIDTH MODULATOR or AUDIO INPUT block to choose FM, PWM or AM, and turn the function generator knob for the message frequency.',
  duplex: 'Both fibre links carry data at once. Turn the function generator knob to change the display speed.',
  fault: 'Click a switch on SW3 or SW4 to choose a fault, then click the block outputs to move the CH1 probe along the chain.',
}
export const ofc3D = ofcKit.map((e) => {
  const kind = KIND[e.id]
  return {
    ...e,
    wide: true,
    state: () => ({ pwr: true }),
    read: (v, o) => (v.pwr ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u])),
    sample: e.sample ? (v, o) => (!v.pwr ? { error: 'The trainer is off. Press its green Power switch.' } : e.sample(v, o)) : undefined,
    Stage: stage3D(e, (host, api) => build(host, api, e, kind), { labels: LABELS, hint: `${HINTS[kind]} The green Power switch turns the trainer on and off. Drag the background to look around.` }),
  }
})
