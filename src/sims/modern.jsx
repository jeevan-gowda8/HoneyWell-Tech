import { Svg, T, Bench, Panel, Lcd, C, Scope, Led, Dim, Ray, Eyepiece, Knob } from '../lib/parts'
import { num, sel, tog, TAU, PI, fit, jitter, wobble, sq, snap, clamp, mean, peaks, spacing, sci, curve } from '../lib/math'

/* ---------- Millikan oil drop (PhyPGEx-114) ---------- */
const E = 1.602e-19, RHO = 886, G = 9.78, ETA = 1.81e-5, D = 0.005
const DROPS = [[0.62e-6, 2], [0.72e-6, 3], [0.55e-6, 1], [0.8e-6, 4], [0.68e-6, 2], [0.9e-6, 6]]
const dropInfo = (i) => {
  const [r, n] = DROPS[i]
  const mg = (4 / 3) * PI * r ** 3 * RHO * G
  return { r, n, mg, Vb: (mg * D) / (n * E), vf: (2 * r * r * RHO * G) / (9 * ETA) }
}
function StageM({ v, o, t }) {
  const dr = dropInfo(v.d), bump = o.vel * 4e5
  const y = ((((230 + bump * t) % 400) + 400) % 400)
  const drops = [[150, 90], [420, 340], [240, 300]]
  return (
    <Svg>
      <Bench />
      <Panel light x={18} y={30} w={330} h={420} t="OIL CHAMBER" />
      <rect x="70" y="120" width="226" height="12" fill={C.brass} /><rect x="70" y="330" width="226" height="12" fill={C.brass} />
      {v.on && Array.from({ length: 7 }, (_, i) => <line key={i} x1={90 + i * 32} x2={90 + i * 32} y1="134" y2="328" stroke={C.t1} strokeOpacity=".35" strokeDasharray="5 5" />)}
      <circle cx="183" cy="230" r="6" fill={C.amber} /><T x={183} y={362} s={11} a="middle" c={C.ink2}>Plates 5 mm apart · LED illumination</T>
      <path d="M50,70 h60 l20,24 h-60z" fill={C.ink3} /><T x={120} y={64} s={10} c={C.ink2}>Atomizer</T>
      <Eyepiece cx={560} cy={175} r={140} id="em2" label="30× microscope via Digi-Eye camera">
        <rect x={420} y={35} width={280} height={280} fill="#F7FAFF" />
        {Array.from({ length: 11 }, (_, i) => <line key={'h' + i} x1={420} x2={700} y1={45 + i * 26} y2={45 + i * 26} stroke="#C7D2E3" />)}
        {drops.map(([x, y0], i) => <circle key={i} cx={420 + x * 0.6} cy={35 + (((y0 + (o.vel + 1e-5 * (i + 1)) * 4e5 * 0.6 * t) % 280) + 280) % 280} r="3" fill={C.ink3} />)}
        <circle cx={560} cy={35 + y * 0.7} r="6.5" fill={C.t2} /><circle cx={560} cy={35 + y * 0.7} r="14" fill={C.t2} opacity=".22" />
      </Eyepiece>
      <Panel x={420} y={356} w={360} h={96} t="SUPPLY AND STOP CLOCK" />
      <Lcd x={436} y={392} w={160} value={v.on ? v.V : 0} unit="V" /><Lcd x={606} y={392} w={160} value={(t % 60).toFixed(1)} unit="s" />
      <T x={183} y={410} s={12} a="middle" w={600}>{Math.abs(o.vel) < 1e-7 ? 'Drop is balanced' : o.vel > 0 ? 'Drop is falling' : 'Drop is rising'}</T>
      <T x={183} y={428} s={11} a="middle" c={C.ink2}>Drop {v.d + 1} of {DROPS.length}</T>
      {void dr}
    </Svg>
  )
}
const DROP_OPT = DROPS.map((_, i) => [i, `Drop ${i + 1}`])
export const millikan = [
  {
    id: 'balancing-method', title: 'Balancing drop method', short: 'q from the balance voltage',
    aim: 'Determine the electron charge by balancing charged oil drops in an electric field.',
    formula: 'q = m g d / V     r = √(9 η v_f / (2 ρ g))',
    principle: 'With the field off, a drop falls at terminal speed v_f, which gives its radius and mass. The balancing voltage then gives its charge, and charges come in whole multiples of e.',
    steps: ['Select a drop in the microscope.', 'With the field off, time the fall.', 'Adjust the voltage until the drop is still.', 'Calculate q and find the common factor.'],
    controls: [sel('d', 'Oil drop', DROP_OPT, 0), num('V', 'Plate voltage', 0, 300, 0.5, 150, 'V'), tog('on', 'Field on', true)],
    out: (v) => { const q = dropInfo(v.d), V = v.on ? v.V : 0; return { vel: q.vf * (1 - V / q.Vb), ...q } },
    Stage: StageM,
    read: (v, o) => [['Drop speed', (o.vel * 1e6).toFixed(1), 'µm/s'], ['Status', Math.abs(o.vel) / o.vf < 0.01 ? 'Balanced' : 'Moving', '']],
    tip: 'Adjust the voltage until the highlighted drop stops. Balanced drops show under 1% residual speed.',
    columns: [['d', 'Drop', 0], ['V', 'V (V)', 1], ['q', 'q (×10⁻¹⁹ C)', 2], ['n', 'n', 0]],
    sample: (v, o) => { if (!v.on || Math.abs(o.vel) / o.vf > 0.01) return { error: 'Balance the drop first.' }; const q = (jitter(o.mg, 0.004) * D) / v.V; return { d: v.d + 1, V: v.V, q: q * 1e19, n: Math.round(q / E) } },
    sweep: { list: DROPS.map((_, d) => ({ d, V: Math.round(dropInfo(d).Vb * 2) / 2, on: true })) },
    graph: { x: 'n', y: 'q', xl: 'Number of charges n', yl: 'Charge q (×10⁻¹⁹ C)', fit: true },
    analyse: (r) => [['Elementary charge e', mean(r.map((x) => x.q / x.n)) * 1e-19, 'C', E]],
  },
  {
    id: 'rate-method', title: 'Rate method', short: 'Fall and rise times',
    aim: 'Determine the charge on a drop by timing its free fall and its rise in a field.',
    formula: 'q = (m g d / V)(v_f + v_r) / v_f',
    principle: 'Timing the same drop falling and rising over a known distance gives the charge without needing to balance the drop exactly.',
    steps: ['Set the plate voltage high.', 'Time the fall over 1 mm with the field off.', 'Time the rise over 1 mm with the field on.', 'Calculate q.'],
    controls: [sel('d', 'Oil drop', DROP_OPT, 0), num('V', 'Plate voltage', 0, 300, 1, 280, 'V'), tog('on', 'Field on', true)],
    out: (v) => { const q = dropInfo(v.d), V = v.on ? v.V : 0; return { vel: q.vf * (1 - V / q.Vb), vr: q.vf * (V / q.Vb - 1), ...q } },
    Stage: StageM,
    read: (v, o) => [['Fall speed', (o.vf * 1e6).toFixed(1), 'µm/s'], ['Rise speed', (o.vr * 1e6).toFixed(1), 'µm/s']],
    columns: [['d', 'Drop', 0], ['tf', 't_fall (s)', 1], ['tr', 't_rise (s)', 1], ['q', 'q (×10⁻¹⁹ C)', 2], ['n', 'n', 0]],
    sample: (v, o) => { if (!v.on || o.vr <= 0) return { error: 'The drop must rise. Raise the plate voltage.' }; const tf = jitter(1e-3 / o.vf, 0.003), tr = jitter(1e-3 / o.vr, 0.003), q = (o.mg * D / v.V) * (1 + tf / tr); return { d: v.d + 1, tf, tr, q: q * 1e19, n: Math.round(q / E) } },
    sweep: { list: DROPS.map((_, d) => ({ d, V: 300, on: true })) },
    graph: { x: 'n', y: 'q', xl: 'Number of charges n', yl: 'Charge q (×10⁻¹⁹ C)', fit: true },
    analyse: (r) => [['Elementary charge e', mean(r.map((x) => x.q / x.n)) * 1e-19, 'C', E]],
  },
]

