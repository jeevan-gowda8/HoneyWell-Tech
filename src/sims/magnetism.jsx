import { Svg, T, Bench, Panel, Lcd, LcdText, Led, C, Wire, Scope, Eyepiece, usePixels, Dim, Knob, Arrow, Jack } from '../lib/parts'
import { num, sel, tog, TAU, PI, fit, jitter, wobble, sq, rad, deg, snap, clamp, curve, mean, sci, fmt } from '../lib/math'

const MU0 = 4e-7 * PI, Q = 1.602e-19, CC = 2.998e8, EM = 1.759e11

/* Electromagnet shared by the magnetic kits. */
const Magnet = ({ x = 60, y = 180, w = 300, gap = 64, I = 1 }) => (
  <g>
    <rect x={x} y={y - 60} width={w * 0.3} height="120" rx="6" fill="#55607A" /><rect x={x + w * 0.7} y={y - 60} width={w * 0.3} height="120" rx="6" fill="#55607A" />
    <rect x={x + w * 0.5 - gap / 2 - 26} y={y - 26} width={26} height="52" fill="#3C4660" /><rect x={x + w * 0.5 + gap / 2} y={y - 26} width={26} height="52" fill="#3C4660" />
    {Array.from({ length: 11 }, (_, i) => <g key={i}><rect x={x + 14 + i * 5.5} y={y - 70} width="4" height="140" rx="2" fill="url(#g-copper)" /><rect x={x + w * 0.7 + 14 + i * 5.5} y={y - 70} width="4" height="140" rx="2" fill="url(#g-copper)" /></g>)}
    <rect x={x} y={y + 70} width={w} height="14" rx="3" fill={C.steel} />
    {I > 0 && Array.from({ length: 5 }, (_, i) => <line key={i} x1={x + w / 2 - gap / 2 + 3} x2={x + w / 2 + gap / 2 - 3} y1={y - 20 + i * 10} y2={y - 20 + i * 10} stroke={C.t1} strokeOpacity={clamp(I, 0.15, 0.7)} strokeDasharray="4 3" />)}
  </g>
)

/* ---------- Hall effect (PhyUGEx-98) ---------- */
const RH0 = 4e-3, TH = 5e-4, RHO = 0.02 // m3/C, m, ohm.m
const Bfield = (I) => 1.1 * Math.tanh(I / 2.4) // tesla
const RH = (T) => RH0 / (1 + Math.exp((T - 72) / 9))
const hall = (v) => {
  const B = Bfield(v.Im) * (v.rev ? -1 : 1), raw = (RH(v.T) * (v.Ip * 1e-3) * B) / TH * 1000
  return { B, RH: RH(v.T), VH: clamp(raw, -200, 200) }
}
function StageHall({ v, o, t }) {
  const fld = Math.abs(o.B)
  return (
    <Svg>
      <Bench />
      <Magnet I={fld} y={200} />
      <rect x="184" y="186" width="52" height="28" fill={C.t3} stroke="#0A6E52" /><T x={210} y={205} s={11} a="middle" c="#fff" w={700}>Ge</T>
      <rect x="205" y="60" width="10" height="126" fill={C.ink2} />
      <T x={222} y={78} s={11} c={C.ink2}>Hall probe</T>
      <T x={120} y={120} s={22} a="middle" w={700} c={o.B >= 0 ? C.red : C.t1}>{o.B >= 0 ? 'N' : 'S'}</T>
      <T x={300} y={120} s={22} a="middle" w={700} c={o.B >= 0 ? C.t1 : C.red}>{o.B >= 0 ? 'S' : 'N'}</T>
      <Wire d="M60,300 H360" on={v.Im > 0} t={t} c={C.copper} />
      <Panel x={400} y={36} w={376} h={126} t="GAUSS & TESLA METER" sub="InAs · 0–20 kG" />
      <Lcd x={414} y={80} w={200} value={(o.B * 10).toFixed(2)} unit="kG" />
      <Lcd x={626} y={80} w={136} value={o.B.toFixed(3)} unit="T" s={18} />
      <Panel x={400} y={172} w={376} h={136} t="MEASUREMENT UNIT" sub="Max 200 mV" />
      <Lcd x={414} y={218} w={176} value={o.VH.toFixed(2)} unit="mV" label="Hall voltage" />
      <Lcd x={602} y={218} w={160} value={v.Ip.toFixed(1)} unit="mA" label="Probe current" s={18} />
      <Panel x={400} y={318} w={376} h={136} t="CONSTANT CURRENT SOURCE / OVEN" />
      <Lcd x={414} y={366} w={176} value={v.Im.toFixed(2)} unit="A" label="Magnet current" />
      <Lcd x={602} y={366} w={160} value={v.T.toFixed(0)} unit="°C" label="PT100" s={18} />
      <T x={210} y={346} s={12} a="middle" c={C.ink2}>Field direction: {o.B >= 0 ? 'left to right' : 'right to left'}</T>
    </Svg>
  )
}
const hCtl = (over = {}) => [
  num('Ip', 'Probe current', 0, 20, 0.5, over.Ip ?? 5, 'mA'), num('Im', 'Magnet current', 0, 3.5, 0.05, over.Im ?? 2, 'A'),
  num('T', 'Crystal temperature', 25, 100, 1, 30, '°C'), tog('rev', 'Reverse magnet current', false),
].filter((c) => !(over.hide || []).includes(c.k))
const hRead = (v, o) => [['Field', (o.B * 10).toFixed(2), 'kG'], ['Hall voltage', o.VH.toFixed(2), 'mV']]
const base = (over) => ({ controls: hCtl(over), out: (v) => hall({ Ip: 5, Im: 2, T: 30, rev: false, ...v }), Stage: ({ v, ...p }) => <StageHall v={{ Ip: 5, Im: 2, T: 30, rev: false, ...v }} {...p} />, read: hRead })
const viCols = [['Ip', 'I (mA)', 1], ['VH', 'V_H (mV)', 2]]
const viSample = (v, o) => ({ Ip: v.Ip, VH: wobble(o.VH, 0.08) })
const viGraph = { x: 'Ip', y: 'VH', xl: 'Probe current (mA)', yl: 'Hall voltage (mV)', fit: true }
const viSweep = { k: 'Ip', n: 9, from: 2, to: 18 }
const RHfrom = (m, B) => (m * 1e-3 * TH) / (1e-3 * B)
const hBSide = (v) => Math.abs(Bfield(v.Im ?? 2))

