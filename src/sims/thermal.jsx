import { Svg, T, Bench, Panel, Lcd, LcdText, Led, C, Wire, Scope, Jack, Dim, Knob, Eyepiece } from '../lib/parts'
import { num, sel, tog, TAU, PI, fit, jitter, wobble, sq, snap, clamp, curve, mean, peaks, spacing } from '../lib/math'

const Kettle = ({ x = 60, T: temp, children }) => (
  <g>
    <path d={`M${x},270 L${x + 16},450 H${x + 174} L${x + 190},270 Z`} fill="rgba(170,205,235,.55)" stroke="#7E9CB9" strokeWidth="2" />
    <rect x={x + 6} y="318" width="178" height="130" fill={`rgba(${70 + temp * 1.8},${140 - temp * 0.5},${225 - temp * 1.5},.34)`} />
    {temp > 55 && Array.from({ length: 6 }, (_, i) => <circle key={i} cx={x + 30 + i * 26} cy={330 + ((i * 37) % 90)} r={2 + (i % 3)} fill="#fff" opacity=".8" />)}
    {children}
    <T x={x + 95} y={478} s={11} a="middle" c={C.ink2}>Kettle · 1 L · 1000 W</T>
  </g>
)

/* ---------- Fermi energy of copper (PhyUGEx-101) ---------- */
const R20 = 5.35, ALPHA = 0.00393, LEN = 10, AREA = 3.14e-8
const R = (T) => R20 * (1 + ALPHA * (T - 20))
const EF_FROM = (dRdT) => { // dR/dT in ohm per K
  const drho = (dRdT * AREA) / LEN, e2 = sq(1.602e-19), m = 9.11e-31, k = 1.381e-23
  const vF = (drho * e2 * 36) / (m * PI * k) // Y*a effective lattice stiffness 36 N/m
  return (0.5 * m * vF * vF) / 1.602e-19
}
export const fermi = [{
  id: 'fermi-energy-copper', title: 'Fermi energy of copper', short: 'From R against T',
  aim: 'Determine the Fermi energy of copper from the variation of the resistance of a copper coil with temperature.',
  formula: 'v_F = (dρ/dT) e² (Ya) / (π m k)     E_F = ½ m v_F²',
  principle: 'Conduction electrons at the Fermi speed scatter off thermally vibrating ions. Resistivity therefore rises linearly with temperature, and the slope gives v_F and E_F. The lattice constant Ya is taken as 36 N/m.',
  steps: ['Place the copper coil in the heated water.', 'Pass a constant current through the coil.', 'As the temperature changes, note the voltage across it.', 'Plot R against T and calculate E_F.'],
  controls: [num('T', 'Water temperature', 30, 95, 1, 45, '°C'), num('I', 'Constant current', 2, 20, 1, 10, 'mA')],
  out: (v) => ({ R: R(v.T), V: R(v.T) * v.I }),
  Stage: ({ v, o, t }) => (
    <Svg>
      <Bench y={460} />
      <Kettle T={v.T}>
        <rect x="140" y="170" width="30" height="240" rx="12" fill="rgba(200,225,245,.75)" stroke="#7E9CB9" />
        {Array.from({ length: 16 }, (_, i) => <rect key={i} x="143" y={290 + i * 7} width="24" height="4" rx="2" fill="url(#g-copper)" />)}
        <line x1="95" x2="95" y1="170" y2="400" stroke={C.ink2} strokeWidth="4" /><T x={92} y={162} s={10} a="middle" c={C.ink2}>Probe</T>
      </Kettle>
      <Wire d="M150,170 V120 H470" on t={t} c={C.copper} /><Wire d="M160,170 V140 H470" c={C.copper} />
      <Panel x={470} y={50} w={310} h={395} t="FERMI ENERGY KIT" />
      <Lcd x={486} y={100} w={278} value={v.I.toFixed(1)} unit="mA" label="Constant current" />
      <Lcd x={486} y={178} w={278} value={o.V.toFixed(2)} unit="mV" label="Digital milli-voltmeter" />
      <Lcd x={486} y={256} w={278} value={v.T.toFixed(1)} unit="°C" label="Probe thermometer" />
      <Lcd x={486} y={334} w={278} value={o.R.toFixed(4)} unit="Ω" label="Calculated R" />
    </Svg>
  ),
  read: (v, o) => [['Resistance', o.R.toFixed(4), 'Ω'], ['Voltage', o.V.toFixed(2), 'mV']],
  columns: [['T', 'T (°C)', 0], ['V', 'V (mV)', 2], ['R', 'R (Ω)', 4]],
  sample: (v, o) => { const V = wobble(o.V, 0.02); return { T: v.T, V, R: V / v.I } },
  sweep: { k: 'T', n: 14 },
  graph: { x: 'T', y: 'R', xl: 'Temperature (°C)', yl: 'Resistance (Ω)', fit: true, zero: false },
  analyse: (r) => { const f = fit(r, 'T', 'R'); return f && [['dR/dT', f.m, 'Ω/K'], ['Fermi energy E_F', EF_FROM(f.m), 'eV', 7.0]] },
}]

