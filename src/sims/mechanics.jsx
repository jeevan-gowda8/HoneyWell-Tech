import { Svg, T, Bench, Panel, Lcd, LcdText, Led, C, Scope, Dim, Jack } from '../lib/parts'
import { num, sel, TAU, PI, fit, jitter, sq, rad, clamp, curve, mean } from '../lib/math'

const G = 9.78 // local value used by the simulation

/* ---------- 1. Bar pendulum (PhyUGEx-2) ---------- */
const BAR_L = 1.0, BAR_B = 0.044, BAR_W = 0.007, BAR_M = BAR_L * BAR_B * BAR_W * 7850
const K2 = (BAR_L * BAR_L + BAR_B * BAR_B) / 12
const holeD = (n) => (10 - n) * 0.05
const compoundT = (d) => TAU * Math.sqrt((d * d + K2) / (G * Math.abs(d)))

const Display = ({ title, lines, x = 590, y = 90 }) => (
  <g>
    <Panel x={x} y={y} w={190} h={150} t={title} />
    <LcdText x={x + 12} y={y + 30} w={166} h={62} lines={lines} />
    <Led x={x + 26} y={y + 118} on c={C.green} l="" />
    <T x={x + 40} y={y + 122} s={10} c={C.silk2}>Power · 5 V regulated</T>
  </g>
)

function StageSimple({ v, o, t }) {
  const px = 330, py = 60, L = v.L * 370, th = rad(v.amp) * Math.cos((TAU * t) / o.T) * 1.4
  const x = px + Math.sin(th) * L, y = py + Math.cos(th) * L
  return (
    <Svg>
      <Bench />
      <rect x="150" y="30" width="360" height="14" rx="4" fill="url(#g-metal)" stroke={C.steel} />
      <rect x="150" y="30" width="16" height="432" fill="url(#g-metal)" stroke={C.steel} />
      <rect x="110" y="446" width="110" height="16" rx="3" fill={C.steel} />
      <line x1={px} y1="44" x2={px} y2={py} stroke={C.ink} strokeWidth="5" />
      <line x1={px} y1={py} x2={x} y2={y} stroke={C.ink} strokeWidth="1.6" />
      <line x1={px} y1={py} x2={px} y2={py + 410} stroke={C.line} strokeDasharray="4 6" />
      <circle cx={x} cy={y} r="17" fill="url(#g-copper)" stroke="#8A4C24" />
      <Dim x1={px + 150} y1={py} x2={px + 150} y2={py + L} l={`L = ${v.L.toFixed(2)} m`} />
      <Display title="DIGITAL STOPWATCH" lines={[`T = ${o.T.toFixed(3)} s`, `n = ${Math.floor(t / o.T)} osc`]} />
    </Svg>
  )
}

function StageCompound({ v, o, t }) {
  const px = 330, py = 185, S = 290, d = o.d
  const th = o.valid ? rad(v.amp) * Math.cos((TAU * t) / o.T) * 1.4 : 0
  const up = (0.5 - Math.abs(d)) * S, down = (0.5 + Math.abs(d)) * S
  const flip = v.hole > 10
  return (
    <Svg>
      <Bench />
      <rect x="120" y="150" width="240" height="14" rx="4" fill="url(#g-metal)" stroke={C.steel} />
      <rect x="120" y="150" width="16" height="312" fill="url(#g-metal)" stroke={C.steel} />
      <rect x="80" y="446" width="110" height="16" rx="3" fill={C.steel} />
      <path d={`M${px - 12},164 L${px},${py} L${px + 12},164`} fill={C.brass} stroke="#9B7B2C" />
      <g transform={`rotate(${(-th * 180) / PI} ${px} ${py})`}>
        <rect x={px - 13} y={py - up} width="26" height={up + down} rx="3" fill="url(#g-metal)" stroke={C.ink2} />
        {Array.from({ length: 19 }, (_, i) => {
          const pos = py + (flip ? v.hole - (i + 1) : i + 1 - v.hole) * 0.05 * S
          const active = i + 1 === v.hole
          return <circle key={i} cx={px} cy={pos} r={active ? 6 : 4.2} fill={active ? C.t2 : '#fff'} stroke={active ? C.t2 : C.ink2} />
        })}
        <circle cx={px} cy={py + Math.abs(d) * S} r="7" fill="none" stroke={C.t1} strokeWidth="2" />
        <path d={`M${px - 7},${py + Math.abs(d) * S} h14 M${px},${py + Math.abs(d) * S - 7} v14`} stroke={C.t1} strokeWidth="2" />
      </g>
      <T x={px + 40} y={py + Math.abs(d) * S + 4} s={12} c={C.t1} w={600}>Centre of gravity</T>
      <T x={px + 40} y={py - 8} s={12} c={C.t2} w={600}>Knife-edge · hole {v.hole}</T>
      <Display title="MICROCONTROLLER UNIT" y={70} lines={o.valid ? [`T = ${o.T.toFixed(3)} s`, `d = ${(Math.abs(d) * 100).toFixed(0)} cm · side ${d > 0 ? 'A' : 'B'}`] : ['Pivot at C.G.', 'No oscillation']} />
    </Svg>
  )
}

