import { Svg, T, Panel, Lcd, LcdText, Led, C, Wire, Res, Cap, Ind, Src, Mtr, Dot, Gnd, Scope, Jack, Knob } from '../lib/parts'
import { num, sel, tog, TAU, PI, fit, jitter, wobble, clamp, curve, mean, deg, steps } from '../lib/math'


const C_OPT = [[0.01, '0.01 µF'], [0.1, '0.1 µF'], [0.47, '0.47 µF']]

/* ---------- Lissajous (PhyUGEx-262) ---------- */
const Trainer = ({ title, sub, xy, right }) => (
  <Svg className="stage-svg bp">
    <rect x="14" y="14" width="772" height="472" rx="6" fill="url(#g-blackpanel)" stroke="#000" /><rect x="14" y="14" width="772" height="472" rx="6" fill="url(#g-sheen)" />
    <T x={32} y={40} s={12} w={700} c={C.silk} letterSpacing=".06em">{title}</T>
    <Scope x={36} y={56} w={500} h={410} xy={xy} title="X–Y DISPLAY" sub={sub} />
    <Panel x={552} y={56} w={214} h={410} t="SIGNAL GENERATOR" sub="≤100 kHz" />
    {right}
  </Svg>
)
const lissa = {
  id: 'lissajous-figures', title: "Study of Lissajous' figures", short: 'Frequency ratios',
  aim: 'Observe Lissajous figures for different frequency ratios and phases.',
  formula: 'f_y / f_x = N_x / N_y',
  principle: 'Two perpendicular sinusoidal signals trace a figure on an X–Y display. Its tangency counts on the horizontal and vertical edges give the frequency ratio.',
  steps: ['Choose a frequency ratio.', 'Change the phase and note the shape.', 'Count tangencies on each edge.', 'Record the ratio.'],
  controls: [sel('p', 'f_x', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 2), sel('q', 'f_y', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 3), num('ph', 'Phase', 0, 180, 5, 45, '°'), tog('drift', 'Slow phase drift', true)],
  out: (v, t) => ({ ph: (v.ph * PI) / 180 + (v.drift ? t * 0.5 : 0) }),
  Stage: ({ v, o }) => (
    <Trainer title="LISSAJOUS TRAINER" sub={`${v.p} : ${v.q}`} xy={{ n: 800, f: (s) => [0.95 * Math.sin(TAU * v.p * s + o.ph), 0.95 * Math.sin(TAU * v.q * s)] }} right={<>
      <Lcd x={566} y={120} w={186} value={v.p} unit="×f" label="X input" /><Lcd x={566} y={190} w={186} value={v.q} unit="×f" label="Y input" /><Lcd x={566} y={260} w={186} value={deg(o.ph % TAU).toFixed(0)} unit="°" label="Phase" />
      <Jack x={610} y={360} c={C.t1} l="X" /><Jack x={700} y={360} c={C.t2} l="Y" /><Led x={657} y={420} on c={C.green} l="+15 V" />
    </>} />
  ),
  read: (v) => [['Ratio f_x : f_y', `${v.p} : ${v.q}`, '']],
  columns: [['p', 'f_x', 0], ['q', 'f_y', 0], ['nx', 'Horizontal tangencies', 0], ['ny', 'Vertical tangencies', 0]],
  sample: (v) => ({ p: v.p, q: v.q, nx: v.q, ny: v.p }),
  sweep: { list: [[1, 1], [1, 2], [2, 3], [3, 4], [1, 3], [3, 5]].map(([p, q]) => ({ p, q })) },
  analyse: (r) => [['Rule verified', `${r.filter((x) => x.q / x.p === x.nx / x.ny).length} of ${r.length}`, '']],
}
const FU = 3.70
const unknown = {
  id: 'unknown-frequency', title: 'Unknown frequency', short: 'Stabilise and compute',
  aim: 'Calculate an unknown frequency from the Lissajous figure formed with the generator.',
  formula: 'f_unknown = f_x × (N_x / N_y)',
  principle: 'The figure stands still only when the two frequencies are in a simple ratio. Adjust the generator until the pattern stops rotating, then apply the ratio.',
  steps: ['Connect the unknown to Y.', 'Choose the expected ratio.', 'Adjust the generator until the figure is still.', 'Calculate the unknown frequency.'],
  controls: [sel('r', 'Ratio f_u : f_x', [[1, '1:1'], [2, '2:1'], [0.5, '1:2'], [1.5, '3:2']], 1), num('fx', 'Generator frequency', 1, 10, 0.01, 3.2, 'kHz')],
  out: (v, t) => { const mis = FU / v.fx - v.r; return { mis, ph: mis * 12 * t * Math.max(1, 1) } },
  Stage: ({ v, o }) => (
    <Trainer title="LISSAJOUS TRAINER" sub={Math.abs(o.mis) < 0.004 ? 'Stationary' : 'Drifting'} xy={{ n: 800, f: (s) => {
      const base = v.r === 1.5 ? [2, 3] : v.r === 2 ? [1, 2] : v.r === 0.5 ? [2, 1] : [1, 1]
      return [0.95 * Math.sin(TAU * base[0] * s), 0.95 * Math.sin(TAU * base[1] * s + o.ph + 0.7)]
    } }} right={<>
      <Lcd x={566} y={120} w={186} value={v.fx.toFixed(2)} unit="kHz" label="Generator" /><Lcd x={566} y={190} w={186} value="?" label="Unknown" />
      <Led x={657} y={290} on={Math.abs(o.mis) < 0.004} c={C.green} l="Figure stationary" />
    </>} />
  ),
  read: (v, o) => [['Status', Math.abs(o.mis) < 0.004 ? 'Stationary' : 'Drifting', ''], ['Generator', v.fx.toFixed(2), 'kHz']],
  columns: [['fx', 'f_x (kHz)', 2], ['r', 'Ratio', 2], ['fu', 'f_u (kHz)', 3]],
  sample: (v, o) => (Math.abs(o.mis) < 0.02 ? { fx: v.fx, r: v.r, fu: v.fx * v.r } : { error: 'The figure is still drifting. Adjust the generator until it is stationary.' }),
  sweep: { list: [[1, 3.7], [2, 1.85], [0.5, 7.4], [1.5, 2.47]].map(([r, fx]) => ({ r, fx })) },
  need: 2,
  analyse: (r) => [['Unknown frequency', mean(r.map((x) => x.fu)), 'kHz', FU]],
}
const rlcPhase = (v) => {
  const w = TAU * v.f * 1000, XL = w * 0.1, XC = 1 / (w * 1e-8)
  return Math.atan((XL - XC) / v.R)
}
const rlcLiss = {
  id: 'rlc-lissajous', title: 'RLC resonance using Lissajous figures', short: 'Ellipse closes to a line',
  aim: 'Find the resonant frequency of an RLC circuit from the Lissajous figure of input against resistor voltage.',
  formula: 'tan φ = (X_L − X_C) / R     φ = 0 at f₀',
  principle: 'Away from resonance the resistor voltage leads or lags the input and the figure is an ellipse. At resonance the two are in phase and the ellipse closes to a straight line.',
  steps: ['Connect input to X and V_R to Y.', 'Sweep the frequency.', 'Note the ellipse opening.', 'Find where it collapses to a line.'],
  controls: [num('f', 'Frequency', 1, 10, 0.01, 3.5, 'kHz'), num('R', 'Resistor', 100, 1000, 50, 1000, 'Ω')],
  out: (v) => ({ phi: rlcPhase(v) }),
  Stage: ({ v, o }) => (
    <Trainer title="LISSAJOUS TRAINER · RLC" sub={`φ = ${deg(o.phi).toFixed(1)}°`} xy={{ f: (s) => [0.95 * Math.sin(TAU * s), 0.95 * Math.cos(o.phi) * Math.sin(TAU * s - o.phi)] }} right={<>
      <Lcd x={566} y={120} w={186} value={v.f.toFixed(2)} unit="kHz" label="Frequency" /><Lcd x={566} y={190} w={186} value={deg(o.phi).toFixed(1)} unit="°" label="Phase φ" />
      <Lcd x={566} y={260} w={186} value="100 mH" label="L" s={18} /><Lcd x={566} y={330} w={186} value="0.01 µF" label="C" s={18} />
    </>} />
  ),
  read: (v, o) => [['Phase φ', deg(o.phi).toFixed(1), '°']],
  columns: [['f', 'f (kHz)', 2], ['phi', 'φ (°)', 1]],
  sample: (v, o) => ({ f: v.f, phi: wobble(deg(o.phi), 0.2) }),
  sweep: { k: 'f', n: 21 }, need: 6,
  graph: { x: 'f', y: 'phi', xl: 'Frequency (kHz)', yl: 'Phase (°)', zero: false, curve: (v) => curve((f) => deg(rlcPhase({ ...v, f })), 1, 10), live: (v) => [v.f, deg(rlcPhase(v))] },
  analyse: (r) => {
    const s = [...r].sort((a, b) => a.f - b.f)
    for (let i = 0; i < s.length - 1; i++) if (s[i].phi <= 0 && s[i + 1].phi > 0) return [['Resonant frequency', s[i].f + (-s[i].phi / (s[i + 1].phi - s[i].phi)) * (s[i + 1].f - s[i].f), 'kHz', 1 / (TAU * Math.sqrt(0.1 * 1e-8)) / 1000]]
    return [['Status', 'Readings must span the zero crossing', '']]
  },
}
const rcPhase = (v) => Math.atan(1 / (TAU * v.f * 1000 * v.R * v.C * 1e-6))
const phaseDiff = {
  id: 'phase-difference', title: 'Phase difference', short: 'sin φ = Y₀ / Y_m',
  aim: 'Calculate the phase difference produced by an RC network from the Lissajous ellipse.',
  formula: 'sin φ = Y₀ / Y_m     tan φ = 1 / (2π f R C)',
  principle: 'The ratio of the ellipse’s Y-axis intercept to its maximum Y excursion gives the phase difference between the two signals.',
  steps: ['Connect the RC network.', 'Read Y₀ and Y_m from the ellipse.', 'Compute φ.', 'Compare with the calculated phase.'],
  controls: [num('f', 'Frequency', 0.2, 10, 0.1, 1.6, 'kHz'), num('R', 'Resistor', 1000, 10000, 500, 1000, 'Ω'), sel('C', 'Capacitor', C_OPT, 0.1)],
  out: (v) => { const phi = rcPhase(v); return { phi, Y0: Math.sin(phi), Ym: 1 } },
  Stage: ({ v, o }) => (
    <Trainer title="LISSAJOUS TRAINER · PHASE" sub={`φ = ${deg(o.phi).toFixed(1)}°`} xy={{ f: (s) => [0.95 * Math.sin(TAU * s), 0.95 * Math.sin(TAU * s + o.phi)] }} right={<>
      <Lcd x={566} y={120} w={186} value={o.Y0.toFixed(3)} label="Y₀ (relative)" /><Lcd x={566} y={190} w={186} value={o.Ym.toFixed(3)} label="Y_m (relative)" /><Lcd x={566} y={260} w={186} value={deg(o.phi).toFixed(1)} unit="°" label="Phase φ" /><Lcd x={566} y={330} w={186} value={v.f.toFixed(1)} unit="kHz" label="Frequency" />
    </>} />
  ),
  read: (v, o) => [['Y₀ / Y_m', o.Y0.toFixed(3), ''], ['Phase', deg(o.phi).toFixed(1), '°']],
  columns: [['f', 'f (kHz)', 1], ['Y', 'Y₀/Y_m', 3], ['phi', 'φ (°)', 1], ['th', 'Calculated (°)', 1]],
  sample: (v, o) => { const Y = clamp(wobble(o.Y0, 0.004), 0, 1); return { f: v.f, Y, phi: deg(Math.asin(Y)), th: deg(o.phi) } },
  sweep: { k: 'f', n: 12 },
  graph: { x: 'f', y: 'phi', xl: 'Frequency (kHz)', yl: 'Phase φ (°)', curve: (v) => curve((f) => deg(rcPhase({ ...v, f })), 0.2, 10) },
  analyse: (r) => [['Mean deviation', mean(r.map((x) => Math.abs(x.phi - x.th))).toFixed(2), '°']],
}
export const lissajous = [lissa, unknown, rlcLiss, phaseDiff]