/* ---------- Curie temperature (PhyPGEx-61) ---------- */
const TC = 78
const curie = (T, V) => 50 * V * (0.12 + 0.88 / (1 + Math.exp((T - TC) / 2.6)))
export const curieKit = [{
  id: 'curie-temperature', title: 'Curie temperature of Ni–Fe alloy', short: 'Secondary voltage collapse',
  aim: 'Determine the Curie temperature of a ferromagnetic Ni–Fe alloy from the fall in its magnetic coupling on heating.',
  formula: 'T_C = temperature of steepest fall in V_s',
  principle: 'The ferrite core couples primary to secondary. Above the Curie temperature the alloy turns paramagnetic, permeability collapses, and the induced secondary voltage drops sharply.',
  steps: ['Apply AC to the primary.', 'Warm the sample in the kettle.', 'Note the secondary voltage at each temperature.', 'Find the temperature of steepest fall.'],
  controls: [num('T', 'Sample temperature', 30, 100, 1, 50, '°C'), num('V', 'Primary drive', 1, 5, 0.5, 3, 'V')],
  out: (v) => ({ Vs: curie(v.T, v.V) }),
  Stage: ({ v, o, t }) => (
    <Svg>
      <Bench y={460} />
      <Kettle T={v.T}>
        <circle cx="155" cy="370" r="48" fill="none" stroke="#6A7590" strokeWidth="18" />
        {Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * TAU; return <line key={i} x1={155 + Math.cos(a) * 36} y1={370 + Math.sin(a) * 36} x2={155 + Math.cos(a) * 60} y2={370 + Math.sin(a) * 60} stroke={i < 11 ? C.t2 : C.t1} strokeWidth="2.4" /> })}
        <T x={155} y={374} s={10} a="middle" c={C.ink2}>Core</T>
      </Kettle>
      <Wire d="M155,322 V120 H470" on t={t} /><Wire d="M180,330 V150 H470" />
      <Panel x={470} y={50} w={310} h={395} t="CURIE TEMPERATURE KIT" />
      <Lcd x={486} y={100} w={278} value={v.V.toFixed(1)} unit="V" label="Primary (AC)" />
      <Lcd x={486} y={178} w={278} value={o.Vs.toFixed(1)} unit="mV" label="Secondary" />
      <Lcd x={486} y={256} w={278} value={v.T.toFixed(1)} unit="°C" label="Digital thermostat" />
      <Scope x={486} y={330} w={278} h={102} title="SECONDARY" tr={[{ f: (u) => (o.Vs / (50 * v.V)) * 0.9 * Math.sin(TAU * 4 * u + t * 3) }]} />
    </Svg>
  ),
  read: (v, o) => [['Secondary', o.Vs.toFixed(1), 'mV'], ['Temperature', v.T.toFixed(0), '°C']],
  columns: [['T', 'T (°C)', 0], ['Vs', 'V_s (mV)', 1]],
  sample: (v, o) => ({ T: v.T, Vs: wobble(o.Vs, 0.2) }),
  sweep: { k: 'T', n: 36 }, need: 12,
  graph: { x: 'T', y: 'Vs', xl: 'Temperature (°C)', yl: 'Secondary voltage (mV)', curve: (v) => curve((x) => curie(x, v.V), 30, 100), live: (v) => [v.T, curie(v.T, v.V)] },
  analyse: (r) => {
    const s = [...r].sort((a, b) => a.T - b.T)
    let best = 0, Tc = 0
    for (let i = 2; i < s.length - 2; i++) { const g = (s[i - 2].Vs - s[i + 2].Vs) / (s[i + 2].T - s[i - 2].T); if (g > best) { best = g; Tc = s[i].T } }
    return [['Curie temperature', Tc, '°C', TC]]
  },
}]