function StageFall({ v, o, t }) {
  const H = v.h * 260, tf = o.tf, cyc = tf * 7 + 0.7
  const tt = t % cyc, u = clamp(tt / (tf * 7), 0, 1)
  const y = 90 + H * u * u
  const landed = u >= 1
  return (
    <Svg>
      <Bench />
      <rect x="240" y="30" width="16" height="432" fill="url(#g-metal)" stroke={C.steel} />
      <rect x="200" y="446" width="110" height="16" rx="3" fill={C.steel} />
      <rect x="248" y="50" width="140" height="12" fill="url(#g-metal)" stroke={C.steel} />
      <rect x="360" y="48" width="48" height="24" rx="4" fill={C.ink2} />
      <T x={384} y={44} s={10} a="middle" c={C.ink2}>Release magnet</T>
      <line x1="330" x2="440" y1={90 + H} y2={90 + H} stroke={C.t2} strokeWidth="2" strokeDasharray="6 4" />
      <T x={446} y={94 + H} s={11} c={C.t2} w={600}>Gate</T>
      <circle cx="384" cy={y} r="13" fill="url(#g-copper)" stroke="#8A4C24" />
      <Dim x1={300} y1={90} x2={300} y2={90 + H} l={`${v.h.toFixed(2)} m`} />
      <Display title="DIGITAL TIMER" x={575} lines={[`t = ${(landed ? tf : tf * u).toFixed(4)} s`, landed ? 'Gate triggered' : 'Falling...']} />
    </Svg>
  )
}

const stopNote = 'Timing covers 20 oscillations, so one reading averages out reaction error.'

const simple = {
  id: 'simple-pendulum', title: 'Simple pendulum', short: 'g from T² against L',
  aim: 'Determine the acceleration due to gravity using a simple pendulum.',
  formula: 'T = 2π √(L / g)     g = 4π² / slope(T²–L)',
  principle: 'For small swings the period depends only on length and g, so a plot of T² against L is a straight line through the origin.',
  steps: ['Set the pendulum length.', 'Keep the release angle below about 8°.', 'Record the time for 20 oscillations.', 'Repeat for at least five lengths and read g from the slope.'],
  controls: [num('L', 'Length L', 0.2, 1, 0.05, 0.75, 'm'), num('amp', 'Release angle', 2, 8, 1, 6, '°')],
  out: (v) => ({ T: TAU * Math.sqrt(v.L / G) }),
  Stage: StageSimple,
  read: (v, o) => [['Period', o.T.toFixed(3), 's'], ['20 osc', (o.T * 20).toFixed(2), 's'], ['T²', sq(o.T).toFixed(3), 's²']],
  columns: [['L', 'L (m)', 2], ['t20', '20T (s)', 2], ['T', 'T (s)', 3], ['T2', 'T² (s²)', 3]],
  sample: (v, o) => { const t20 = +jitter(o.T * 20, 0.0015).toFixed(2), T = t20 / 20; return { L: v.L, t20, T, T2: T * T } },
  sweep: { k: 'L', n: 9 },
  graph: { x: 'L', y: 'T2', xl: 'Length L (m)', yl: 'T² (s²)', fit: true, live: (v) => [v.L, (4 * PI * PI * v.L) / G] },
  analyse: (r) => { const f = fit(r, 'L', 'T2'); return f && [['g from slope', (4 * PI * PI) / f.m, 'm/s²', G]] },
  tip: stopNote,
}