const fieldMeasure = { id: 'magnetic-field', title: 'Magnetic field with Gauss & Tesla meter', short: 'B against magnet current', aim: 'Measure the magnetic field of the electromagnet with the Gauss and Tesla meter.', formula: 'B = f(I_m), saturating at high current', principle: 'The InAs probe measures B directly. The field rises almost linearly at first and saturates as the iron core fills.', steps: ['Place the probe in the gap.', 'Raise the magnet current in steps.', 'Note the field.', 'Plot B against I_m.'], ...base({ hide: ['Ip', 'T'] }), columns: [['Im', 'I_m (A)', 2], ['B', 'B (kG)', 2]], sample: (v, o) => ({ Im: v.Im, B: wobble(Math.abs(o.B) * 10, 0.02) }), sweep: { k: 'Im', n: 11 }, graph: { x: 'Im', y: 'B', xl: 'Magnet current (A)', yl: 'Field (kG)', curve: () => curve((I) => Bfield(I) * 10, 0, 3.5) }, analyse: (r) => [['Field at top current', Math.max(...r.map((x) => x.B)), 'kG', Bfield(Math.max(...r.map((x) => x.Im))) * 10]] }
const poles = { id: 'magnet-poles', title: 'Identify electromagnet poles', short: 'From meter direction', aim: 'Determine which face of the electromagnet is the north pole using the Hall probe and direction indicator.', formula: 'sign(B) gives the direction of the field', principle: 'Reversing the magnet current swaps the poles. The Gauss meter’s direction indication and the sign of the Hall voltage show which is which.', steps: ['Switch on the magnet.', 'Note the indicated direction.', 'Reverse the coil current.', 'Confirm the poles swap.'], ...base({ hide: ['Ip', 'T'] }), columns: [['c', 'Coil', 0], ['B', 'B (kG)', 2], ['p', 'Left face', 0]], sample: (v, o) => ({ c: v.rev ? 'Reversed' : 'Normal', B: o.B * 10, p: o.B >= 0 ? 'North' : 'South', rev: v.rev }), sweep: { list: [{ rev: false }, { rev: true }] }, need: 2, analyse: (r) => { const a = r.filter((x) => !x.rev).pop(), b = r.filter((x) => x.rev).pop(); return a && b ? [['Normal: left face', a.p, ''], ['Reversed: left face', b.p, ''], ['Poles swap', a.p !== b.p ? 'Confirmed' : 'No', '']] : [['Status', 'Record both coil directions', '']] } }
const hv = { id: 'hall-voltage', title: 'Measurement of Hall voltage', short: 'V_H of the crystal', aim: 'Measure the Hall voltage across the p-type germanium crystal.', formula: 'V_H = R_H I B / t', principle: 'A magnetic field deflects moving charges to one side of the crystal, building a transverse voltage that balances the magnetic force.', steps: ['Set the field and probe current.', 'Note the Hall voltage.', 'Reverse the magnet and repeat.', 'Average the two to cancel offset.'], ...base({}), columns: viCols, sample: viSample, sweep: viSweep, graph: viGraph, analyse: (r, v) => { const f = fit(r, 'Ip', 'VH'); return f && [['V_H per mA', f.m, 'mV/mA', (RH(v.T) * 1e-3 * hBSide(v)) / TH * 1000]] } }
const conc = { id: 'carrier-concentration', title: 'Carrier concentration', short: 'n = 1 / (R_H e)', aim: 'Calculate the charge-carrier concentration of the semiconductor crystal.', formula: 'n = 1 / (R_H e)', principle: 'The Hall coefficient depends inversely on carrier density. A small density needs a large drift speed for the same current, so V_H is large.', steps: ['Record V_H against probe current.', 'Find the slope.', 'Compute R_H.', 'Calculate n.'], ...base({}), columns: viCols, sample: viSample, sweep: viSweep, graph: viGraph, analyse: (r, v) => { const f = fit(r, 'Ip', 'VH'); if (!f) return null; const R = RHfrom(f.m, hBSide(v)); return [['Hall coefficient R_H', sci(R, 3), 'm³/C'], ['Carrier density n', 1 / (R * Q), 'm⁻³', 1 / (RH(v.T) * Q)]] } }
const rhExp = { id: 'hall-coefficient', title: 'Hall coefficient of p-type Ge', short: 'R_H from the slope', aim: 'Calculate the Hall coefficient of the p-type germanium crystal.', formula: 'R_H = V_H t / (I B)', principle: 'The slope of V_H against probe current, along with the known field and thickness, gives R_H.', steps: ['Fix the field.', 'Vary the probe current.', 'Plot V_H against I.', 'Calculate R_H.'], ...base({}), columns: viCols, sample: viSample, sweep: viSweep, graph: viGraph, analyse: (r, v) => { const f = fit(r, 'Ip', 'VH'); return f && [['R_H', RHfrom(f.m, hBSide(v)) * 1000, '×10⁻³ m³/C', RH(v.T) * 1000]] } }
const mobility = { id: 'mobility', title: 'Mobility of charge carriers', short: 'µ = R_H / ρ', aim: 'Calculate the mobility of charge carriers in the crystal.', formula: 'µ = R_H / ρ', principle: 'Mobility links how fast carriers drift to the applied field. It follows from the Hall coefficient and the crystal resistivity of 0.02 Ω·m.', steps: ['Find R_H from V_H against I.', 'Take ρ from the probe specification.', 'Calculate µ.'], ...base({}), columns: viCols, sample: viSample, sweep: viSweep, graph: viGraph, analyse: (r, v) => { const f = fit(r, 'Ip', 'VH'); if (!f) return null; return [['Mobility µ', RHfrom(f.m, hBSide(v)) / RHO, 'm²/V·s', RH(v.T) / RHO]] } }
const vhI = { id: 'vh-vs-current', title: 'Hall voltage against current', short: 'Constant magnetic field', aim: 'Study how V_H varies with probe current at constant magnetic field.', formula: 'V_H ∝ I (B constant)', principle: 'With the field fixed, Hall voltage rises in direct proportion to the probe current.', steps: ['Fix the magnet current.', 'Step the probe current.', 'Note V_H.', 'Plot and check linearity.'], ...base({}), columns: viCols, sample: viSample, sweep: viSweep, graph: viGraph, analyse: (r) => { const f = fit(r, 'Ip', 'VH'); return f && [['Slope', f.m, 'mV/mA'], ['Linearity R²', f.r2.toFixed(4), '']] } }
const vhB = { id: 'vh-vs-field', title: 'Hall voltage against magnetic field', short: 'Constant current', aim: 'Study how V_H varies with magnetic field at constant probe current.', formula: 'V_H ∝ B (I constant)', principle: 'With the current fixed, Hall voltage follows the field in direct proportion.', steps: ['Fix the probe current.', 'Step the magnet current.', 'Note B and V_H.', 'Plot V_H against B.'], ...base({}), columns: [['B', 'B (kG)', 2], ['VH', 'V_H (mV)', 2]], sample: (v, o) => ({ B: o.B * 10, VH: wobble(o.VH, 0.08) }), sweep: { k: 'Im', n: 10, from: 0.3, to: 3.3 }, graph: { x: 'B', y: 'VH', xl: 'Field (kG)', yl: 'Hall voltage (mV)', fit: true }, analyse: (r) => { const f = fit(r, 'B', 'VH'); return f && [['Slope', f.m, 'mV/kG'], ['Linearity R²', f.r2.toFixed(4), '']] } }
const rhT = { id: 'rh-vs-temperature', title: 'Hall coefficient against temperature', short: 'Extrinsic to intrinsic', aim: 'Study how the Hall coefficient changes as the crystal is heated.', formula: 'R_H = V_H t / (I B)', principle: 'At room temperature dopant holes dominate. As heating creates electron–hole pairs, the electrons cancel the hole signal and R_H falls sharply.', steps: ['Fix the field and current.', 'Heat the crystal in the oven.', 'Note V_H at each temperature.', 'Plot R_H against T.'], ...base({}), columns: [['T', 'T (°C)', 0], ['VH', 'V_H (mV)', 2], ['Rh', 'R_H (×10⁻³)', 3]], sample: (v, o) => { const VH = wobble(o.VH, 0.03); return { T: v.T, VH, Rh: ((VH / 1000) * TH) / (v.Ip * 1e-3 * Math.abs(o.B)) * 1000 } }, sweep: { k: 'T', n: 16 }, graph: { x: 'T', y: 'Rh', xl: 'Temperature (°C)', yl: 'R_H (×10⁻³ m³/C)', curve: () => curve((T) => RH(T) * 1000, 25, 100) }, analyse: (r) => [['R_H near room T', r.reduce((a, b) => (b.T < a.T ? b : a)).Rh, '×10⁻³ m³/C', RH(25) * 1000]] }
export const hallKit = [fieldMeasure, poles, hv, conc, rhExp, mobility, vhI, rhT, vhB]