/* ---------- Op-amp trainer (PhyUGEx-268) ---------- */
export const wave = (type, ph) => {
  const x = ((ph % 1) + 1) % 1
  if (type === 'sine') return Math.sin(TAU * x)
  if (type === 'square') return x < 0.5 ? 1 : -1
  return x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4
}
export const VSAT = 11
const RK = [[1, '1 kΩ'], [10, '10 kΩ'], [100, '100 kΩ']]
const opCfg = {
  inverting: { name: 'Inverting amplifier', g: (v) => -v.Rf / v.Ri, sym: 'inv' },
  noninverting: { name: 'Non-inverting amplifier', g: (v) => 1 + v.Rf / v.Ri, sym: 'non' },
  buffer: { name: 'Buffer', g: () => 1, sym: 'buf' },
}
function OpStage({ title, vin, vout, range, lines, children, t }) {
  const s = (a) => clamp(a / range, -1.05, 1.05)
  void t
  return (
    <Svg className="stage-svg bp">
      <rect x="14" y="14" width="772" height="472" rx="6" fill="url(#g-blackpanel)" stroke="#000" /><rect x="14" y="14" width="772" height="472" rx="6" fill="url(#g-sheen)" />
      <T x={32} y={40} s={12} w={700} c={C.silk} letterSpacing=".06em">OP-AMP TRAINER · {title.toUpperCase()}</T>
      {children}
      <path d="M350,120 V240 L480,180 Z" fill="#fff" stroke={C.ink} strokeWidth="2.5" />
      <T x={362} y={150} s={18} w={700}>−</T><T x={362} y={224} s={16} w={700}>+</T>
      <T x={415} y={185} s={11} a="middle" c={C.ink2}>µA741</T>
      <Led x={740} y={36} on c={C.green} /><T x={728} y={40} s={10} a="end" c={C.ink2}>±12 V</T>
      <Scope x={36} y={312} w={470} h={166} title="SCOPE" tr={[{ f: (u) => s(vin(u)), l: 'Input' }, { f: (u) => s(vout(u)), l: 'Output' }]} sub="" />
      <Panel x={520} y={312} w={250} h={166} t="MEASURED" />
      <LcdText x={534} y={340} w={222} h={126} lines={lines} s={14} />
    </Svg>
  )
}
const Fb = ({ x = 416, top = 88, v, label = 'R_f' }) => (
  <g><Wire d="M290,140 V88 H380 M452,88 H520 V180" /><Res x={v ? x : 416} y={top} l={label} v={v} ly={-30} /><Dot x={290} y={140} /><Dot x={520} y={180} /></g>
)
const nodes = () => <><Wire d="M480,180 H580" /><T x={590} y={184} s={13} w={700}>V_o</T></>