const compoundBase = {
  controls: [num('hole', 'Suspension hole', 1, 19, 1, 3), num('amp', 'Release angle', 2, 8, 1, 5, '°')],
  out: (v) => { const d = holeD(v.hole); return d === 0 ? { d, valid: false, T: 0 } : { d, valid: true, T: compoundT(d) } },
  Stage: StageCompound,
  read: (v, o) => [['Distance from C.G.', (Math.abs(o.d) * 100).toFixed(0), 'cm'], ['Period', o.valid ? o.T.toFixed(3) : '—', 's'], ['Bar mass', BAR_M.toFixed(3), 'kg']],
  columns: [['hole', 'Hole', 0], ['ds', 'd (cm)', 0], ['T', 'T (s)', 3], ['x', 'd² (m²)', 4], ['y', 'dT² (m·s²)', 4]],
  sample: (v, o) => {
    if (!o.valid) return { error: 'The centre hole sits on the C.G. Pick another hole.' }
    const T = +jitter(o.T * 20, 0.0012).toFixed(2) / 20, d = Math.abs(o.d)
    return { hole: v.hole, ds: o.d * 100, T, x: d * d, y: d * T * T }
  },
  sweep: { list: Array.from({ length: 19 }, (_, i) => ({ hole: i + 1 })).filter((p) => p.hole !== 10) },
  need: 6,
}
const compoundCurve = () => [...curve((d) => compoundT(d / 100), -47, -3, 80), [NaN, NaN], ...curve((d) => compoundT(d / 100), 3, 47, 80)]

const compound = {
  ...compoundBase, id: 'compound-pendulum', title: 'Compound pendulum: g', short: 'Two-branch T–d curve',
  aim: 'Determine g from the variation of period with the distance of the pivot from the centre of gravity.',
  formula: 'T = 2π √((d² + k²) / (g d))     dT² = (4π²/g) d² + (4π²/g) k²',
  principle: 'The period is large near the C.G., falls to a minimum at d = k, then rises again. Plotting dT² against d² linearises it, and the slope gives g.',
  steps: ['Suspend the bar on a hole and start it swinging.', 'Record the period for that hole.', 'Move through the holes on both sides of the centre.', 'Use the fitted line to find g.'],
  graph: { x: 'ds', y: 'T', xl: 'Distance from C.G. (cm)', yl: 'Period T (s)', curve: compoundCurve, zero: false, modelLabel: 'Kit response', live: (v) => { const d = holeD(v.hole); return d ? [d * 100, compoundT(d)] : null } },
  analyse: (r) => { const f = fit(r, 'x', 'y'); return f && [['g', (4 * PI * PI) / f.m, 'm/s²', G]] },
}
const gyration = {
  ...compoundBase, id: 'radius-of-gyration', title: 'Radius of gyration and moment of inertia', short: 'k and I about the C.G.',
  aim: 'Calculate the radius of gyration and the moment of inertia of the bar about its centre of gravity.',
  formula: 'k² = intercept / slope     I_G = M k²',
  principle: 'The straight line of dT² against d² has an intercept-to-slope ratio equal to k². With the bar mass known, the moment of inertia follows.',
  steps: ['Collect the period for holes on both halves of the bar.', 'Plot dT² against d².', 'Take k² from intercept ÷ slope.', 'Compute I_G = M k².'],
  graph: { x: 'x', y: 'y', xl: 'd² (m²)', yl: 'd·T² (m·s²)', fit: true },
  analyse: (r) => {
    const f = fit(r, 'x', 'y')
    if (!f) return null
    const k = Math.sqrt(Math.abs(f.c / f.m))
    return [['Radius of gyration k', k, 'm', Math.sqrt(K2)], ['Moment of inertia I_G', BAR_M * k * k, 'kg·m²', BAR_M * K2]]
  },
}
const freefall = {
  id: 'free-fall', title: 'Free-fall method', short: 'Drop time against height',
  aim: 'Determine g by timing an object in free fall between the release magnet and the gate.',
  formula: 'h = ½ g t²     g = 2 × slope(h–t²)',
  principle: 'A ball released from rest covers a height h in time t. The drop is shown in slow motion; the timer reports the true fall time.',
  steps: ['Set the gate height.', 'Release the ball and note the timer.', 'Repeat for several heights.', 'Find g from the slope of h against t².'],
  controls: [num('h', 'Drop height', 0.2, 1.3, 0.05, 0.8, 'm')],
  out: (v) => ({ tf: Math.sqrt((2 * v.h) / G) }),
  Stage: StageFall,
  read: (v, o) => [['Fall time', o.tf.toFixed(4), 's'], ['t²', sq(o.tf).toFixed(4), 's²']],
  columns: [['h', 'h (m)', 2], ['tf', 't (s)', 4], ['t2', 't² (s²)', 4]],
  sample: (v, o) => { const tf = jitter(o.tf, 0.002); return { h: v.h, tf, t2: tf * tf } },
  sweep: { k: 'h', n: 9 },
  graph: { x: 't2', y: 'h', xl: 't² (s²)', yl: 'Height h (m)', fit: true },
  analyse: (r) => { const f = fit(r, 't2', 'h'); return f && [['g from slope', 2 * f.m, 'm/s²', G]] },
}
export const barPendulum = [simple, compound, gyration, freefall]