/* ---------- B–H hysteresis (PhyUGEx-107, PhyPGEx-62) ---------- */
export const MAT = { soft: { name: 'CRNGO (soft)', Bs: 1.5, Hc: 35, H0: 120 }, hard: { name: 'Mild steel (harder)', Bs: 1.45, Hc: 180, H0: 350 } }
const f = (m, H) => m.Bs * Math.tanh(H / m.H0) + MU0 * H
export const loop = (m, Hm) => {
  const d = (f(m, Hm + m.Hc) - f(m, Hm - m.Hc)) / 2
  return { up: (H) => f(m, H - m.Hc) + d, down: (H) => f(m, H + m.Hc) - d }
}
const NI = 600 // H per ampere, 300 turns over 0.5 m
export const loopStats = (m, Hm) => {
  const L = loop(m, Hm)
  const Bm = L.up(Hm), Br = L.down(0)
  let a = 0, b = Hm; for (let i = 0; i < 50; i++) { const c = (a + b) / 2; if (L.up(c) > 0) b = c; else a = c }
  let area = 0; const n = 400
  for (let i = 0; i < n; i++) { const H = -Hm + ((i + 0.5) * 2 * Hm) / n; area += (L.down(H) - L.up(H)) * ((2 * Hm) / n) }
  return { Bm, Br, Hc: a, area }
}
function StageBH({ v, m, Hm, t }) {
  const L = loop(m, Hm), ph = ((t * 0.5) % 1) * TAU
  const H = Hm * Math.sin(ph), B = Math.cos(ph) > 0 ? L.up(H) : L.down(H)
  const sx = 1 / 620, sy = 1 / 1.7
  return (
    <Svg>
      <Bench />
      <Panel light x={18} y={24} w={290} h={428} t="CORE ASSEMBLY" sub="U–I laminated" />
      <path d="M60,120 H266 V330 H210 V180 H116 V330 H60 Z" fill="#6A7590" stroke="#49536C" />
      <rect x="56" y="330" width="214" height="34" rx="3" fill="#4F5A75" />
      {Array.from({ length: 12 }, (_, i) => <g key={i}><rect x={50} y={190 + i * 11} width={76} height="7" rx="3" fill="url(#g-copper)" /><rect x={200} y={190 + i * 11} width={76} height="7" rx="3" fill="url(#g-copper)" /></g>)}
      <T x={88} y={392} s={11} a="middle" c={C.ink2}>Primary</T><T x={238} y={392} s={11} a="middle" c={C.ink2}>Secondary</T>
      <T x={163} y={428} s={12} a="middle" w={600}>{m.name}</T>
      <Scope x={326} y={24} w={456} h={330} title="B–H DISPLAY" sub="Live data" n={100} xy={{ n: 520, c: C.t1, f: (s) => { const u = s * 2; const h = u < 1 ? Hm * (-1 + 2 * u) : Hm * (3 - 2 * u); return [h * sx, (u < 1 ? L.up(h) : L.down(h)) * sy] } }} />
      <circle cx={554 + H * sx * 196} cy={200 - B * sy * 131} r="6" fill={C.t2} stroke="#fff" strokeWidth="2" />
      <Panel x={326} y={364} w={456} h={88} t="DATA LOGGER" sub="12-bit · 100 ksps" />
      <Lcd x={342} y={396} w={200} h={44} value={H.toFixed(0)} unit="A/m" />
      <Lcd x={558} y={396} w={208} h={44} value={B.toFixed(3)} unit="T" />
    </Svg>
  )
}
const hCols = [['Hm', 'H_m (A/m)', 0], ['Bm', 'B_m (T)', 3], ['Br', 'B_r (T)', 3], ['Hc', 'H_c (A/m)', 1], ['mu', 'µ_r', 0]]
const hSample = (mat) => (v) => { const m = MAT[mat || v.mat], s = loopStats(m, v.I * NI); return { Hm: v.I * NI, Bm: jitter(s.Bm, 0.002), Br: jitter(s.Br, 0.003), Hc: jitter(s.Hc, 0.003), mu: s.Bm / (MU0 * v.I * NI) } }
const hLoopPts = (m, Hm) => { const L = loop(m, Hm); return [...curve(L.up, -Hm, Hm, 120), ...curve(L.down, -Hm, Hm, 120).reverse()] }
const bhCore = (mat, ctlMat) => ({
  controls: [...(ctlMat ? [sel('mat', 'Core material', [['soft', 'CRNGO (soft)'], ['hard', 'Mild steel (harder)']], 'hard')] : []), num('I', 'Peak coil current', 0.1, 1, 0.02, 0.8, 'A')],
  out: () => ({}),
  Stage: ({ v, t }) => <StageBH v={v} t={t} m={MAT[mat || v.mat]} Hm={v.I * NI} />,
  read: (v) => { const s = loopStats(MAT[mat || v.mat], v.I * NI); return [['H_m', (v.I * NI).toFixed(0), 'A/m'], ['B_m', s.Bm.toFixed(3), 'T'], ['Retentivity', s.Br.toFixed(3), 'T'], ['Coercivity', s.Hc.toFixed(1), 'A/m']] },
  columns: hCols, sample: hSample(mat), sweep: { k: 'I', n: 10, from: 0.1, to: 1 },
})
const loopExp = (mat, ctlMat, id, title, short, aim) => ({
  id, title, short, aim,
  formula: 'Energy loss per cycle = area of the B–H loop',
  principle: 'As the field is cycled, the magnetisation lags behind it, tracing a loop. Its height at H = 0 is the retentivity, its half-width is the coercivity, and its area is the energy lost per cycle.',
  steps: ['Connect the voltage and current sensors.', 'Choose the peak drive current.', 'Let the software plot the loop.', 'Read B_r, H_c and the loop area.'],
  ...bhCore(mat, ctlMat),
  graph: { x: 'Hm', y: 'Bm', xl: 'H (A/m)', yl: 'B (T)', zero: true, curve: (v) => hLoopPts(MAT[mat || v.mat], v.I * NI), modelLabel: 'B–H loop', title: 'B–H loop and magnetisation tips' },
  analyse: (r, v) => { const s = loopStats(MAT[mat || v.mat], r[r.length - 1].Hm); return [['Retentivity B_r', r[r.length - 1].Br, 'T', s.Br], ['Coercivity H_c', r[r.length - 1].Hc, 'A/m', s.Hc], ['Loss per cycle', s.area, 'J/m³']] },
  need: 2,
})
const perm = (mat, ctlMat) => ({
  id: 'relative-permeability', title: 'Relative permeability', short: 'µ_r against H',
  aim: 'Determine the relative permeability of the ferromagnetic material automatically from the tip of the loop.',
  formula: 'µ_r = B_m / (µ₀ H_m)',
  principle: 'Permeability rises to a maximum as domains align easily, then falls as the core saturates.',
  steps: ['Increase the peak current in steps.', 'Record B_m and H_m.', 'Compute µ_r.', 'Locate the maximum.'],
  ...bhCore(mat, ctlMat),
  graph: { x: 'Hm', y: 'mu', xl: 'H_m (A/m)', yl: 'Relative permeability µ_r' },
  analyse: (r) => { const m = r.reduce((a, b) => (b.mu > a.mu ? b : a)); return [['Peak µ_r', m.mu, ''], ['At H_m', m.Hm, 'A/m']] },
})
const demag = (mat, ctlMat) => ({
  id: 'demagnetization', title: 'Automatic demagnetization', short: 'Loops shrink to zero',
  aim: 'Remove the remanent magnetism of the core by progressively reducing the alternating drive.',
  formula: 'H_m(n) = H_m(0) × 0.8ⁿ',
  principle: 'Cycling with a reducing amplitude leaves the core following ever smaller loops that shrink toward the origin, so the remanence falls to near zero.',
  steps: ['Magnetise the core at full current.', 'Advance the demagnetising cycles.', 'Note the remanence after each.', 'Plot the fall.'],
  controls: [...(ctlMat ? [sel('mat', 'Core material', [['soft', 'CRNGO (soft)'], ['hard', 'Mild steel (harder)']], 'hard')] : []), num('n', 'Demagnetising cycles', 0, 24, 1, 0)],
  out: () => ({}),
  Stage: ({ v, t }) => <StageBH v={v} t={t} m={MAT[mat || v.mat]} Hm={Math.max(2, 600 * 0.8 ** v.n)} />,
  read: (v) => [['Residual B_r', loopStats(MAT[mat || v.mat], 600 * 0.8 ** v.n).Br.toFixed(4), 'T'], ['Drive H_m', (600 * 0.8 ** v.n).toFixed(1), 'A/m']],
  columns: [['n', 'Cycle', 0], ['Hm', 'H_m (A/m)', 1], ['Br', 'B_r (T)', 4]],
  sample: (v) => ({ n: v.n, Hm: 600 * 0.8 ** v.n, Br: loopStats(MAT[mat || v.mat], 600 * 0.8 ** v.n).Br }),
  sweep: { k: 'n', n: 13 },
  graph: { x: 'n', y: 'Br', xl: 'Cycle number', yl: 'Remanence B_r (T)' },
  analyse: (r) => { const a = r.reduce((x, y) => (y.n < x.n ? y : x)), b = r.reduce((x, y) => (y.n > x.n ? y : x)); return [['Start', a.Br, 'T'], ['End', b.Br, 'T'], ['Reduction', ((1 - b.Br / a.Br) * 100).toFixed(1), '%']] },
})
export const bhCro = [loopExp(null, true, 'bh-loop', 'B–H loop on the display', 'Retentivity and coercivity', 'Trace the hysteresis loop of a ferromagnetic specimen and determine its retentivity and coercivity.'), perm(null, true), demag(null, true)]
export const bhHardSoft = [loopExp('hard', false, 'hard-material', 'Hard material: mild steel core', 'Wide loop', 'Trace the B–H curve of the harder mild-steel core and determine B_r and H_c.'), loopExp('soft', false, 'soft-material', 'Soft material: CRNGO core', 'Narrow loop', 'Trace the B–H curve of the soft CRNGO core and determine B_r and H_c.'), perm(null, true), demag(null, true)]