/* ---------- Angstrom (PhyUGEx-201) ---------- */
const DCU = 1.12e-4, HLOSS = 0.002, RC = 8960 * 385
const wave = (P) => {
  const w = TAU / P, m = Math.hypot(HLOSS, w) / DCU
  const ang = Math.atan2(w, HLOSS) / 2
  return { w, a: Math.sqrt(m) * Math.cos(ang), b: Math.sqrt(m) * Math.sin(ang) }
}
export const angstrom = [{
  id: 'angstrom-method', title: "Thermal conductivity by Angstrom's method", short: 'Heat waves along the rod',
  aim: 'Determine the thermal conductivity of copper from the attenuation and phase lag of a periodic heat wave.',
  formula: 'D = x² / (2 Δt ln(A₁/A₂))     K = D ρ c',
  principle: 'Periodic heating at one end sends a damped temperature wave along the rod. The product of the amplitude decay and the time lag between two points gives the diffusivity, and surface losses cancel out.',
  steps: ['Run the heater with a fixed period.', 'Watch the four sensor traces.', 'Note the amplitudes and time lag for a sensor pair.', 'Plot 2Δt ln(A₁/A₂) against x² and calculate K.'],
  controls: [num('P', 'Heating period', 30, 180, 5, 80, 's'), sel('sep', 'Sensor separation', [[80, '80 mm'], [160, '160 mm'], [240, '240 mm']], 80)],
  out: (v) => { const q = wave(v.P), x = v.sep / 1000; return { ...q, ratio: Math.exp(q.a * x), dt: (q.b * x) / q.w } },
  Stage: ({ v, o, t }) => {
    const tt = t * 24
    const Ti = (i, tm) => 42 + 8 * Math.exp(-o.a * (0.08 * (i + 1))) * Math.sin(o.w * tm - o.b * (0.08 * (i + 1)))
    return (
      <Svg>
        <Bench />
        <Panel light x={18} y={30} w={764} h={140} t="COPPER ROD · Ø 12.5 mm · 400 mm" />
        <rect x="80" y="86" width="640" height="26" rx="8" fill="url(#g-copper)" stroke="#8A4C24" />
        <rect x="40" y="76" width="52" height="46" rx="6" fill={C.red} opacity={0.5 + 0.45 * Math.sin(o.w * tt)} /><T x={66} y={70} s={10} a="middle" c={C.ink2}>Heater</T>
        {[0, 1, 2, 3].map((i) => <g key={i}><line x1={208 + i * 128} x2={208 + i * 128} y1="60" y2="86" stroke={[C.t1, C.t2, C.t3, C.t4][i]} strokeWidth="3" /><circle cx={208 + i * 128} cy="86" r="4" fill={[C.t1, C.t2, C.t3, C.t4][i]} /><T x={208 + i * 128} y={136} s={11} a="middle" w={600}>S{i + 1} · {Ti(i, tt).toFixed(1)}°</T></g>)}
        <Dim x1={208} y1={150} x2={336} y2={150} l="80 mm" off={-6} />
        <Scope x={18} y={182} w={510} h={270} title="4-CHANNEL THERMOMETER" tr={[0, 1, 2, 3].map((i) => ({ f: (u) => (Ti(i, tt - 2 * v.P + u * 2 * v.P) - 42) / 9, l: `S${i + 1}` }))} />
        <Panel x={540} y={182} w={242} h={270} t="MEASURED" />
        <Lcd x={554} y={230} w={214} value={o.ratio.toFixed(3)} label="A₁ / A₂" /><Lcd x={554} y={306} w={214} value={o.dt.toFixed(2)} unit="s" label="Time lag Δt" /><Lcd x={554} y={382} w={214} value={v.sep} unit="mm" label="Separation" />
      </Svg>
    )
  },
  read: (v, o) => [['A₁ / A₂', o.ratio.toFixed(3), ''], ['Time lag', o.dt.toFixed(2), 's']],
  columns: [['sep', 'x (mm)', 0], ['ratio', 'A₁/A₂', 3], ['dt', 'Δt (s)', 2], ['x2', 'x² (m²)', 4], ['y', '2Δt ln(A₁/A₂)', 2]],
  sample: (v, o) => { const ratio = jitter(o.ratio, 0.002), dt = jitter(o.dt, 0.004), x = v.sep / 1000; return { sep: v.sep, ratio, dt, x2: x * x, y: 2 * dt * Math.log(ratio) } },
  sweep: { list: [80, 160, 240, 80, 160, 240].map((sep) => ({ sep })) },
  graph: { x: 'x2', y: 'y', xl: 'x² (m²)', yl: '2Δt ln(A₁/A₂) (s)', fit: true },
  analyse: (r) => { const f = fit(r, 'x2', 'y'); if (!f) return null; const D = 1 / f.m; return [['Diffusivity D', D * 1e4, 'cm²/s', DCU * 1e4], ['Thermal conductivity K', D * RC, 'W/m·K', DCU * RC]] },
}]