/* ---------- 2. Coupled oscillator (PhyUGEx-11) ---------- */
const CM = 1.0, CL = 1.0 // bob mass (kg) and pendulum length (m)
const w0 = (l = CL) => Math.sqrt(G / l)
const coupled = (k, s) => {
  const a = w0(), b = Math.sqrt(a * a + (2 * k * s * s) / (CM * CL * CL))
  const T0 = TAU / a, T1 = TAU / b
  return { a, b, T0, T1, Tc: (2 * T0 * T1) / (T0 + T1), Tb: (T0 * T1) / (T0 - T1), K: (T0 * T0 - T1 * T1) / (T0 * T0 + T1 * T1) }
}
const motion = (mode, c, t) => {
  if (mode === 'in') return [Math.cos(c.a * t), Math.cos(c.a * t)]
  if (mode === 'anti') return [Math.cos(c.b * t), -Math.cos(c.b * t)]
  return [0.5 * (Math.cos(c.a * t) + Math.cos(c.b * t)), 0.5 * (Math.cos(c.a * t) - Math.cos(c.b * t))]
}

function StageCoupled({ v, o, t }) {
  const L = 250, [x1, x2] = motion(o.mode, o.c, t), A = 0.14
  const piv = [200, 400], top = 58
  const pos = (i, u) => { const th = (i ? x2 : x1) * A; return [piv[i] + Math.sin(th) * L * u, top + Math.cos(th) * L * u] }
  const sa = pos(0, v.s), sb = pos(1, v.s), b1 = pos(0, 1), b2 = pos(1, 1)
  const coils = 12, sp = Array.from({ length: coils * 2 + 1 }, (_, i) => {
    const u = i / (coils * 2), xx = sa[0] + (sb[0] - sa[0]) * u, yy = sa[1] + (sb[1] - sa[1]) * u + (i === 0 || i === coils * 2 ? 0 : i % 2 ? -9 : 9)
    return `${i ? 'L' : 'M'}${xx.toFixed(1)},${yy.toFixed(1)}`
  }).join('')
  return (
    <Svg>
      <Bench />
      <rect x="110" y="44" width="380" height="14" rx="4" fill="url(#g-metal)" stroke={C.steel} />
      <rect x="110" y="44" width="14" height="418" fill="url(#g-metal)" stroke={C.steel} /><rect x="476" y="44" width="14" height="418" fill="url(#g-metal)" stroke={C.steel} />
      {[0, 1].map((i) => { const b = pos(i, 1); return <g key={i}><line x1={piv[i]} y1={top} x2={b[0]} y2={b[1]} stroke={C.ink} strokeWidth="3" /><circle cx={b[0]} cy={b[1]} r="22" fill="url(#g-copper)" stroke="#8A4C24" /></g> })}
      <path d={sp} fill="none" stroke={C.t3} strokeWidth="2" />
      <rect x="170" y="376" width="60" height="10" fill={C.ink2} rx="2" /><rect x="370" y="376" width="60" height="10" fill={C.ink2} rx="2" />
      <T x={300} y={395} s={10.5} a="middle" c={C.ink2}>Magnetic field sensors</T>
      <T x={b1[0]} y={b1[1] + 4} s={12} a="middle" c="#fff" w={700}>1</T><T x={b2[0]} y={b2[1] + 4} s={12} a="middle" c="#fff" w={700}>2</T>
      <Scope x={510} y={40} w={278} h={210} title="DASHBOARD" tr={[
        { f: (u) => 0.9 * motion(o.mode, o.c, t - 24 + u * 24)[0], l: 'P1' },
        { f: (u) => 0.9 * motion(o.mode, o.c, t - 24 + u * 24)[1], l: 'P2' },
      ]} />
      <Panel x={510} y={262} w={278} h={190} t="DAQ UNIT" />
      <LcdText x={524} y={290} w={250} h={56} lines={[`T0 ${o.c.T0.toFixed(3)} s  T1 ${o.c.T1.toFixed(3)} s`, `s = ${v.s.toFixed(2)} m  k = ${v.k.toFixed(2)}`]} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
        const lvl = Math.abs(motion(o.mode, o.c, t)[0]) * 10
        return <rect key={i} x={524 + i * 25} y={362} width="20" height="14" rx="2" fill={i < lvl ? C.t3 : C.soft} />
      })}
      <T x={524} y={394} s={10} c={C.silk2}>Bar graph · amplitude of pendulum 1</T>
      <Jack x={540} y={418} c={C.t1} l="USB" /><Jack x={600} y={418} c={C.red} l="+12 V" /><Jack x={660} y={418} c={C.green} l="+5 V" />
    </Svg>
  )
}