/* ---------- Faraday's law (PhyUGEx-214) ---------- */
const COIL = { 700: { swg: 26, R: 10 }, 900: { swg: 28, R: 15 }, 1150: { swg: 30, R: 20 } }
const PHI0 = 3e-5, A0 = 0.03
export const phi = (z) => PHI0 / Math.pow(1 + sq(z / A0), 1.5)
const dphi = (z) => (-3 * PHI0 * z) / (A0 * A0 * Math.pow(1 + sq(z / A0), 2.5))
export const emf = (N, u, z) => -N * dphi(z) * u
const peakEmf = (N, u) => N * u * (3 * PHI0 * (A0 / 2)) / (A0 * A0 * Math.pow(1.25, 2.5))
function StageFar({ v, o, t }) {
  const H = 270, tt = t % 2.4, u = clamp(tt / 1.6, 0, 1)
  const start = 40, gateY = 120 + (v.h / 0.5) * 70, stop = 455
  const y = start + (stop - start) * u * u
  const coilY = gateY + 70
  const z = ((y - coilY) / H) * 0.3
  const live = emf(v.N, o.u, z)
  void H
  return (
    <Svg>
      <Bench />
      <rect x="120" y="30" width="44" height="432" fill="rgba(160,190,220,.28)" stroke="#9FB6CC" />
      <rect x="132" y={y - 18} width="20" height="36" rx="4" fill={C.t2} /><rect x="132" y={y - 18} width="20" height="16" rx="4" fill={C.t1} />
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x="104" y={coilY - 28 + i * 4} width="76" height="3" rx="1.5" fill="url(#g-copper)" />)}
      <T x={190} y={coilY + 4} s={11} c={C.copper} w={700}>{v.N} turns</T>
      <line x1="94" x2="190" y1={gateY} y2={gateY} stroke={C.t2} strokeDasharray="5 4" /><T x={196} y={gateY + 4} s={10} c={C.t2}>Photogate</T>
      <Dim x1={84} y1={40} x2={84} y2={gateY} l="" /><T x={78} y={(40 + gateY) / 2} s={12} a="end" w={600}>{(v.h * 100).toFixed(0)} cm</T>
      <Scope x={270} y={30} w={510} h={280} title="DATA LOGGER · VOLTAGE SENSOR" sub="±2.5 V" tr={[{ f: (s) => emf(v.N, o.u, (s - 0.5) * 0.18) / 2.5 }]} />
      <circle cx={280 + clamp(z / 0.18 + 0.5, 0, 1) * 490} cy={56 + 121 - (live / 2.5) * 111} r="6" fill={C.t2} stroke="#fff" strokeWidth="2" />
      <Panel x={270} y={320} w={250} h={132} t="DIGITAL TIMER" sub="0.1 ms" />
      <Lcd x={284} y={362} w={222} value={o.u.toFixed(3)} unit="m/s" label="Velocity at coil" />
      <Panel x={530} y={320} w={250} h={132} t="PEAK EMF" />
      <Lcd x={544} y={362} w={222} value={o.Vp.toFixed(3)} unit="V" label="Induced" />
    </Svg>
  )
}
const fCtl = (c) => [num('h', 'Drop height', 0.05, 0.5, 0.01, 0.2, 'm'), sel('N', 'Coil', Object.entries(COIL).map(([N, x]) => [+N, `${N} turns · SWG ${x.swg}`]), 900), ...c]
const fOut = (v) => { const u = Math.sqrt(2 * 9.78 * v.h); return { u, Vp: peakEmf(v.N, u) } }
export const faraday = [
  { id: 'emf-vs-velocity', title: 'Induced EMF against velocity', short: 'Faster, larger peak', aim: 'Verify that the induced EMF is proportional to the rate of change of flux by changing the magnet’s speed.', formula: 'ε = − N dΦ/dt     ε_peak ∝ v', principle: 'A faster-moving magnet changes the flux linked with the coil more quickly, so the peak EMF rises with speed.', steps: ['Set the drop height.', 'Release the magnet through the coil.', 'Note the velocity and peak EMF.', 'Plot peak EMF against velocity.'], controls: fCtl([]), out: fOut, Stage: StageFar, read: (v, o) => [['Velocity', o.u.toFixed(3), 'm/s'], ['Peak EMF', o.Vp.toFixed(3), 'V']], columns: [['u', 'v (m/s)', 3], ['Vp', 'ε_peak (V)', 3]], sample: (v, o) => ({ u: jitter(o.u, 0.003), Vp: jitter(o.Vp, 0.008) }), sweep: { k: 'h', n: 10 }, graph: { x: 'u', y: 'Vp', xl: 'Velocity (m/s)', yl: 'Peak EMF (V)', fit: true }, analyse: (r) => { const q = fit(r, 'u', 'Vp'); return q && [['Slope', q.m, 'V·s/m'], ['Linearity R²', q.r2.toFixed(4), '']] } },
  { id: 'emf-vs-turns', title: 'Induced EMF against number of turns', short: 'Compare the coil set', aim: 'Compare coils with different turns and wire gauges and show that EMF is proportional to N.', formula: 'ε ∝ N', principle: 'Each turn links the same changing flux, so the EMF adds turn by turn.', steps: ['Fix the drop height.', 'Fit each coil in turn.', 'Note the peak EMF.', 'Plot peak EMF against N.'], controls: fCtl([]), out: fOut, Stage: StageFar, read: (v, o) => [['Turns', v.N, ''], ['Peak EMF', o.Vp.toFixed(3), 'V']], columns: [['N', 'N', 0], ['Vp', 'ε_peak (V)', 3]], sample: (v, o) => ({ N: v.N, Vp: jitter(o.Vp, 0.006) }), sweep: { list: [{ N: 700 }, { N: 900 }, { N: 1150 }] }, graph: { x: 'N', y: 'Vp', xl: 'Number of turns', yl: 'Peak EMF (V)', fit: true }, analyse: (r) => { const q = fit(r, 'N', 'Vp'); return q && [['EMF per turn', q.m * 1000, 'mV'], ['Linearity R²', q.r2.toFixed(4), '']] } },
  { id: 'flux-conservation', title: 'Flux linkage from the EMF curve', short: 'Area stays constant', aim: 'Show that the area under the EMF–time pulse depends on the flux linked and not on the speed.', formula: '∫ ε dt = N ΔΦ', principle: 'A faster fall gives a taller, narrower pulse. The area of each lobe stays the same because the total change in flux does not depend on speed.', steps: ['Drop from one height.', 'Integrate one lobe of the pulse.', 'Repeat at other heights.', 'Compare the areas.'], controls: fCtl([]), out: fOut, Stage: StageFar, read: (v, o) => [['Velocity', o.u.toFixed(3), 'm/s'], ['Lobe area', (v.N * phi(0) * 1000).toFixed(3), 'mV·s']], columns: [['u', 'v (m/s)', 3], ['area', 'Area (mV·s)', 3]], sample: (v, o) => ({ u: o.u, area: jitter(v.N * phi(0) * 1000, 0.005) }), sweep: { k: 'h', n: 8 }, graph: { x: 'u', y: 'area', xl: 'Velocity (m/s)', yl: 'Lobe area (mV·s)' }, analyse: (r, v) => [['Mean area', mean(r.map((x) => x.area)), 'mV·s', v.N * phi(0) * 1000]] },
]