/* ---------- Seebeck / Peltier (PhyUGEx-250) ---------- */
const SB = 0.05, PR = 2, PK = 0.5
const Module = ({ hot, cold, flow, t, I }) => {
  const heat = (x) => `rgb(${clamp(150 + x * 2, 0, 255)},${clamp(150 - Math.abs(x) * 0.6, 60, 200)},${clamp(150 - x * 2, 0, 255)})`
  return (
    <g>
      <rect x="110" y="110" width="200" height="110" rx="4" fill={heat(hot - 40)} /><T x={210} y={105} s={12} a="middle" w={600}>Heat sink A · {hot.toFixed(1)} °C</T>
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={115 + i * 20} y="112" width="10" height="106" fill="rgba(255,255,255,.32)" />)}
      <rect x="110" y="222" width="200" height="16" fill="#F1F3F7" stroke={C.steel} />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={116 + i * 19.4} y="224" width="12" height="12" fill={i % 2 ? C.t1 : C.t2} />)}
      <T x={318} y={258} s={11} c={C.ink2}>Peltier module</T>
      <rect x="110" y="240" width="200" height="110" rx="4" fill={heat(cold - 40)} /><T x={210} y={372} s={12} a="middle" w={600}>Heat sink B · {cold.toFixed(1)} °C</T>
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={115 + i * 20} y="242" width="10" height="106" fill="rgba(255,255,255,.32)" />)}
      <Wire d="M110,230 H60 V410 H470" on={flow} t={t} /><Wire d="M310,230 H380 V380 H470" on={flow} t={t * (I < 0 ? -1 : 1)} />
    </g>
  )
}
export const seebeck = [
  {
    id: 'seebeck-effect', title: 'Seebeck effect', short: 'V against ΔT',
    aim: 'Measure the thermoelectric voltage against temperature difference and determine the Seebeck coefficient.',
    formula: 'V = S ΔT',
    principle: 'A temperature difference across a thermoelectric junction drives carriers from hot to cold, producing an open-circuit voltage proportional to ΔT.',
    steps: ['Heat one sink.', 'Let the temperatures settle.', 'Note ΔT and the voltage.', 'Plot V against ΔT.'],
    controls: [num('Th', 'Heater side', 30, 85, 1, 55, '°C'), num('Tc', 'Cold side', 20, 30, 1, 25, '°C')],
    out: (v) => ({ dT: v.Th - v.Tc, V: SB * (v.Th - v.Tc) }),
    Stage: ({ v, o, t }) => (
      <Svg><Bench /><Panel light x={40} y={50} w={390} h={400} t="PELTIER MODULE ASSEMBLY" sub="Thermal wool" /><Module hot={v.Th} cold={v.Tc} flow t={t} I={1} />
        <Panel x={470} y={70} w={310} h={380} t="SEEBECK KIT" /><Lcd x={486} y={120} w={278} value={o.V.toFixed(3)} unit="V" label="Digital voltmeter" /><Lcd x={486} y={198} w={278} value={v.Th.toFixed(1)} unit="°C" label="Temperature CH1" /><Lcd x={486} y={276} w={278} value={v.Tc.toFixed(1)} unit="°C" label="Temperature CH2" /><Lcd x={486} y={354} w={278} value={o.dT.toFixed(1)} unit="°C" label="ΔT" /></Svg>
    ),
    read: (v, o) => [['ΔT', o.dT.toFixed(1), '°C'], ['Voltage', o.V.toFixed(3), 'V']],
    columns: [['dT', 'ΔT (°C)', 1], ['V', 'V (V)', 3]],
    sample: (v, o) => ({ dT: o.dT, V: wobble(o.V, 0.004) }),
    sweep: { k: 'Th', n: 10, from: 32, to: 85 },
    graph: { x: 'dT', y: 'V', xl: 'ΔT (°C)', yl: 'Voltage (V)', fit: true },
    analyse: (r) => { const f = fit(r, 'dT', 'V'); return f && [['Seebeck coefficient', f.m * 1000, 'mV/K', SB * 1000]] },
  },
  {
    id: 'peltier-effect', title: 'Peltier effect', short: 'Pumping heat with current',
    aim: 'Show that a current through the module transfers heat, and determine the Peltier coefficient.',
    formula: 'ΔT/I = (S T − ½ I R) / K',
    principle: 'Current pumps heat from one sink to the other, with the direction set by polarity. Joule heating opposes it at high currents, so ΔT reaches a maximum.',
    steps: ['Apply a supply voltage.', 'Let the sinks reach steady state.', 'Note the current and ΔT.', 'Reverse polarity and observe the swap.'],
    controls: [num('V', 'Supply voltage', 0, 12, 0.2, 5, 'V'), tog('rev', 'Reverse polarity', false)],
    out: (v) => { const I = v.V / PR, dT = (SB * 298 * I - 0.5 * I * I * PR) / PK / 8; return { I, dT } },
    Stage: ({ v, o, t }) => { const s = v.rev ? -1 : 1, A = 28 + (s * o.dT) / 2 + o.I * 1.1, B = 28 - (s * o.dT) / 2 + o.I * 1.1; return (
      <Svg><Bench /><Panel light x={40} y={50} w={390} h={400} t="PELTIER MODULE ASSEMBLY" /><Module hot={A} cold={B} flow={v.V > 0} t={t} I={s} />
        <Panel x={470} y={70} w={310} h={380} t="REGULATED SUPPLY · UP TO 12 V" /><Lcd x={486} y={120} w={278} value={v.V.toFixed(1)} unit="V" label="Voltage" /><Lcd x={486} y={198} w={278} value={o.I.toFixed(2)} unit="A" label="Digital ammeter" /><Lcd x={486} y={276} w={278} value={o.dT.toFixed(1)} unit="°C" label="|ΔT| at steady state" /><Lcd x={486} y={354} w={278} value={v.rev ? 'B HOT' : 'A HOT'} label="Hot side" s={18} /></Svg>
    ) },
    read: (v, o) => [['Current', o.I.toFixed(2), 'A'], ['ΔT', o.dT.toFixed(1), '°C']],
    columns: [['I', 'I (A)', 2], ['dT', 'ΔT (°C)', 2], ['q', 'ΔT/I', 3]],
    sample: (v, o) => { const dT = wobble(o.dT, 0.03); return v.V <= 0 ? { error: 'Apply a supply voltage first.' } : { I: o.I, dT, q: dT / o.I } },
    sweep: { k: 'V', n: 12, from: 1, to: 12 },
    graph: { x: 'I', y: 'dT', xl: 'Current (A)', yl: 'ΔT (°C)', curve: () => curve((I) => (SB * 298 * I - 0.5 * I * I * PR) / PK / 8, 0, 6) },
    analyse: (r) => { const f = fit(r, 'I', 'q'); return f && [['Peltier coefficient Π', f.c * PK * 8, 'V', SB * 298]] },
  },
]