function opGain(key) {
  const c = opCfg[key]
  const invt = key === 'inverting'
  const Stage = ({ v, o, t }) => (
    <OpStage title={c.name} t={t} range={Math.max(0.6, Math.max(o.vp, o.vo) / 2) * 1.25} vin={(u) => (o.vp / 2) * wave(v.w, u * 3)} vout={(u) => clamp((o.G * o.vp) / 2 * wave(v.w, u * 3), -VSAT, VSAT)}
      lines={[`Vin  ${o.vp.toFixed(2)} Vpp`, `Vout ${o.vo.toFixed(2)} Vpp`, `Gain ${o.G.toFixed(2)}`, `Sat  ${o.sat ? 'YES' : 'no'}`]}>
      {key !== 'buffer' && <Fb v={`${v.Rf} kΩ`} />}
      {key === 'buffer' && <Wire d="M350,140 H290 V88 H520 V180" />}
      {key === 'buffer' && <><Wire d="M120,220 H350" /><Src x={120} y={220} ac l="V_in" lx={0} ly={-26} /></>}
      {invt && <><Res x={230} y={140} l="R_i" v={`${v.Ri} kΩ`} /><Wire d="M100,140 H200 M260,140 H350 M350,220 H320" /><Gnd x={320} y={220} /><Src x={100} y={190} rot={90} ac lx={-40} l="V_in" /></>}
      {key === 'noninverting' && <><Wire d="M350,140 H230" /><Res x={200} y={140} l="R_i" v={`${v.Ri} kΩ`} /><Wire d="M170,140 H130" /><Gnd x={130} y={140} /><Wire d="M120,220 H350" /><Src x={120} y={258} rot={90} ac lx={-42} l="V_in" /></>}
      {key !== 'noninverting' && !invt && null}
      {nodes()}
    </OpStage>
  )
  return {
    controls: [sel('w', 'Input waveform', [['sine', 'Sine'], ['square', 'Square'], ['tri', 'Triangle']]), num('vp', 'Input amplitude', 0.2, 5, 0.1, 1, 'Vpp'), num('f', 'Frequency', 1, 100, 1, 1, 'kHz'), ...(key === 'buffer' ? [] : [sel('Ri', 'R_i', RK, 10), sel('Rf', 'R_f', RK, key === 'inverting' ? 100 : 10)])],
    out: (v) => { const G = c.g(v), raw = G * v.vp, vo = Math.min(Math.abs(raw), 2 * VSAT); return { G, vp: v.vp, vo, sat: Math.abs(raw) > 2 * VSAT } },
    Stage,
    read: (v, o) => [['Output', o.vo.toFixed(2), 'Vpp'], ['Gain', o.G.toFixed(2), '']],
    columns: [['vp', 'Vin (Vpp)', 2], ['vo', 'Vout (Vpp)', 2], ['g', 'Gain', 2]],
    sample: (v, o) => { const vo = jitter(o.vo, 0.003); return { vp: v.vp, vo, g: vo / v.vp } },
    sweep: { list: (v) => steps(0.2, Math.min(5, Math.abs(1.9 * VSAT / c.g(v))), 8).map((vp) => ({ vp: +vp.toFixed(1) })) },
    graph: { x: 'vp', y: 'vo', xl: 'Input (Vpp)', yl: 'Output (Vpp)', fit: true },
    analyse: (r, v) => { const f = fit(r, 'vp', 'vo'); return f && [['Measured gain', f.m, '', Math.abs(c.g(v))]] },
  }
}
const ampSteps = ['Select the component values.', 'Apply a sine input and observe both traces.', 'Increase the input in steps and note the output.', 'Plot Vout against Vin to find the gain.']
const inverting = { id: 'inverting', title: 'Inverting amplifier', short: 'Gain = −R_f/R_i', aim: 'Build the inverting amplifier and verify its gain.', formula: 'A = − R_f / R_i', principle: 'The virtual ground at the inverting input forces all input current through R_f, so the output is inverted and scaled.', steps: ampSteps, ...opGain('inverting') }
const noninv = { id: 'non-inverting', title: 'Non-inverting amplifier', short: 'Gain = 1 + R_f/R_i', aim: 'Build the non-inverting amplifier and verify its gain.', formula: 'A = 1 + R_f / R_i', principle: 'Feedback holds the inverting input equal to the signal at the non-inverting input, so the output is an in-phase scaled copy.', steps: ampSteps, ...opGain('noninverting') }
const buffer = { id: 'voltage-follower', title: 'Voltage follower (buffer)', short: 'Unity gain', aim: 'Verify that the voltage follower copies its input with unity gain.', formula: 'V_o = V_in', principle: 'With full negative feedback the output tracks the input exactly while isolating the source from the load.', steps: ['Connect output to the inverting input.', 'Apply the input signal.', 'Compare the two traces.', 'Confirm the gain is one.'], ...opGain('buffer') }