/* ---------- Thomson e/m (PhyUGEx-74) ---------- */
const CRT = { d: 0.01, l: 0.02, L: 0.15, BH: 3.9e-5, M: 0.52 }
const emOut = (v) => {
  const u = Math.sqrt(2 * EM * v.Va)
  const yE = (v.Vy * CRT.l * CRT.L) / (2 * CRT.d * v.Va)
  const B = v.mag ? (2 * 1e-7 * 2 * CRT.M) / (v.x / 100) ** 3 : 0
  const yB = EM * B * CRT.l * CRT.L / u
  const th = Math.atan(B / CRT.BH)
  return { u, yE, B, yB, th, net: (yE - yB) * 1000 }
}
function StageEm({ v, o }) {
  const sp = clamp(o.net, -14, 14) * 7
  return (
    <Svg>
      <Bench />
      <path d="M60,160 H340 L470,70 V290 L340,200 H60 Z" fill="rgba(200,220,240,.4)" stroke={C.ink2} strokeWidth="2" />
      <rect x="110" y="168" width="60" height="6" fill={C.ink2} /><rect x="110" y="186" width="60" height="6" fill={C.ink2} />
      <path d={`M60,180 H170 Q 300,180 468,${180 - sp}`} stroke={C.t3} strokeWidth="2" fill="none" />
      <ellipse cx="470" cy="180" rx="14" ry="112" fill="#E8F7EE" stroke={C.ink2} strokeWidth="2" />
      <circle cx="470" cy={180 - sp} r="8" fill={C.t3} /><circle cx="470" cy={180 - sp} r="16" fill={C.t3} opacity=".25" />
      <rect x="40" y="290" width="440" height="16" rx="3" fill="#D9CFB8" /><T x={260} y={302} s={10} a="middle" c={C.ink2}>Wing bridge stand · graduated ±15 cm</T>
      {v.mag && [-1, 1].map((s) => <g key={s}><rect x={260 + s * v.x * 8 - 22} y="262" width="44" height="20" fill={s < 0 ? C.red : C.t1} /><T x={260 + s * v.x * 8} y={277} s={11} a="middle" c="#fff" w={700}>{s < 0 ? 'N' : 'S'}</T></g>)}
      <circle cx="600" cy="130" r="82" fill="#fff" stroke={C.brass} strokeWidth="5" />
      {Array.from({ length: 36 }, (_, i) => <line key={i} x1={600 + Math.cos(i * 0.1745) * 70} y1={130 + Math.sin(i * 0.1745) * 70} x2={600 + Math.cos(i * 0.1745) * 78} y2={130 + Math.sin(i * 0.1745) * 78} stroke={C.ink3} />)}
      <g transform={`rotate(${deg(o.th)} 600 130)`}><path d="M600,62 l7,68 h-14 Z" fill={C.red} /><path d="M600,198 l7,-68 h-14 Z" fill={C.steel} /></g>
      <T x={600} y={232} s={11} a="middle" c={C.ink2}>Compass: {deg(o.th).toFixed(1)}°</T>
      <Panel x={500} y={250} w={280} h={200} t="HT / LT POWER SUPPLY" />
      <Lcd x={514} y={294} w={124} h={40} value={v.Va} unit="V" label="Accelerating" s={18} /><Lcd x={646} y={294} w={120} h={40} value={v.Vy.toFixed(1)} unit="V" label="Deflection" s={18} />
      <Lcd x={514} y={366} w={252} h={44} value={o.net.toFixed(2)} unit="mm" label="Spot from centre" />
      <Panel x={60} y={340} w={270} h={112} t="CRT CONTROLS" /><Knob x={108} y={388} val={0.6} l="Focus" /><Knob x={190} y={388} val={0.4} l="Intensity" /><Knob x={272} y={388} val={0.5} l="X-shift" />
    </Svg>
  )
}
export const emThomson = [
  { id: 'e-by-m', title: 'Specific charge e/m', short: 'Balance the deflections', aim: "Determine e/m of the electron by Thomson's crossed-field method using bar magnets.", formula: 'e/m = y V_y / (d B² l L)', principle: 'The plates deflect the beam by y. The magnets then bring the spot back to the centre. Balance means v = E/B, and together with y that gives e/m. The compass measures B through B = B_H tan θ.', steps: ['Note the deflection y with magnets away.', 'Bring the magnets closer until the spot returns to centre.', 'Read the compass deflection.', 'Calculate e/m.'], controls: [num('Va', 'Accelerating voltage', 600, 1000, 10, 800, 'V'), num('Vy', 'Deflection voltage', 5, 40, 0.5, 20, 'V'), num('x', 'Magnet distance', 8, 15, 0.01, 12, 'cm'), tog('mag', 'Magnets in place', true)], out: emOut, Stage: StageEm, read: (v, o) => [['Spot from centre', o.net.toFixed(2), 'mm'], ['y (electric only)', (o.yE * 1000).toFixed(2), 'mm'], ['B', (o.B * 1e4).toFixed(3), 'G']], tip: 'Reading is accepted when the spot is within 0.3 mm of the centre.', columns: [['Va', 'V_a (V)', 0], ['Vy', 'V_y (V)', 1], ['y', 'y (mm)', 2], ['B', 'B (G)', 3], ['q', 'e/m (C/kg)', 3]], sample: (v, o) => { if (!v.mag || Math.abs(o.net) > 0.3) return { error: 'Balance the spot on the centre line with the magnets first.' }; const y = jitter(o.yE, 0.008), B = jitter(o.B, 0.004); return { Va: v.Va, Vy: v.Vy, y: y * 1000, B: B * 1e4, q: (y * v.Vy) / (CRT.d * B * B * CRT.l * CRT.L), X: (B * B * CRT.d * CRT.l * CRT.L) / v.Vy * 1e16 } },
    sweep: { list: (v) => [12, 15, 18, 22, 26, 30, 34, 38].map((Vy) => { const u = Math.sqrt(2 * EM * v.Va), B = Vy / CRT.d / u, x = 100 * Math.cbrt((4e-7 * CRT.M) / B); return { Vy, x: +x.toFixed(2), mag: true } }) }, need: 3, graph: { x: 'Vy', y: 'B', xl: 'Deflection voltage (V)', yl: 'Balancing field (G)', fit: true }, analyse: (r) => [['e/m', mean(r.map((x) => x.q)), 'C/kg', EM]] },
  { id: 'electric-deflection', title: 'Electric deflection sensitivity', short: 'y against V_y', aim: 'Show that the electron beam deflects in proportion to the deflection voltage and inversely to the accelerating voltage.', formula: 'y = V_y l L / (2 d V_a)', principle: 'A stronger field sweeps the beam further, but a faster beam spends less time between the plates.', steps: ['Remove the magnets.', 'Apply a deflection voltage.', 'Note the spot position.', 'Plot y against V_y.'], controls: [num('Va', 'Accelerating voltage', 600, 1000, 10, 800, 'V'), num('Vy', 'Deflection voltage', 0, 40, 0.5, 20, 'V'), num('x', 'Magnet distance', 8, 15, 0.01, 12, 'cm'), tog('mag', 'Magnets in place', false)], out: emOut, Stage: StageEm, read: (v, o) => [['Spot', o.net.toFixed(2), 'mm']], columns: [['Vy', 'V_y (V)', 1], ['y', 'y (mm)', 2]], sample: (v, o) => (v.mag ? { error: 'Remove the magnets first.' } : { Vy: v.Vy, y: wobble(o.net, 0.03) }), sweep: { k: 'Vy', n: 9 }, graph: { x: 'Vy', y: 'y', xl: 'Deflection voltage (V)', yl: 'Spot deflection (mm)', fit: true }, analyse: (r, v) => { const q = fit(r, 'Vy', 'y'); return q && [['Sensitivity', q.m, 'mm/V', (CRT.l * CRT.L * 1000) / (2 * CRT.d * v.Va)]] } },
]