/* ---------- Dielectric constant (PhyUGEx-105) ---------- */
const E0 = 8.854e-12, CYL = (TAU * E0) / Math.log(20 / 15)
const LIQ = { eth: ['Ethanol', 24.5], ace: ['Acetone', 20.7], met: ['Methanol', 32.7] }
const SOL = { gl: ['Glass', 6.0], pp: ['Perspex', 3.4], bk: ['Bakelite', 4.5] }
const AP = PI * sq(0.06)
const cSolid = (eps, d) => (E0 * AP) / (0.002 / eps + (d - 0.002)) * 1e12
export const dielectric = [
  {
    id: 'polar-liquid', title: 'Dielectric constant of a polar liquid', short: 'Concentric cylinders',
    aim: 'Determine the dielectric constant of a polar liquid from the capacitance of a partly filled cylindrical cell.',
    formula: 'C(h) = C₀ + 2π ε₀ (ε − 1) h / ln(b/a)',
    principle: 'As liquid replaces air between the cylinders the capacitance rises in proportion to the depth, with slope set by the liquid’s dielectric constant.',
    steps: ['Choose the liquid.', 'Fill to a graduated level.', 'Note the capacitance.', 'Plot C against level.'],
    controls: [sel('l', 'Liquid sample', Object.entries(LIQ).map(([k, a]) => [k, a[0]]), 'eth'), num('h', 'Liquid level', 0, 150, 5, 60, 'mm')],
    out: (v) => { const e = LIQ[v.l][1]; return { C: (CYL * (e - 1) * (v.h / 1000) + CYL * 0.15) * 1e12 + 4 } },
    Stage: ({ v, o }) => (
      <Svg><Bench /><Panel light x={40} y={40} w={320} h={415} t="CONCENTRIC CYLINDERS" />
        <rect x="120" y="100" width="160" height="320" fill="#fff" stroke={C.ink2} strokeWidth="3" /><rect x="123" y={420 - v.h * 2.1} width="154" height={v.h * 2.1} fill="#A5D4F2" opacity=".75" /><rect x="170" y="85" width="60" height="330" fill="url(#g-metal)" stroke={C.ink2} />
        {Array.from({ length: 8 }, (_, i) => <g key={i}><line x1="280" x2="294" y1={420 - i * 42} y2={420 - i * 42} stroke={C.ink2} /><T x={298} y={424 - i * 42} s={10} c={C.ink2}>{i * 20}</T></g>)}
        <Panel x={400} y={110} w={370} h={230} t="DIGITAL CAPACITANCE METER" sub="1 pF – 1000 pF" /><Lcd x={416} y={170} w={338} h={92} value={o.C.toFixed(1)} unit="pF" s={42} /><T x={585} y={300} s={13} a="middle" c={C.silk2}>{LIQ[v.l][0]} · level {v.h} mm</T></Svg>
    ),
    read: (v, o) => [['Capacitance', o.C.toFixed(1), 'pF']],
    columns: [['h', 'h (mm)', 0], ['C', 'C (pF)', 1]],
    sample: (v, o) => ({ h: v.h, C: wobble(o.C, 0.4) }),
    sweep: { k: 'h', n: 11, from: 10, to: 150 },
    graph: { x: 'h', y: 'C', xl: 'Liquid level (mm)', yl: 'Capacitance (pF)', fit: true },
    analyse: (r, v) => { const f = fit(r, 'h', 'C'); return f && [['Dielectric constant ε', 1 + (f.m * 1e-12 * 1000) / CYL, '', LIQ[v.l][1]]] },
  },
  {
    id: 'solid-dielectric', title: 'Dielectric constant of solids', short: 'Parallel plates, variable gap',
    aim: 'Determine the dielectric constant of solid samples using the parallel-plate arrangement.',
    formula: '1/C = [d − t(1 − 1/ε)] / (ε₀ A)',
    principle: 'With a sample of thickness t between plates, 1/C varies linearly with the gap d. The intercept reveals how much the sample changes the effective spacing.',
    steps: ['Choose a solid sample.', 'Set the plate gap.', 'Note the capacitance.', 'Plot 1/C against d.'],
    controls: [sel('s', 'Solid sample', Object.entries(SOL).map(([k, a]) => [k, a[0]]), 'gl'), num('d', 'Plate gap', 2.2, 8, 0.1, 3.5, 'mm')],
    out: (v) => ({ C: cSolid(SOL[v.s][1], v.d / 1000) }),
    Stage: ({ v, o }) => { const g = v.d * 18; return (
      <Svg><Bench /><Panel light x={40} y={40} w={320} h={415} t="PARALLEL PLATES" /><rect x="90" y="150" width="220" height="16" fill={C.brass} stroke="#9B7B2C" /><rect x="90" y={166 + g} width="220" height="16" fill={C.brass} stroke="#9B7B2C" /><rect x="90" y={166 + g - 36} width="220" height="36" fill="#BFD6C2" stroke="#7AA587" /><T x={200} y={166 + g - 13} s={11} a="middle" w={600}>{SOL[v.s][0]} · 2 mm</T><T x={200} y={120} s={13} a="middle" w={600}>Gap {v.d.toFixed(1)} mm</T>
        <Panel x={400} y={110} w={370} h={230} t="DIGITAL CAPACITANCE METER" /><Lcd x={416} y={170} w={338} h={92} value={o.C.toFixed(1)} unit="pF" s={42} /></Svg>
    ) },
    read: (v, o) => [['Capacitance', o.C.toFixed(1), 'pF'], ['1/C', (1 / o.C).toFixed(5), '1/pF']],
    columns: [['d', 'd (mm)', 1], ['C', 'C (pF)', 2], ['inv', '1/C (1/pF)', 5]],
    sample: (v, o) => { const C = jitter(o.C, 0.001); return { d: v.d, C, inv: 1 / C } },
    sweep: { k: 'd', n: 9 },
    graph: { x: 'd', y: 'inv', xl: 'Gap d (mm)', yl: '1/C (1/pF)', fit: true },
    analyse: (r, v) => { const f = fit(r, 'd', 'inv'); return f && [['Dielectric constant ε', 1 / (1 + f.c / (f.m * 2)), '', SOL[v.s][1]]] },
  },
]