const dcCtl = [num('v1', 'V₁', -5, 5, 0.1, 1.5, 'V'), num('v2', 'V₂', -5, 5, 0.1, 2.5, 'V'), sel('R', 'R₁ = R₂', RK, 10), sel('Rf', 'R_f', RK, 10)]
const adder = {
  id: 'adder', title: 'Adder (summing amplifier)', short: 'V_o = −(V₁ + V₂)R_f/R',
  aim: 'Add two voltages using the op-amp summing amplifier.',
  formula: 'V_o = −(R_f / R)(V₁ + V₂)',
  principle: 'The currents from both inputs add at the virtual ground and flow through the feedback resistor.',
  steps: ['Set two DC inputs.', 'Note the output voltage.', 'Change the inputs.', 'Compare with the calculation.'],
  controls: dcCtl,
  out: (v) => { const ideal = -(v.Rf / v.R) * (v.v1 + v.v2); return { ideal, vo: clamp(ideal, -VSAT, VSAT) } },
  Stage: ({ v, o, t }) => (
    <OpStage title="Adder" t={t} range={12.5} vin={() => v.v1 + v.v2} vout={() => o.vo} lines={[`V1   ${v.v1.toFixed(1)} V`, `V2   ${v.v2.toFixed(1)} V`, `Vout ${o.vo.toFixed(2)} V`, Math.abs(o.ideal) > VSAT ? 'Saturated' : 'Linear']}>
      <Fb v={`${v.Rf} kΩ`} />
      <Res x={200} y={120} l="R₁" v={`V₁ = ${v.v1} V`} /><Res x={200} y={180} l="" /><T x={200} y={212} s={11} a="middle" c={C.ink2}>R₂ · V₂ = {v.v2} V</T>
      <Wire d="M230,120 H290 V180 M230,180 H290 M290,140 H350 M350,220 H320" /><Gnd x={320} y={220} />
      {nodes()}
    </OpStage>
  ),
  read: (v, o) => [['Output', o.vo.toFixed(3), 'V']],
  columns: [['s', 'V₁+V₂ (V)', 2], ['vo', 'V_o (V)', 2]],
  sample: (v, o) => ({ s: v.v1 + v.v2, vo: wobble(o.vo, 0.01) }),
  sweep: { list: steps(-4, 4, 9).map((a) => ({ v1: +(a / 2).toFixed(1), v2: +(a / 2).toFixed(1) })) },
  graph: { x: 's', y: 'vo', xl: 'V₁ + V₂ (V)', yl: 'Output (V)', fit: true },
  analyse: (r, v) => { const f = fit(r, 's', 'vo'); return f && [['Slope', f.m, '', -v.Rf / v.R]] },
}
const subtractor = {
  id: 'subtractor', title: 'Subtractor (differential amplifier)', short: 'V_o = (R_f/R)(V₂ − V₁)',
  aim: 'Obtain the difference of two voltages using the op-amp differential configuration.',
  formula: 'V_o = (R_f / R)(V₂ − V₁)',
  principle: 'With matched resistors the amplifier responds only to the difference between the two inputs and rejects what is common to both.',
  steps: ['Set the two DC inputs.', 'Note the output.', 'Vary the difference.', 'Compare with the calculation.'],
  controls: dcCtl,
  out: (v) => { const ideal = (v.Rf / v.R) * (v.v2 - v.v1); return { ideal, vo: clamp(ideal, -VSAT, VSAT) } },
  Stage: ({ v, o, t }) => (
    <OpStage title="Subtractor" t={t} range={12.5} vin={() => v.v2 - v.v1} vout={() => o.vo} lines={[`V1   ${v.v1.toFixed(1)} V`, `V2   ${v.v2.toFixed(1)} V`, `Vout ${o.vo.toFixed(2)} V`, Math.abs(o.ideal) > VSAT ? 'Saturated' : 'Linear']}>
      <Fb v={`${v.Rf} kΩ`} />
      <Res x={200} y={140} l="R₁" v={`V₁ = ${v.v1} V`} /><Res x={200} y={220} l="" /><T x={200} y={252} s={11} a="middle" c={C.ink2}>R₂ · V₂ = {v.v2} V</T>
      <Wire d="M230,140 H350 M230,220 H350" />{nodes()}
    </OpStage>
  ),
  read: (v, o) => [['Output', o.vo.toFixed(3), 'V']],
  columns: [['d', 'V₂−V₁ (V)', 2], ['vo', 'V_o (V)', 2]],
  sample: (v, o) => ({ d: v.v2 - v.v1, vo: wobble(o.vo, 0.01) }),
  sweep: { list: steps(-4, 4, 9).map((a) => ({ v1: +(-a / 2).toFixed(1), v2: +(a / 2).toFixed(1) })) },
  graph: { x: 'd', y: 'vo', xl: 'V₂ − V₁ (V)', yl: 'Output (V)', fit: true },
  analyse: (r, v) => { const f = fit(r, 'd', 'vo'); return f && [['Slope', f.m, '', v.Rf / v.R]] },
}
const comparator = {
  id: 'comparator', title: 'Comparator', short: 'Output snaps at V_ref',
  aim: 'Use the op-amp as a comparator and observe the switching point.',
  formula: 'V_o = +V_sat if V_in > V_ref, otherwise −V_sat',
  principle: 'With no feedback the very high open-loop gain drives the output to a supply rail as soon as the inputs differ.',
  steps: ['Set the reference voltage.', 'Apply a sine input.', 'Watch the output square wave.', 'Move the reference and note the duty cycle.'],
  controls: [num('vr', 'Reference V_ref', -2.4, 2.4, 0.1, 0.5, 'V'), num('vp', 'Input amplitude', 1, 5, 0.1, 5, 'Vpp')],
  out: (v) => { const a = v.vp / 2, r = clamp(v.vr / a, -1, 1); const duty = (0.5 - Math.asin(r) / PI) * 100; return { duty } },
  Stage: ({ v, o, t }) => (
    <OpStage title="Comparator" t={t} range={12.5} vin={(u) => (v.vp / 2) * Math.sin(TAU * 3 * u)} vout={(u) => ((v.vp / 2) * Math.sin(TAU * 3 * u) > v.vr ? VSAT : -VSAT)} lines={[`Vref ${v.vr.toFixed(1)} V`, `Vin  ${v.vp.toFixed(1)} Vpp`, `High ${o.duty.toFixed(1)} %`, 'Open loop']}>
      <Wire d="M120,220 H350 M180,140 H350" /><Src x={120} y={220} ac l="V_in" lx={0} ly={-26} /><T x={120} y={144} s={12} w={700}>V_ref</T><Dot x={180} y={140} />{nodes()}
    </OpStage>
  ),
  read: (v, o) => [['Output high for', o.duty.toFixed(1), '%']],
  columns: [['vr', 'V_ref (V)', 1], ['d', 'Duty (%)', 1]],
  sample: (v, o) => ({ vr: v.vr, d: wobble(o.duty, 0.1) }),
  sweep: { k: 'vr', n: 13 },
  graph: { x: 'vr', y: 'd', xl: 'V_ref (V)', yl: 'Output high (%)' },
  analyse: (r) => [['Duty range', `${Math.min(...r.map((x) => x.d)).toFixed(0)}–${Math.max(...r.map((x) => x.d)).toFixed(0)}`, '%']],
}
const series6 = (type, integ, RC, n = 360) => {
  const dt = 1 / n, x = Array.from({ length: n }, (_, i) => wave(type, i * dt))
  if (integ) {
    let s = 0
    const y = x.map((a) => (s += a * dt))
    const m = mean(y)
    return y.map((a) => -(a - m) / RC)
  }
  return x.map((a, i) => -RC * (x[(i + 1) % n] - x[(i - 1 + n) % n]) / (2 * dt))
}
const caseOp = (kind) => {
  const integ = kind === 'int'
  const calc = (v) => {
    const per = 1 / (v.f * 1000), R = v.R * 1000, Cc = v.C * 1e-9
    const rc = integ ? (R * Cc) / per : (R * Cc) / per
    const arr = series6(v.w, integ, rc).map((a) => clamp((a * v.vp) / 2, -VSAT, VSAT))
    return { arr, vo: Math.max(...arr) - Math.min(...arr) }
  }
  const Stage = ({ v, o, t }) => (
    <OpStage title={integ ? 'Integrator' : 'Differentiator'} t={t} range={Math.max(5.5, Math.max(...o.arr.map(Math.abs)) * 1.15)} vin={(u) => (v.vp / 2) * wave(v.w, u * 3)} vout={(u) => o.arr[Math.floor(((u * 3) % 1) * 359.99)]}
      lines={[`f    ${v.f} kHz`, `Vin  ${v.vp.toFixed(1)} Vpp`, `Vout ${o.vo.toFixed(2)} Vpp`, `RC   ${(v.R * v.C).toFixed(0)} µs`]}>
      <Wire d="M290,140 V88 H390 M442,88 H520 V180 M350,220 H320" /><Gnd x={320} y={220} /><Dot x={290} y={140} /><Dot x={520} y={180} />
      {integ ? <Cap x={416} y={88} l="C" v={`${v.C} nF`} ly={-30} /> : <Res x={416} y={88} l="R" v={`${v.R} kΩ`} ly={-30} />}
      {integ ? <Res x={230} y={140} l="R" v={`${v.R} kΩ`} /> : <Cap x={230} y={140} l="C" v={`${v.C} nF`} />}
      <Wire d="M100,140 H200 M260,140 H350" /><Src x={100} y={190} rot={90} ac lx={-40} l="V_in" />{nodes()}
    </OpStage>
  )
  return {
    controls: [sel('w', 'Input waveform', integ ? [['square', 'Square'], ['sine', 'Sine'], ['tri', 'Triangle']] : [['tri', 'Triangle'], ['sine', 'Sine'], ['square', 'Square']]), num('vp', 'Input amplitude', 0.5, 5, 0.1, 2, 'Vpp'), num('f', 'Frequency', 1, 100, 1, integ ? 10 : 2, 'kHz'), sel('R', 'R', RK, 10), sel('C', 'C', [[1, '1 nF'], [10, '10 nF'], [100, '100 nF']], integ ? 10 : 10)],
    out: (v) => calc(v),
    Stage,
    read: (v, o) => [['Output', o.vo.toFixed(2), 'Vpp']],
    columns: [['f', 'f (kHz)', 0], ['x', integ ? '1/f (ms)' : 'f (kHz) ', 3], ['vo', 'Vout (Vpp)', 3]],
    sample: (v, o) => ({ f: v.f, x: integ ? 1 / v.f : v.f, vo: jitter(o.vo, 0.004) }),
    sweep: { list: (v) => (integ ? [10, 12, 15, 20, 25, 30, 40, 60, 80, 100] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((f) => ({ f, w: v.w })) },
    graph: { x: 'x', y: 'vo', xl: integ ? '1/f (ms)' : 'Frequency (kHz)', yl: 'Output (Vpp)', fit: true },
    analyse: (r, v) => {
      const f = fit(r, 'x', 'vo'); if (!f) return null
      const rcus = v.R * v.C, A = v.vp / 2
      const ideal = integ ? (v.w === 'square' ? (A * 0.5 * 1000) / rcus : null) : v.w === 'tri' ? (8 * rcus * A) / 1000 : null
      return [['Slope', f.m, integ ? 'V/ms' : 'V/kHz', ...(ideal ? [ideal] : [])], ['Linearity R²', f.r2.toFixed(4), ''], ['RC', rcus, 'µs']]
    },
  }
}
const integrator = { id: 'integrator', title: 'Op-amp integrator', short: 'Square in, triangle out', aim: 'Integrate an input waveform using a capacitor in the feedback path.', formula: 'V_o = −(1/RC) ∫ V_in dt', principle: 'The capacitor charges at a rate set by the input current, so its voltage is the time integral of the input. Output amplitude falls as 1/f.', steps: ['Apply a square wave.', 'Observe the triangular output.', 'Vary the frequency.', 'Plot the output against 1/f.'], ...caseOp('int') }
const differentiator = { id: 'differentiator', title: 'Op-amp differentiator', short: 'Triangle in, square out', aim: 'Differentiate an input waveform using a capacitor at the input.', formula: 'V_o = − R C dV_in/dt', principle: 'Capacitor current is proportional to the rate of change of the input and develops the output across R. Output amplitude rises with f.', steps: ['Apply a triangular wave.', 'Observe the square output.', 'Vary the frequency.', 'Plot the output against f.'], ...caseOp('dif') }
export const opAmp = [buffer, adder, subtractor, inverting, noninv, integrator, differentiator, comparator]

/* ---------- Regulated DC supply (PhyUGEq-1) ---------- */
const psu = (v) => {
  const Icv = v.V / v.RL
  const cc = Icv > v.Ilim
  const I = cc ? v.Ilim : Icv, V = cc ? v.Ilim * v.RL : v.V
  return { I, V, P: V * I, cc }
}
function StagePsu({ v, o, set }) {
  const Key = ({ x, y, l, on }) => (
    <g onClick={on} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width="44" height="34" rx="6" fill="url(#g-metal)" stroke={C.steel} /><T x={x + 22} y={y + 22} s={13} a="middle" w={600}>{l}</T>
    </g>
  )
  return (
    <Svg className="stage-svg bp">
      <Panel x={30} y={40} w={740} h={420} t="REGULATED DC POWER SUPPLY" sub="0–30 V · 0–3 A" r={16} />
      <rect x="60" y="80" width="430" height="220" rx="10" fill={C.lcd} stroke="#B9C5A0" />
      <T x={470} y={160} s={62} a="end" c={C.lcdInk} w={600}>{o.V.toFixed(2)}<tspan fontSize="24"> V</tspan></T>
      <T x={470} y={232} s={48} a="end" c={C.lcdInk} w={600}>{o.I.toFixed(3)}<tspan fontSize="20"> A</tspan></T>
      <T x={470} y={282} s={30} a="end" c={C.lcdInk} w={600}>{o.P.toFixed(2)}<tspan fontSize="16"> W</tspan></T>
      <T x={78} y={108} s={12} c={C.lcdInk} w={700}>Set {v.V.toFixed(1)} V / {v.Ilim.toFixed(2)} A</T>
      <Led x={530} y={110} on={!o.cc} c={C.green} l="CV" /><Led x={600} y={110} on={o.cc} c={C.red} l="CC" /><Led x={670} y={110} on={o.cc} c={C.amber} l="Limit" />
      <Key x={530} y={170} l="▲" on={() => set('V', clamp(+(v.V + 0.1).toFixed(1), 0, 30))} /><Key x={584} y={170} l="▼" on={() => set('V', clamp(+(v.V - 0.1).toFixed(1), 0, 30))} />
      <T x={645} y={193} s={11} c={C.ink2}>Voltage step</T>
      <Key x={530} y={216} l="+1" on={() => set('V', clamp(v.V + 1, 0, 30))} /><Key x={584} y={216} l="−1" on={() => set('V', clamp(v.V - 1, 0, 30))} />
      <T x={645} y={239} s={11} c={C.ink2}>Keypad entry</T>
      <Jack x={120} y={370} c={C.red} l="+" /><Jack x={200} y={370} c={C.ink} l="−" />
      <Wire d={`M120,370 V430 H640 V390 M200,370 V410 H560 V390`} on t={o.I * 2} />
      <rect x="540" y="330" width="120" height="60" rx="8" fill="#fff" stroke={C.steel} /><T x={600} y={356} s={12} a="middle" w={700}>Load</T><T x={600} y={374} s={12} a="middle" c={C.ink2}>{v.RL.toFixed(1)} Ω</T>
    </Svg>
  )
}
const psuCtl = [num('V', 'Set voltage', 0, 30, 0.1, 12, 'V'), num('Ilim', 'Current limit', 0.05, 3, 0.01, 1, 'A'), num('RL', 'Load resistance', 1, 100, 0.5, 24, 'Ω')]
const psuRead = (v, o) => [['Output', o.V.toFixed(2), 'V'], ['Current', o.I.toFixed(3), 'A'], ['Mode', o.cc ? 'Constant current' : 'Constant voltage', '']]
const psuRows = [['RL', 'R_L (Ω)', 1], ['V', 'V (V)', 2], ['I', 'I (A)', 3], ['m', 'Mode', 0]]
const psuSample = (v, o) => ({ RL: v.RL, V: wobble(o.V, 0.003), I: wobble(o.I, 0.0005), m: o.cc ? 'CC' : 'CV' })
export const psuKit = [
  { id: 'constant-voltage', title: 'Constant voltage mode', short: 'Load regulation', aim: 'Show that the output voltage is held constant as the load changes.', formula: 'V_out = V_set while I < I_limit', principle: 'In constant-voltage mode the regulator holds the output at the set value and the load decides the current.', steps: ['Enter the output voltage.', 'Set a generous current limit.', 'Change the load.', 'Note the voltage stays fixed.'],
    controls: psuCtl.map((c) => (c.k === 'Ilim' ? { ...c, init: 3 } : c)), out: (v) => psu(v), Stage: StagePsu, read: psuRead, columns: psuRows, sample: psuSample, sweep: { k: 'RL', n: 10, from: 5, to: 100 },
    graph: { x: 'I', y: 'V', xl: 'Current (A)', yl: 'Output voltage (V)' }, analyse: (r, v) => [['Mean output', mean(r.filter((x) => x.m === 'CV').map((x) => x.V)), 'V', v.V]] },
  { id: 'constant-current', title: 'Constant current mode', short: 'Limit holds the current', aim: 'Show that the supply holds its output current constant once the limit is reached.', formula: 'I_out = I_limit, V_out = I_limit × R_L', principle: 'When the load tries to draw more than the limit, the supply reduces its voltage so that the current stays at the set value.', steps: ['Set a low current limit.', 'Use a small load.', 'Change the load.', 'Note the current stays fixed.'],
    controls: psuCtl.map((c) => (c.k === 'RL' ? { ...c, init: 4 } : c)), out: (v) => psu(v), Stage: StagePsu, read: psuRead, columns: psuRows, sample: psuSample, sweep: { k: 'RL', n: 8, from: 1, to: 10 },
    graph: { x: 'RL', y: 'I', xl: 'Load (Ω)', yl: 'Output current (A)' }, analyse: (r, v) => [['Mean output current', mean(r.filter((x) => x.m === 'CC').map((x) => x.I)), 'A', v.Ilim]] },
  { id: 'current-limit-crossover', title: 'CV–CC crossover and limit alert', short: 'The V–I knee', aim: 'Find the load at which the supply switches from constant voltage to constant current, when the limit indicator lights.', formula: 'R_cross = V_set / I_limit', principle: 'Above the crossover resistance the supply regulates voltage. Below it the limit LED lights and the supply regulates current.', steps: ['Set voltage and limit.', 'Reduce the load gradually.', 'Note when the limit LED lights.', 'Compare with V/I.'],
    controls: psuCtl, out: (v) => psu(v), Stage: StagePsu, read: psuRead, columns: psuRows, sample: psuSample, sweep: { k: 'RL', n: 25, from: 2, to: 26 }, need: 6,
    graph: { x: 'I', y: 'V', xl: 'Current (A)', yl: 'Voltage (V)', curve: (v) => { const a = []; for (let R = 200; R > 0.5; R *= 0.95) { const s = psu({ ...v, RL: R }); a.push([s.I, s.V]) } return a }, modelLabel: 'V–I locus' },
    analyse: (r, v) => { const cv = r.filter((x) => x.m === 'CV'), cc = r.filter((x) => x.m === 'CC'); if (!cv.length || !cc.length) return [['Status', 'Readings must span both modes', '']]; const a = Math.min(...cv.map((x) => x.RL)), b = Math.max(...cc.map((x) => x.RL)); return [['Crossover resistance', (a + b) / 2, 'Ω', v.V / v.Ilim]] } },
]