/* ---------- Quincke's U-tube (PhyUGEx-161) ---------- */
const LQ = { water: { n: 'Water', g0: 0.0756, s: 0.00015, rho: 998 }, eth: { n: 'Ethanol', g0: 0.0241, s: 0.00009, rho: 789 } }
const SAM = { fe: { n: 'Ferrous sulphate', chi: 8.2e-5, rho: 1200 }, ni: { n: 'Nickel ammonium sulphate', chi: 2.9e-5, rho: 1130 } }
const BORE = 1e-3
const Tube = ({ rise, color, wide = 62 }) => (
  <g>
    <rect x="130" y="100" width="20" height="300" fill="rgba(180,210,235,.35)" stroke="#8AA7C2" /><rect x={260} y="100" width={wide} height="300" fill="rgba(180,210,235,.35)" stroke="#8AA7C2" />
    <path d={`M130,400 Q130,440 170,440 H${260 + wide - 40} Q${260 + wide},440 ${260 + wide},400 Z`} fill={color} opacity=".6" />
    <rect x="131" y={300 - rise} width="18" height={100 + rise} fill={color} opacity=".78" />
    <rect x={261} y="300" width={wide - 2} height="100" fill={color} opacity=".78" />
  </g>
)
const Micro = ({ y, label = true }) => (
  <g>
    <rect x="28" y={y - 14} width="84" height="28" rx="4" fill="#3C4660" />
    <line x1="112" x2="152" y1={y} y2={y} stroke={C.t2} strokeWidth="2" strokeDasharray="4 3" />
    {label && <T x={30} y={y - 20} s={10} c={C.ink2}>Travelling microscope</T>}
  </g>
)
export const quincke = [
  { id: 'surface-tension', title: 'Surface tension from capillary rise', short: 'Narrow limb of the U-tube', aim: 'Determine the surface tension of a liquid from its capillary rise in the 2 mm bore limb of the U-tube, using the travelling microscope.', formula: 'T = r ρ g h / 2', principle: 'Surface tension lifts liquid in the narrow limb above the wide limb until the column’s weight balances the upward pull at the meniscus.', steps: ['Fill the U-tube with the liquid.', 'Focus the microscope on each meniscus.', 'Read the level difference.', 'Repeat at other temperatures.'], controls: [sel('l', 'Liquid', Object.entries(LQ).map(([k, a]) => [k, a.n]), 'water'), num('T', 'Temperature', 20, 60, 2, 28, '°C')], out: (v) => { const q = LQ[v.l], g = q.g0 - q.s * v.T; return { g, h: ((2 * g) / (q.rho * 9.78 * BORE)) * 1000 } }, Stage: ({ v, o }) => (<Svg><Bench /><Panel light x={18} y={40} w={420} h={415} t="U-TUBE AND STAND" sub="Acrylic" /><Tube rise={o.h * 7} color="#7AB6E8" /><Micro y={300 - o.h * 7} /><Micro y={300} /><Panel x={470} y={60} w={300} h={260} t="DIGITAL MICROMETER" sub="LC 0.01 mm" /><Lcd x={486} y={110} w={268} value={o.h.toFixed(2)} unit="mm" label="Level difference" /><Lcd x={486} y={190} w={268} value={v.T} unit="°C" label="Temperature" /><Lcd x={486} y={260} w={268} h={40} value={LQ[v.l].n} s={16} /></Svg>), read: (v, o) => [['Rise h', o.h.toFixed(2), 'mm'], ['Surface tension', (o.g * 1000).toFixed(1), 'mN/m']], columns: [['T', 'T (°C)', 0], ['h', 'h (mm)', 2], ['g', 'γ (mN/m)', 2]], sample: (v, o) => { const h = snap(wobble(o.h, 0.012), 0.01); return { T: v.T, h, g: ((BORE * LQ[v.l].rho * 9.78 * h * 1e-3) / 2) * 1000 } }, sweep: { k: 'T', n: 11 }, graph: { x: 'T', y: 'g', xl: 'Temperature (°C)', yl: 'Surface tension (mN/m)', fit: true, zero: false }, analyse: (r, v) => { const q = fit(r, 'T', 'g'), L = LQ[v.l]; return q && [['γ at 25 °C', q.m * 25 + q.c, 'mN/m', (L.g0 - L.s * 25) * 1000], ['Temperature slope', q.m, 'mN/m/K', -L.s * 1000]] } },
  { id: 'magnetic-susceptibility', title: "Quincke's method: susceptibility", short: 'Rise h against B²', aim: 'Determine the volume susceptibility of paramagnetic salt solutions from their rise in a magnetic field.', formula: 'h = χ B² / (2 µ₀ ρ g)', principle: 'The field pulls a paramagnetic liquid into the gap between the poles. The narrow-limb meniscus rises until the extra pressure balances the column.', steps: ['Place the narrow limb between the poles.', 'Focus on the meniscus at zero field.', 'Raise the magnet current in steps.', 'Plot h against B².'], controls: [sel('s', 'Sample', Object.entries(SAM).map(([k, a]) => [k, a.n]), 'fe'), num('I', 'Magnet current', 0, 4, 0.1, 2, 'A')], out: (v) => { const B = 0.6 * Math.tanh(v.I / 2.2), q = SAM[v.s]; return { B, h: ((q.chi * B * B) / (2 * MU0 * q.rho * 9.78)) * 1000 } }, Stage: ({ v, o }) => (<Svg><Bench /><Panel light x={18} y={40} w={420} h={415} t="U-TUBE IN POLE GAP" sub="6 kG max" /><Tube rise={o.h * 45} color={v.s === 'fe' ? '#8DBF87' : '#7DBBD0'} /><rect x="46" y="246" width="82" height="76" fill="#55607A" opacity=".85" /><rect x="152" y="246" width="82" height="76" fill="#55607A" opacity=".85" /><Micro y={300 - o.h * 45} label={false} /><T x={30} y={232} s={10} c={C.ink2}>Travelling microscope</T><Panel x={470} y={60} w={300} h={330} t="GAUSS METER AND SUPPLY" /><Lcd x={486} y={110} w={268} value={(o.B * 10).toFixed(2)} unit="kG" label="Field" /><Lcd x={486} y={190} w={268} value={o.h.toFixed(2)} unit="mm" label="Rise" /><Lcd x={486} y={270} w={268} value={v.I.toFixed(1)} unit="A" label="Current" /></Svg>), read: (v, o) => [['Field', (o.B * 10).toFixed(2), 'kG'], ['Rise', o.h.toFixed(2), 'mm']], columns: [['I', 'I (A)', 1], ['B2', 'B² (T²)', 4], ['h', 'h (mm)', 2]], sample: (v, o) => ({ I: v.I, B2: o.B * o.B, h: Math.max(0, snap(wobble(o.h, 0.008), 0.01)) }), sweep: { k: 'I', n: 11, from: 0.4, to: 4 }, graph: { x: 'B2', y: 'h', xl: 'B² (T²)', yl: 'Rise h (mm)', fit: true }, analyse: (r, v) => { const q = fit(r, 'B2', 'h'), s = SAM[v.s]; return q && [['Susceptibility χ', (q.m * 1e-3 * 2 * MU0 * s.rho * 9.78) * 1e5, '×10⁻⁵', s.chi * 1e5]] } },
]