/* ---------- Franck–Hertz (PhyUGEx-256, PhyPGEx-17) ---------- */
export const EX = 18.7, V0 = 3
export const fh = (V, Vf = 7.5, Vr = 4) => {
  const em = (V - V0) / EX, fr = em - Math.floor(em)
  if (V < V0) return 0
  const s = fr < 0.78 ? fr / 0.78 : (1 - fr) / 0.22
  const base = 0.033 * Math.pow(V, 1.28) * (0.32 + 0.68 * s) * Math.pow(Vf / 7.5, 2)
  return Math.max(0, base * 9.5 - Vr * 2.4 * (1 - fr * 0.2))
}
function StageFh({ v, o, t }) {
  const bands = Math.floor((v.V - V0) / EX + 0.25)
  return (
    <Svg>
      <Bench />
      <Panel light x={18} y={30} w={410} h={420} t="NEON FRANCK–HERTZ TUBE" sub="130 × 26 mm" />
      <rect x="170" y="70" width="90" height="330" rx="44" fill="rgba(255,226,200,.42)" stroke={C.ink2} strokeWidth="2" />
      {Array.from({ length: bands }, (_, i) => <g key={i}><ellipse cx="215" cy={370 - ((i + 1) * 280) / Math.max(bands + 0.4, 1)} rx="36" ry="11" fill="#FF8A3C" opacity={0.85} /><ellipse cx="215" cy={370 - ((i + 1) * 280) / Math.max(bands + 0.4, 1)} rx="44" ry="18" fill="#FF8A3C" opacity={0.22} /></g>)}
      {[390, 360, 92].map((y, i) => <line key={i} x1="178" x2="252" y1={y} y2={y} stroke={i === 0 ? C.red : C.ink2} strokeWidth={i === 0 ? 4 : 2} strokeDasharray={i ? '3 4' : undefined} />)}
      <T x={160} y={394} s={10} a="end" c={C.ink2}>Filament</T><T x={160} y={364} s={10} a="end" c={C.ink2}>Control grid</T><T x={160} y={96} s={10} a="end" c={C.ink2}>Anode</T>
      <circle cx={215 + 20 * Math.sin(t * 9)} cy={375 - ((t * 110) % 280)} r="3" fill={C.t1} />
      <Panel x={446} y={30} w={336} h={420} t="FRANCK–HERTZ UNIT" sub="7-segment" />
      <Lcd x={462} y={80} w={304} value={v.V.toFixed(1)} unit="V" label="Accelerating voltage" />
      <Lcd x={462} y={156} w={304} value={o.I.toFixed(2)} unit="nA" label="Plate current" />
      <Lcd x={462} y={232} w={146} value={v.Vf.toFixed(1)} unit="V" label="Filament" s={18} /><Lcd x={620} y={232} w={146} value={v.Vr.toFixed(1)} unit="V" label="Counter" s={18} />
      <Scope x={462} y={290} w={304} h={148} title="ANODE CURRENT" n={160} tr={[{ f: (u) => fh(u * 80, v.Vf, v.Vr) / 48 - 0.9 }]} />
      <circle cx={472 + (v.V / 80) * 284} cy={371 - (o.I / 48 - 0.9) * 50.6} r="5" fill={C.t2} stroke="#fff" strokeWidth="2" />
    </Svg>
  )
}
const fhCtl = [num('V', 'Accelerating voltage', 0, 80, 0.2, 30, 'V'), num('Vf', 'Filament voltage', 6, 9, 0.1, 7.5, 'V'), num('Vr', 'Counter voltage', 1.2, 10, 0.2, 4, 'V')]
const fhBase = { controls: fhCtl, out: (v) => ({ I: fh(v.V, v.Vf, v.Vr) }), Stage: StageFh, read: (v, o) => [['Plate current', o.I.toFixed(2), 'nA'], ['Glow layers', Math.max(0, Math.floor((v.V - V0) / EX + 0.25)), '']], columns: [['V', 'V (V)', 1], ['I', 'I (nA)', 2]], sample: (v, o) => ({ V: v.V, I: Math.max(0, wobble(o.I, 0.04)) }),
  graph: { x: 'V', y: 'I', xl: 'Accelerating voltage (V)', yl: 'Plate current (nA)', curve: (v) => curve((x) => fh(x, v.Vf, v.Vr), 0, 80, 400), live: (v) => [v.V, fh(v.V, v.Vf, v.Vr)] }, need: 20,
  analyse: (r) => {
    const p = peaks(r, 'V', 'I', 3, 1)
    if (p.length < 2) return [['Peaks found', String(p.length), '']]
    return [['Peaks found', String(p.length), ''], ['Peak spacing', spacing(p, 'V'), 'V', EX]]
  },
}
const fhManual = { ...fhBase, id: 'manual-curve', title: 'Excitation curve in manual mode', short: 'Step the voltage by hand', aim: 'Trace the anode current against accelerating voltage in manual mode and observe the glow layers in the neon tube.', formula: 'ΔV = E_excitation / e', principle: 'Electrons accelerated through neon lose fixed energy packets in inelastic collisions. Each packet produces a dip in current and a new orange glow layer inside the tube.', steps: ['Set filament and counter voltages.', 'Raise the accelerating voltage slowly.', 'Note the current at each step.', 'Count the glow layers.'], sweep: { k: 'V', n: 81 } }
const fhLog = { ...fhBase, id: 'data-logging', title: 'Ionization potential with data logging', short: 'Peak spacing', aim: 'Log the Franck–Hertz curve automatically and determine the characteristic energy of neon from the peak spacing.', formula: 'E = e · ΔV', principle: 'The equal voltage spacing between the current peaks gives the excitation energy of neon atoms, about 18.7 eV.', steps: ['Start the data logger.', 'Let the unit sweep 0–80 V.', 'Locate the peaks.', 'Average their spacing.'], sweep: { k: 'V', n: 161 } }
export const franckHertz = [fhManual, fhLog]