const cCtl = (extra = []) => [num('s', 'Coupling position s/L', 0.3, 0.9, 0.05, 0.6, ''), num('k', 'Spring constant k', 2.5, 3, 0.05, 2.75, 'N/m'), ...extra]
const tRead = (x) => +jitter(x, 0.001).toFixed(3)
const nm = {
  id: 'normal-modes', title: 'Two normal modes', short: 'T₀ and T₁ on the dashboard',
  aim: 'Study the in-phase and anti-phase normal modes and determine their periods T₀ and T₁.',
  formula: 'ω₀² = g/L     ω₁² = g/L + 2k s²/(m L²)',
  principle: 'Displaced together the spring stays relaxed and each pendulum swings at its natural period. Displaced oppositely the spring adds restoring torque and the period is shorter.',
  steps: ['Choose in-phase and read T₀.', 'Choose anti-phase and read T₁.', 'Change the coupling point and repeat.'],
  controls: cCtl([sel('mode', 'Initial displacement', [['in', 'In phase'], ['anti', 'Anti phase']], 'in')]),
  out: (v) => ({ mode: v.mode, c: coupled(v.k, v.s) }),
  Stage: StageCoupled,
  read: (v, o) => [['Mode', v.mode === 'in' ? 'In phase' : 'Anti phase', ''], ['Measured period', (v.mode === 'in' ? o.c.T0 : o.c.T1).toFixed(3), 's']],
  columns: [['s', 's/L', 2], ['T0', 'T₀ (s)', 3], ['T1', 'T₁ (s)', 3]],
  sample: (v, o) => ({ s: v.s, T0: tRead(o.c.T0), T1: tRead(o.c.T1) }),
  sweep: { k: 's', n: 7 },
  graph: { x: 's', y: 'T1', xl: 'Coupling position s/L', yl: 'Anti-phase period T₁ (s)', zero: false },
  analyse: (r, v) => [['Mean T₀', mean(r.map((x) => x.T0)), 's', TAU / w0()], ['T₁ at last setting', r[r.length - 1].T1, 's', coupled(v.k, r[r.length - 1].s).T1]],
}
const res = {
  id: 'resonance-mode', title: 'Resonance and beats', short: 'T_c and T_b compared',
  aim: 'Record the beat motion and compare measured T_c and T_b with values calculated from T₀ and T₁.',
  formula: 'T_c = 2T₀T₁/(T₀ + T₁)     T_b = T₀T₁/(T₀ − T₁)',
  principle: 'Displacing one pendulum alone excites both normal modes. Energy moves back and forth between the pendulums at the beat period.',
  steps: ['Displace pendulum 1 only.', 'Watch the energy transfer on the dashboard.', 'Record T_c and T_b.', 'Compare with the calculated values.'],
  controls: cCtl(),
  out: (v) => ({ mode: 'beat', c: coupled(v.k, v.s) }),
  Stage: StageCoupled,
  read: (v, o) => [['T_c', o.c.Tc.toFixed(3), 's'], ['T_b', o.c.Tb.toFixed(2), 's']],
  columns: [['s', 's/L', 2], ['Tc', 'T_c (s)', 3], ['Tb', 'T_b (s)', 2], ['calc', 'T_b calc (s)', 2]],
  sample: (v, o) => ({ s: v.s, Tc: tRead(o.c.Tc), Tb: tRead(o.c.Tb), calc: o.c.Tb }),
  sweep: { k: 's', n: 7 },
  graph: { x: 's', y: 'Tb', xl: 'Coupling position s/L', yl: 'Beat period T_b (s)', zero: false },
  analyse: (r) => [['Mean deviation of T_b', (mean(r.map((x) => Math.abs(x.Tb - x.calc) / x.calc)) * 100).toFixed(2), '%']],
}
const degree = {
  id: 'degree-of-coupling', title: 'Degree of coupling and coupling constant', short: 'K against coupling length',
  aim: 'Determine the degree of coupling for different coupling lengths and study how T₀ and T₁ vary.',
  formula: 'K = (T₀² − T₁²) / (T₀² + T₁²)',
  principle: 'Moving the spring further down increases its leverage, so the anti-phase mode stiffens and K grows roughly with s².',
  steps: ['Fix the spring at a coupling length.', 'Measure T₀ and T₁.', 'Compute K.', 'Plot K against s².'],
  controls: cCtl(),
  out: (v) => ({ mode: 'anti', c: coupled(v.k, v.s) }),
  Stage: StageCoupled,
  read: (v, o) => [['Degree of coupling K', o.c.K.toFixed(4), ''], ['s²', sq(v.s).toFixed(3), '']],
  columns: [['s', 's/L', 2], ['s2', '(s/L)²', 3], ['T0', 'T₀ (s)', 3], ['T1', 'T₁ (s)', 3], ['K', 'K', 4]],
  sample: (v, o) => { const T0 = tRead(o.c.T0), T1 = tRead(o.c.T1); return { s: v.s, s2: v.s * v.s, T0, T1, K: (T0 * T0 - T1 * T1) / (T0 * T0 + T1 * T1) } },
  sweep: { k: 's', n: 7 },
  graph: { x: 's2', y: 'K', xl: '(s/L)²', yl: 'Degree of coupling K', fit: true },
  analyse: (r) => { const f = fit(r, 's2', 'K'); return f && [['K per unit (s/L)²', f.m, ''], ['Linearity R²', f.r2.toFixed(4), '']] },
}
const springK = {
  id: 'spring-constant', title: 'Spring constant', short: 'k from ω₁² − ω₀²',
  aim: 'Determine the spring constant from the measured normal-mode periods.',
  formula: 'ω₁² − ω₀² = (2k / m L²) s²',
  principle: 'The difference of the squared angular frequencies is proportional to s². The slope of that line gives k once the bob mass and pendulum length are known.',
  steps: ['Record T₀ and T₁ at several coupling points.', 'Compute ω₁² − ω₀².', 'Plot against s².', 'Find k from the slope.'],
  controls: cCtl(),
  out: (v) => ({ mode: 'anti', c: coupled(v.k, v.s) }),
  Stage: StageCoupled,
  read: (v, o) => [['ω₁² − ω₀²', (sq(o.c.b) - sq(o.c.a)).toFixed(3), 'rad²/s²'], ['Bob mass', CM.toFixed(1), 'kg']],
  columns: [['s2', 's² (m²)', 3], ['T1', 'T₁ (s)', 3], ['dw', 'ω₁²−ω₀²', 3]],
  sample: (v, o) => { const T1 = tRead(o.c.T1); return { s2: v.s * v.s * CL * CL, T1, dw: sq(TAU / T1) - sq(o.c.a) } },
  sweep: { k: 's', n: 7 },
  graph: { x: 's2', y: 'dw', xl: 's² (m²)', yl: 'ω₁² − ω₀² (rad²/s²)', fit: true },
  analyse: (r, v) => { const f = fit(r, 's2', 'dw'); return f && [['Spring constant k', (f.m * CM * CL * CL) / 2, 'N/m', v.k]] },
}
export const coupledOsc = [nm, res, degree, springK]