/* ---------- Ultrasonics (PhyPGEx-32) ---------- */
const VA = 343, FT = 40 // air speed, kHz
const LIQ = { water: ['Water', 1482, 998], benz: ['Benzene', 1322, 879], cc: ['CCl₄', 938, 1594] }
const Unit = ({ lines, x = 470 }) => (
  <g>
    <Panel x={x} y={40} w={310} h={410} t="DISTANCE MEASUREMENT UNIT" sub="35–40 kHz" />
    {lines.map(([l, val, u], i) => <Lcd key={l} x={x + 16} y={90 + i * 78} w={278} value={val} unit={u} label={l} />)}
  </g>
)
const Wave = ({ d, t, c = C.t1 }) => (
  <g>
    {Array.from({ length: 6 }, (_, i) => { const r = (t * 180 + i * 50) % 300; return r < (d + 30) ? <path key={i} d={`M${120 + r},${215} m-10,-52 a70,70 0 0 1 0,104`} fill="none" stroke={c} strokeWidth="2" opacity={Math.max(0.12, 1 - r / 300)} /> : null })}
  </g>
)
const Head = () => (<g><rect x="70" y="170" width="50" height="90" rx="8" fill={C.ink2} /><circle cx="120" cy="193" r="12" fill={C.steel} /><circle cx="120" cy="237" r="12" fill={C.steel} /><T x={95} y={160} s={10.5} a="middle" c={C.ink2}>Tx / Rx</T></g>)
const ampR = (r) => 8.5 * sq(0.28 / r)
const dbR = (r) => 20 * Math.log10(ampR(r) / 8.5) + 60
const uStage = (extra, lines) => ({ v, o, t }) => {
  const dx = v.r * 300
  return (
    <Svg>
      <Bench />
      <Panel light x={18} y={40} w={430} h={410} t="TRANSDUCER BENCH" />
      <Head />
      <Wave d={dx} t={t} />
      <rect x={120 + dx} y="150" width="16" height="130" fill={C.t2} />
      <Dim x1={120} y1={320} x2={120 + dx} y2={320} l={`${(v.r * 100).toFixed(0)} cm`} off={-6} />
      {extra && extra({ v, o, t })}
      <Unit lines={lines(v, o)} />
    </Svg>
  )
}
const liqCtl = [sel('l', 'Liquid', Object.entries(LIQ).map(([k, a]) => [k, a[0]]), 'water'), sel('f', 'Crystal frequency', [[1, '1 MHz'], [2, '2 MHz'], [3, '3 MHz']], 2), num('d', 'Reflector distance', 0, 3, 0.005, 0.4, 'mm')]
const intA = (v) => { const lam = LIQ[v.l][1] / (v.f * 1e6) * 1000; const x = (TAU * v.d) / lam; return 20 + 85 / (1 + 16 * sq(Math.sin(x))) * Math.exp(-v.d * 0.12) }
const StageInt = ({ v, o }) => {
  const lam = LIQ[v.l][1] / (v.f * 1e6) * 1000
  const top = 110, bot = 330, gap = v.d * 60
  return (
    <Svg>
      <Bench />
      <Panel light x={18} y={40} w={430} h={410} t="LIQUID CELL · 12 cm³" />
      <rect x="130" y="100" width="170" height="240" fill="#BFE0F4" opacity=".65" stroke={C.ink2} strokeWidth="2" />
      <rect x="130" y={bot} width="170" height="14" fill={C.t2} /><T x={215} y={364} s={11} a="middle" c={C.ink2}>Quartz crystal {v.f} MHz</T>
      <rect x="140" y={bot - gap - 12} width="150" height="12" fill={C.steel} /><rect x="205" y={top - 60} width="20" height={bot - gap - 12 - top + 60} fill={C.ink3} />
      {Array.from({ length: 14 }, (_, i) => <line key={i} x1="138" x2="292" y1={bot - i * (lam / 2) * 60} y2={bot - i * (lam / 2) * 60} stroke={C.t1} opacity={bot - i * (lam / 2) * 60 > bot - gap ? 0.5 : 0} strokeDasharray="4 5" />)}
      <T x={234} y={74} s={11} c={C.ink2}>Micrometer · LC 0.01 mm</T>
      <Panel x={470} y={40} w={310} h={410} t="INTERFEROMETER" />
      <Lcd x={486} y={92} w={278} value={v.d.toFixed(3)} unit="mm" label="Reflector" />
      <Lcd x={486} y={170} w={278} value={o.I.toFixed(1)} unit="µA" label="Crystal current" />
      <Knob x={625} y={320} r={40} val={clamp(o.I / 110, 0, 1)} l="Current meter" />
    </Svg>
  )
}
export const ultrasonic = [
  { id: 'ultrasound-characteristics', title: 'Characteristics of ultrasound', short: 'Signal fall with distance', aim: 'Study how the received ultrasonic signal falls with distance in air.', formula: 'V_rx ∝ 1 / r²', principle: 'For an echo path the received amplitude falls off roughly with the inverse square of the distance to the target.', steps: ['Set the reflector distance.', 'Read the received amplitude.', 'Repeat over the range.', 'Plot V against 1/r².'], controls: [num('r', 'Distance', 0.28, 1, 0.01, 0.5, 'm')], out: (v) => ({ a: ampR(v.r) }), Stage: uStage(null, (v, o) => [['Received signal', o.a.toFixed(3), 'V'], ['Signal level', dbR(v.r).toFixed(1), 'dB'], ['Clock', FT.toFixed(0), 'kHz']]), read: (v, o) => [['Signal', o.a.toFixed(3), 'V']], columns: [['r', 'r (m)', 2], ['x', '1/r² (m⁻²)', 2], ['a', 'V (V)', 3]], sample: (v, o) => ({ r: v.r, x: 1 / sq(v.r), a: wobble(o.a, 0.01) }), sweep: { k: 'r', n: 9 }, graph: { x: 'x', y: 'a', xl: '1/r² (m⁻²)', yl: 'Received signal (V)', fit: true }, analyse: (r) => { const f = fit(r, 'x', 'a'); return f && [['Slope', f.m, 'V·m²'], ['Linearity R²', f.r2.toFixed(4), '']] } },
  { id: 'ultrasonic-distance', title: 'Distance measurement', short: 'Echo time of flight', aim: 'Measure distance using the ultrasonic transducers and the echo time of flight.', formula: 'd = v t / 2', principle: 'A 40 kHz burst travels to the target and back. Half of the round-trip time, multiplied by the speed of sound, gives the distance.', steps: ['Place the target.', 'Trigger a burst.', 'Note the echo delay.', 'Compare the measured distance.'], controls: [num('r', 'Target distance', 0.28, 1, 0.01, 0.6, 'm'), num('T', 'Air temperature', 15, 40, 1, 20, '°C')], out: (v) => { const c = 331.3 + 0.606 * v.T; return { c, tof: (2 * v.r) / c } }, Stage: uStage(({ o }) => <Scope x={36} y={350} w={392} h={90} title="ECHO" n={300} tr={[{ f: (u) => (u < 0.06 ? 0.9 * Math.sin(u * 700) : Math.exp(-sq((u - o.tof * 100 / 1 / 0.8) * 26)) * 0.8 * Math.sin(u * 700)) }]} />, (v, o) => [['Echo time', (o.tof * 1000).toFixed(3), 'ms'], ['Measured', (((o.tof * VA) / 2) * 100).toFixed(1), 'cm'], ['Air speed', o.c.toFixed(1), 'm/s']]), read: (v, o) => [['Echo time', (o.tof * 1000).toFixed(3), 'ms']], columns: [['r', 'd (m)', 2], ['tof', 't (ms)', 3]], sample: (v, o) => ({ r: v.r, tof: jitter(o.tof, 0.003) * 1000 }), sweep: { k: 'r', n: 9 }, graph: { x: 'tof', y: 'r', xl: 'Echo time (ms)', yl: 'Distance (m)', fit: true }, analyse: (r, v) => { const f = fit(r, 'tof', 'r'); return f && [['Sound speed', 2000 * f.m, 'm/s', 331.3 + 0.606 * v.T]] } },
  { id: 'object-detection', title: 'Object detection', short: 'Threshold and buzzer', aim: 'Detect an object when its echo exceeds the threshold and sounds the buzzer.', formula: 'Detect if V_echo > V_threshold', principle: 'The echo signal is compared with a preset threshold from 0 to 9 V. Nearer objects return a stronger echo and trigger the buzzer.', steps: ['Set the threshold.', 'Move the target.', 'Note when the buzzer sounds.', 'Find the detection range.'], controls: [num('r', 'Object distance', 0.28, 1, 0.01, 0.5, 'm'), num('th', 'Threshold', 0, 9, 0.1, 1.5, 'V')], out: (v) => { const a = ampR(v.r); return { a, det: a > v.th } }, Stage: uStage(({ o }) => <Led x={330} y={100} r={14} on={o.det} c={C.red} l="Buzzer" lc={C.ink2} />, (v, o) => [['Echo', o.a.toFixed(2), 'V'], ['Threshold', v.th.toFixed(1), 'V'], ['Object', o.det ? 'DETECTED' : 'NONE', '']]), read: (v, o) => [['Echo', o.a.toFixed(2), 'V'], ['Detection', o.det ? 'Yes' : 'No', '']], columns: [['r', 'r (m)', 2], ['a', 'Echo (V)', 2], ['det', 'Buzzer', 0], ['flag', 'Detect', 0]], sample: (v, o) => ({ r: v.r, a: o.a, det: o.det ? 'On' : 'Off', flag: o.det ? 1 : 0 }), sweep: { k: 'r', n: 15 }, graph: { x: 'r', y: 'a', xl: 'Distance (m)', yl: 'Echo (V)', curve: () => curve(ampR, 0.28, 1) }, analyse: (r, v) => { const d = r.filter((x) => x.flag); return d.length ? [['Detection range', Math.max(...d.map((x) => x.r)), 'm', 0.28 * Math.sqrt(8.5 / v.th)]] : [['Status', 'Nothing detected', '']] } },
  { id: 'velocity-liquid', title: 'Velocity of ultrasound in a liquid', short: 'Ultrasonic interferometer', aim: 'Determine the velocity of ultrasonic waves in a non-electrolytic liquid using the interferometer.', formula: 'v = f λ     Δd = λ / 2', principle: 'A standing wave forms when the reflector distance is a whole number of half-wavelengths. The crystal current peaks each time, so the spacing between peaks gives λ/2.', steps: ['Fill the cell with the liquid.', 'Slowly move the reflector.', 'Note micrometer readings at current maxima.', 'Calculate v = f λ.'], controls: liqCtl, out: (v) => ({ I: intA(v) }), Stage: StageInt, read: (v, o) => [['Crystal current', o.I.toFixed(1), 'µA']], columns: [['d', 'd (mm)', 3], ['I', 'I (µA)', 2]], sample: (v, o) => ({ d: v.d, I: wobble(o.I, 0.2) }), sweep: { k: 'd', n: 121, to: 2.4 }, need: 30, graph: { x: 'd', y: 'I', xl: 'Reflector distance (mm)', yl: 'Crystal current (µA)', curve: (v) => curve((d) => intA({ ...v, d }), 0, 3, 500), live: (v) => [v.d, intA(v)] }, analyse: (r, v) => { const p = peaks(r, 'd', 'I', 3, 40); if (p.length < 2) return [['Peaks found', String(p.length), '']]; const half = spacing(p, 'd'); return [['λ/2', half, 'mm', (LIQ[v.l][1] / (v.f * 1e6) / 2) * 1000], ['Velocity v', 2 * half * 1e-3 * v.f * 1e6, 'm/s', LIQ[v.l][1]]] } },
  { id: 'compressibility', title: 'Compressibility of the liquid', short: 'β = 1 / (ρ v²)', aim: 'Determine the adiabatic compressibility of the liquid from its ultrasonic velocity.', formula: 'β = 1 / (ρ v²)', principle: 'Sound speed in a fluid depends on density and stiffness, so a measured velocity gives the compressibility directly.', steps: ['Measure the velocity with the interferometer.', 'Take the density of the liquid.', 'Calculate β.'], controls: liqCtl, out: (v) => ({ I: intA(v) }), Stage: StageInt, read: (v, o) => [['Crystal current', o.I.toFixed(1), 'µA'], ['Density', LIQ[v.l][2], 'kg/m³']], columns: [['d', 'd (mm)', 3], ['I', 'I (µA)', 2]], sample: (v, o) => ({ d: v.d, I: wobble(o.I, 0.2) }), sweep: { k: 'd', n: 121, to: 2.4 }, need: 30, graph: { x: 'd', y: 'I', xl: 'Reflector distance (mm)', yl: 'Crystal current (µA)' }, analyse: (r, v) => { const p = peaks(r, 'd', 'I', 3, 40); if (p.length < 2) return [['Peaks found', String(p.length), '']]; const u = 2 * spacing(p, 'd') * 1e-3 * v.f * 1e6, rho = LIQ[v.l][2]; return [['Velocity', u, 'm/s', LIQ[v.l][1]], ['Compressibility β', 1 / (rho * u * u), 'Pa⁻¹', 1 / (rho * sq(LIQ[v.l][1]))]] } },
]