/* ---------- Zeeman effect (PhyPGEx-103) ---------- */
const DE = 3e-3 // etalon gap
const zShift = (B) => (EM * B) / (2 * TAU * CC) // m^-1 (e B / 4 pi m c)
const zB = (I) => 0.16 * Math.min(I, 8)
function StageZ({ v, o }) {
  const ord = 2 * DE * zShift(o.B)
  const href = usePixels(190, 190, (u, w) => {
    const r2 = sq(u - 0.5) + sq(w - 0.5)
    const m = r2 * 18 + 0.15
    const air = (s) => 1 / (1 + 160 * sq(Math.sin(PI * (m + s))))
    const I = v.pol === 'pi' ? air(0) : v.pol === 'sigma' ? 0.5 * (air(ord) + air(-ord)) : air(0) * 0.5 + 0.25 * (air(ord) + air(-ord))
    const a = clamp(1 - I * 1.2, 0, 1)
    return [245 - 210 * (1 - a) * 0.75, 250 - 30 * (1 - a), 240 - 180 * (1 - a)]
  }, [ord.toFixed(3), v.pol])
  return (
    <Svg>
      <Bench />
      <Panel light x={18} y={40} w={350} h={415} t="OPTICAL TRAIN" />
      <Magnet x={60} y={150} w={270} gap={60} I={o.B} />
      <circle cx="195" cy="150" r="10" fill="url(#g-glow)" />
      <rect x="185" y="245" width="20" height="54" fill={C.glass} stroke="#6FB1D6" />
      <T x={215} y={262} s={10} c={C.ink2}>Filter 546.1 nm</T>
      <rect x="168" y="310" width="54" height="24" rx="4" fill="#E8EEF7" stroke={C.steel} /><T x={232} y={326} s={10} c={C.ink2}>Fabry–Perot etalon</T>
      <rect x="175" y="345" width="40" height="18" rx="4" fill={C.steel} /><T x={225} y={358} s={10} c={C.ink2}>Analyzer</T>
      <rect x="170" y="375" width="50" height="36" rx="6" fill={C.ink2} /><T x={230} y={396} s={10} c={C.ink2}>CMOS camera</T>
      <line x1="195" x2="195" y1="160" y2="375" stroke="#7DC45A" strokeWidth="3" opacity=".7" />
      <Eyepiece cx={585} cy={175} r={135} id="ez" href={href} label="CMOS camera image" />
      <Panel x={420} y={350} w={350} h={102} t="GAUSS METER AND POWER SUPPLY" />
      <Lcd x={434} y={382} w={156} value={(o.B * 10).toFixed(2)} unit="kG" /><Lcd x={602} y={382} w={156} value={v.I.toFixed(1)} unit="A" />
    </Svg>
  )
}
const zCtl = (pol) => [num('I', 'Magnet current', 0, 8, 0.1, 5, 'A'), sel('pol', 'Analyzer', [['sigma', 'σ components'], ['pi', 'π component'], ['all', 'None']], pol)]
const zOut = (v) => { const B = zB(v.I); return { B, dk: zShift(B) } }
export const zeeman = [
  { id: 'zeeman-splitting', title: 'Zeeman splitting against magnetic field', short: 'Rings split with B', aim: 'Observe the splitting of the spectral rings in the Fabry–Perot pattern as the magnetic field rises.', formula: 'Δk = e B / (4π m c)     Δk = (1/2d) · δ(r²) / Δ(r²)', principle: 'A magnetic field splits each line into components. The etalon turns each into a set of rings. The component shift grows in direct proportion to B. The 546.1 nm line is treated here with the normal Zeeman triplet.', steps: ['Set the magnet current.', 'Choose σ components with the analyzer.', 'Measure the ring radii.', 'Plot the wavenumber shift against B.'], controls: zCtl('sigma'), out: zOut, Stage: StageZ, read: (v, o) => [['Field', o.B.toFixed(3), 'T'], ['Δk', o.dk.toFixed(2), 'm⁻¹'], ['Fraction of order', (o.dk * 2 * DE).toFixed(3), '']], columns: [['B', 'B (T)', 3], ['ratio', 'δ(r²)/Δ(r²)', 3], ['dk', 'Δk (m⁻¹)', 2]], sample: (v, o) => { const ratio = jitter(2 * DE * o.dk, 0.006); return v.pol === 'pi' ? { error: 'The π component does not split. Use the σ setting.' } : { B: o.B, ratio, dk: ratio / (2 * DE) } }, sweep: { k: 'I', n: 8, from: 1, to: 8 }, graph: { x: 'B', y: 'dk', xl: 'Magnetic field (T)', yl: 'Wavenumber shift (m⁻¹)', fit: true }, analyse: (r) => { const q = fit(r, 'B', 'dk'); return q && [['Slope', q.m, 'm⁻¹/T', zShift(1)], ['Linearity R²', q.r2.toFixed(4), '']] } },
  { id: 'zeeman-em', title: 'Specific charge e/m from the Zeeman shift', short: 'e/m = 4π c slope', aim: 'Determine e/m of the electron from the measured Zeeman shift.', formula: 'e/m = 4π c × slope(Δk–B)', principle: 'The proportionality constant between wavenumber shift and field contains only fundamental constants, so its slope yields e/m.', steps: ['Collect Δk at several fields.', 'Fit a straight line.', 'Calculate e/m from the slope.'], controls: zCtl('sigma'), out: zOut, Stage: StageZ, read: (v, o) => [['Field', o.B.toFixed(3), 'T'], ['Δk', o.dk.toFixed(2), 'm⁻¹']], columns: [['B', 'B (T)', 3], ['dk', 'Δk (m⁻¹)', 2]], sample: (v, o) => (v.pol === 'pi' ? { error: 'Use the σ setting to measure the split.' } : { B: o.B, dk: jitter(o.dk, 0.006) }), sweep: { k: 'I', n: 8, from: 1, to: 8 }, graph: { x: 'B', y: 'dk', xl: 'Magnetic field (T)', yl: 'Wavenumber shift (m⁻¹)', fit: true }, analyse: (r) => { const q = fit(r, 'B', 'dk'); return q && [['e/m', 2 * TAU * CC * q.m, 'C/kg', EM]] } },
]
