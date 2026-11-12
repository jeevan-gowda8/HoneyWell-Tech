import { Svg, T, Panel, Lcd, LcdText, Led, C, Scope, Ray, Eyepiece, Wire, Knob } from '../lib/parts'
import { num, sel, tog, TAU, PI, fit, jitter, wobble, sq, clamp, curve, mean, peaks, deg, rad, steps } from '../lib/math'

/* Mimic-panel chain of functional blocks. */
function Chain({ blocks, active = [], y = 58, x0 = 36, w = 728, h = 44 }) {
  const n = blocks.length, g = 12, bw = (w - g * (n - 1)) / n
  return (
    <g>
      {blocks.map((b, i) => {
        const x = x0 + i * (bw + g), on = active.includes(i)
        return (
          <g key={b}>
            {i < n - 1 && <line x1={x + bw} x2={x + bw + g} y1={y + h / 2} y2={y + h / 2} stroke={on ? C.t2 : C.line} strokeWidth="2.5" />}
            <rect x={x} y={y} width={bw} height={h} rx="8" fill={on ? '#FFF1E8' : '#fff'} stroke={on ? C.t2 : C.line} strokeWidth="1.5" />
            <T x={x + bw / 2} y={y + h / 2 + 4} s={10.5} a="middle" w={600}>{b}</T>
          </g>
        )
      })}
    </g>
  )
}
const Board = ({ title, children }) => (
  <Svg className="stage-svg bp">
    <rect x="14" y="14" width="772" height="472" rx="6" fill="url(#g-blackpanel)" stroke="#000" /><rect x="14" y="14" width="772" height="472" rx="6" fill="url(#g-sheen)" />
    <T x={32} y={40} s={12} w={700} c={C.silk} letterSpacing=".06em">{title}</T>
    <Led x={748} y={36} on c={C.green} /><T x={736} y={40} s={10} a="end" c={C.ink2}>±12 V ±5 V</T>
    {children}
  </Svg>
)
const Spectrum = ({ x, y, w, h, bars, title = 'SPECTRUM' }) => {
  const base = y + h - 34, mx = Math.max(...bars.map((b) => b[1]), 1)
  return (
    <g>
      <Panel x={x} y={y} w={w} h={h} t={title} />
      <line x1={x + 14} x2={x + w - 14} y1={base} y2={base} stroke={C.steel} />
      {bars.map(([pos, a, l], i) => {
        const bx = x + w / 2 + pos * (w / 2 - 34), bh = (a / mx) * (h - 76)
        return <g key={i}><rect x={bx - 4} y={base - bh} width="8" height={Math.max(1, bh)} rx="3" fill={C.t1} /><T x={bx} y={base + 15} s={10} a="middle" c={C.ink2}>{l}</T></g>
      })}
    </g>
  )
}

const CY = 44 // carrier cycles shown on screen
const SIX = ['Audio osc', 'Carrier 1 MHz', 'Balanced mod', 'BPF', 'Antenna']
const fcHz = 1000, fk = (x) => `${(x / 1000).toFixed(1)}k`
const dsbfc = {
  id: 'dsb-fc', title: 'DSB full carrier generation', short: 'Modulation index', aim: 'Generate an AM (DSB-FC) wave and determine its modulation index.', formula: 'm = (V_max − V_min) / (V_max + V_min)', principle: 'The carrier amplitude follows the audio signal. The envelope shows the modulation index, and above m = 1 the envelope distorts.', steps: ['Set the carrier and audio levels.', 'Observe the envelope.', 'Measure V_max and V_min.', 'Plot m against audio amplitude.'],
  controls: [num('Am', 'Audio amplitude', 0, 1.5, 0.05, 0.6, 'V'), num('Ac', 'Carrier amplitude', 0.5, 1.5, 0.1, 1, 'V'), num('fm', 'Audio frequency', 300, 3400, 100, 1000, 'Hz')],
  out: (v) => { const m = v.Am / v.Ac; return { m, Vmax: v.Ac * (1 + m), Vmin: v.Ac * Math.abs(1 - m) } },
  Stage: ({ v, o, t }) => {
    const sc = 1 / (v.Ac * 2.5)
    const y = (u) => v.Ac * (1 + o.m * Math.cos(TAU * 2 * u + t)) * Math.cos(TAU * CY * u) * sc
    return (
      <Board title="AM TRANSMITTER · DSB-FC">
        <Chain blocks={SIX} active={[0, 1, 2, 3, 4]} />
        <Scope x={36} y={118} w={500} h={350} title="MODULATED OUTPUT" n={1200} tr={[{ f: y }]} />
        <Spectrum x={548} y={118} w={216} h={190} bars={[[-0.65, (o.m * v.Ac) / 2, 'LSB'], [0, v.Ac, '1 MHz'], [0.65, (o.m * v.Ac) / 2, 'USB']]} />
        <Panel x={548} y={320} w={216} h={148} t="MEASURED" /><Lcd x={560} y={356} w={192} h={40} value={o.m.toFixed(3)} label="Index m" s={18} /><LcdText x={560} y={414} w={192} h={44} s={13} lines={[`Vmax ${o.Vmax.toFixed(2)}`, `Vmin ${o.Vmin.toFixed(2)}`]} />
      </Board>
    )
  },
  read: (v, o) => [['Modulation index', o.m.toFixed(3), ''], ['Status', o.m > 1 ? 'Over-modulated' : 'Normal', '']],
  columns: [['Am', 'A_m (V)', 2], ['Vmax', 'V_max (V)', 3], ['Vmin', 'V_min (V)', 3], ['m', 'm', 3]],
  sample: (v, o) => { const Vmax = jitter(o.Vmax, 0.004), Vmin = Math.max(0, jitter(o.Vmin, 0.004)); return { Am: v.Am, Vmax, Vmin, m: (Vmax - Vmin) / (Vmax + Vmin) } },
  sweep: { k: 'Am', n: 9, from: 0.1, to: 0.9 },
  graph: { x: 'Am', y: 'm', xl: 'Audio amplitude (V)', yl: 'Modulation index', fit: true },
  analyse: (r, v) => { const f = fit(r, 'Am', 'm'); return f && [['Slope (1/A_c)', f.m, '1/V', 1 / v.Ac]] },
}
const dsbsc = {
  id: 'dsb-sc', title: 'DSB suppressed carrier', short: 'Phase reversals', aim: 'Generate a DSB-SC signal with the balanced modulator and see that the carrier is suppressed.', formula: 's(t) = A m(t) cos(2π f_c t)', principle: 'A balanced modulator multiplies the two inputs. The carrier disappears from the output, the sidebands remain, and the wave flips phase at each zero crossing of the audio.', steps: ['Balance the modulator.', 'Apply the audio.', 'Observe the phase reversals.', 'Note the sideband frequencies.'],
  controls: [num('Am', 'Audio amplitude', 0.1, 1, 0.05, 0.8, 'V'), num('fm', 'Audio frequency', 300, 3400, 100, 1000, 'Hz'), num('bal', 'Carrier leakage', 0, 20, 1, 0, '%')],
  out: (v) => ({ usb: fcHz + v.fm / 1000, lsb: fcHz - v.fm / 1000 }),
  Stage: ({ v, o, t }) => (
    <Board title="AM TRANSMITTER · DSB-SC">
      <Chain blocks={SIX} active={[0, 1, 2, 3]} />
      <Scope x={36} y={118} w={500} h={350} title="BALANCED MODULATOR OUTPUT" n={1200} tr={[{ f: (u) => (v.Am * Math.cos(TAU * 2 * u + t) + v.bal / 100) * Math.cos(TAU * CY * u) * 0.9 }]} />
      <Spectrum x={548} y={118} w={216} h={190} bars={[[-0.65, v.Am / 2, 'LSB'], [0, Math.max(0.002, v.bal / 100), 'fc'], [0.65, v.Am / 2, 'USB']]} />
      <Panel x={548} y={320} w={216} h={148} t="SIDEBANDS (kHz)" /><LcdText x={560} y={356} w={192} h={60} s={15} lines={[`USB ${o.usb.toFixed(1)}`, `LSB ${o.lsb.toFixed(1)}`]} />
    </Board>
  ),
  read: (v, o) => [['USB', o.usb.toFixed(1), 'kHz'], ['LSB', o.lsb.toFixed(1), 'kHz']],
  columns: [['fm', 'f_m (Hz)', 0], ['usb', 'USB (kHz)', 1], ['lsb', 'LSB (kHz)', 1]],
  sample: (v, o) => ({ fm: v.fm, usb: o.usb, lsb: o.lsb }),
  sweep: { k: 'fm', n: 8 },
  graph: { x: 'fm', y: 'usb', xl: 'Audio frequency (Hz)', yl: 'Upper sideband (kHz)', fit: true, zero: false },
  analyse: (r) => { const f = fit(r, 'fm', 'usb'); return f && [['Implied carrier', f.c, 'kHz', fcHz]] },
}
const filt = (fk2) => 1 / Math.sqrt(1 + (((fk2 - 455) / 2.2) ** 8))
const FC2 = 452.5
const ssb = {
  id: 'ssb-sc', title: 'SSB suppressed carrier', short: '455 kHz ceramic filter', aim: 'Generate an SSB signal with the 455 kHz balanced modulator and ceramic filter.', formula: 'H(f) passes 455 ± 2 kHz', principle: 'The filter is narrow enough to pass one sideband only. Placing the carrier near its lower edge passes the upper sideband and rejects the lower.', steps: ['Generate DSB-SC at the 452.5 kHz carrier.', 'Pass it through the ceramic filter.', 'Vary the audio frequency.', 'Measure the sideband rejection.'],
  controls: [num('fm', 'Audio frequency', 300, 3400, 100, 1500, 'Hz')],
  out: (v) => { const usb = FC2 + v.fm / 1000, lsb = FC2 - v.fm / 1000; return { usb, lsb, U: filt(usb), L: filt(lsb) } },
  Stage: ({ o, t }) => (
    <Board title="AM TRANSMITTER · SSB-SC">
      <Chain blocks={['Audio', 'Carrier 452.5k', 'Balanced mod', 'Ceramic 455k', 'Out']} active={[0, 1, 2, 3, 4]} />
      <Scope x={36} y={118} w={500} h={350} title="FILTER OUTPUT" n={1200} tr={[{ f: (u) => 0.85 * (o.U * Math.cos(TAU * CY * u + t) + o.L * Math.cos(TAU * (CY - 4) * u)) / (o.U + o.L) }]} />
      <Spectrum x={548} y={118} w={216} h={190} bars={[[-0.65, o.L, 'LSB'], [0.65, o.U, 'USB']]} />
      <Panel x={548} y={320} w={216} h={148} t="REJECTION" /><Lcd x={560} y={362} w={192} value={(20 * Math.log10(o.U / o.L)).toFixed(1)} unit="dB" />
    </Board>
  ),
  read: (v, o) => [['USB gain', o.U.toFixed(3), ''], ['LSB gain', o.L.toFixed(3), ''], ['Rejection', (20 * Math.log10(o.U / o.L)).toFixed(1), 'dB']],
  columns: [['fm', 'f_m (Hz)', 0], ['U', 'USB', 3], ['L', 'LSB', 3], ['dB', 'Rejection (dB)', 1]],
  sample: (v, o) => { const U = jitter(o.U, 0.003), L = jitter(o.L, 0.006); return { fm: v.fm, U, L, dB: 20 * Math.log10(U / L) } },
  sweep: { k: 'fm', n: 16 },
  graph: { x: 'fm', y: 'dB', xl: 'Audio frequency (Hz)', yl: 'Sideband rejection (dB)' },
  analyse: (r) => { const m = r.reduce((a, b) => (b.dB > a.dB ? b : a)); return [['Best rejection', m.dB, 'dB'], ['At audio frequency', m.fm, 'Hz']] },
}
const envCalc = (v, m = 0.6) => {
  const N = 900, dt = 1 / (N * 10), T1 = 1e-3, rc = v.rc * 1e-6, E = (x) => 1 + m * Math.cos(TAU * x)
  let y = E(0), err = 0
  const out = []
  for (let i = 0; i < N; i++) {
    const u = i / N, e = E(u * 2)
    const decayed = y * Math.exp(-(dt * 20 * T1) / rc)
    y = Math.max(e, decayed)
    out.push(y)
    err += sq(y - e)
  }
  return { out, dist: (Math.sqrt(err / N) / m) * 100 }
}
const ssbDemod = {
  id: 'ssb-demodulation', title: 'SSB demodulation', short: 'Balanced demodulator',
  aim: 'Recover the audio from an SSB-SC signal with the balanced demodulator, and see how an error in the re-inserted carrier shifts the pitch.',
  formula: 'f_out = f_m + Δf_c',
  principle: 'The balanced demodulator multiplies the SSB signal by a locally re-inserted carrier. With that carrier exactly on the suppressed carrier the original tone returns. Any offset shifts every audio frequency by the same amount, which is why mistuned SSB voices sound high or low.',
  steps: ['Generate SSB-SC through Balanced Modulator 1 and the 455 kHz BPF.', 'Patch the BPF output to SIGNAL IN and the RF carrier to CARRIER on the balanced demodulator.', 'Set the carrier offset away from zero in steps.', 'Plot the recovered frequency against the carrier offset.'],
  controls: [num('fm', 'Audio frequency', 300, 3400, 100, 1000, 'Hz'), num('df', 'Carrier offset', -500, 500, 10, 0, 'Hz')],
  out: (v) => ({ fo: Math.max(0, v.fm + v.df) }),
  Stage: ({ v, o, t }) => (
    <Board title="AM TRAINER · BALANCED DEMODULATOR">
      <Chain blocks={['SSB in', 'Bal. demod', 'Carrier 455k', 'LPF', 'Audio']} active={[0, 1, 2, 3, 4]} />
      <Scope x={36} y={118} w={728} h={268} title="RECOVERED AUDIO" n={600} tr={[{ f: (u) => 0.85 * Math.sin(TAU * (o.fo / 1000) * 3 * u + t * 2), l: 'Output' }, { f: (u) => 0.5 * Math.sin(TAU * (v.fm / 1000) * 3 * u + t * 2), l: 'Sent' }]} />
      <Lcd x={40} y={420} w={230} value={v.fm} unit="Hz" label="Sent tone" /><Lcd x={285} y={420} w={230} value={v.df} unit="Hz" label="Carrier offset" /><Lcd x={530} y={420} w={230} value={o.fo} unit="Hz" label="Recovered" />
    </Board>
  ),
  read: (v, o) => [['Recovered tone', o.fo.toFixed(0), 'Hz'], ['Pitch error', v.df.toFixed(0), 'Hz']],
  columns: [['df', 'Δf (Hz)', 0], ['fo', 'f_out (Hz)', 0]],
  sample: (v, o) => ({ df: v.df, fo: wobble(o.fo, 2) }),
  sweep: { k: 'df', n: 11 },
  graph: { x: 'df', y: 'fo', xl: 'Carrier offset (Hz)', yl: 'Recovered frequency (Hz)', fit: true, zero: false },
  analyse: (r, v) => { const f = fit(r, 'df', 'fo'); return f && [['Slope', f.m, '', 1], ['Tone at zero offset', f.c, 'Hz', v.fm]] },
}
/* Fault-finding exercise: a hidden fault breaks the chain at one block. */
const faultExp = (blocks, cnt, title, prefix) => {
  const hidden = Array.from({ length: cnt }, (_, i) => (i * 5 + 2) % blocks.length)
  const status = (v) => (v.f === 0 ? Infinity : hidden[v.f - 1])
  return {
    id: 'fault-diagnosis', title: 'Switched fault diagnosis', short: 'Probe the test points',
    aim: 'Find a hardware fault by probing the test points stage by stage.', formula: 'The fault lies between the last good test point and the first bad one',
    principle: `The instructor enables a hidden fault switch. Tracing the signal from input to output shows where it disappears, which isolates the faulty stage. This kit has ${cnt} switched faults.`,
    steps: ['Choose a fault switch.', 'Probe the test points from the input.', 'Record where the signal disappears.', 'Name the faulty stage.'],
    controls: [sel('f', 'Fault switch', [[0, 'None'], ...hidden.map((_, i) => [i + 1, `F${i + 1}`])], 3), num('tp', 'Test point', 1, blocks.length, 1, 1)],
    out: (v) => ({ ok: v.tp - 1 < status(v) }),
    Stage: ({ v, o, t }) => (
      <Board title={title}>
        <Chain blocks={blocks} active={blocks.map((_, i) => i).filter((i) => i < v.tp)} />
        {blocks.map((_, i) => { const n = blocks.length, bw = (728 - 12 * (n - 1)) / n, x = 36 + i * (bw + 12) + bw / 2, cur = i === v.tp - 1; return <g key={i}><circle cx={x} cy={118} r={cur ? 8 : 5} fill={cur ? C.t2 : '#fff'} stroke={cur ? C.t2 : C.ink2} strokeWidth="2" /><T x={x} y={142} s={10.5} a="middle" c={C.ink2}>{prefix}{i + 1}</T></g> })}
        <Scope x={36} y={160} w={500} h={306} title={`PROBE AT ${prefix}${v.tp}`} tr={[{ f: (u) => (o.ok ? 0.82 * Math.sin(TAU * 8 * u + t * 4) * (0.7 + 0.3 * Math.cos(TAU * u * 2)) : 0.02 * Math.sin(u * 300)) }]} />
        <Panel x={548} y={160} w={216} h={306} t="DIAGNOSIS" />
        <Led x={656} y={230} r={16} on={o.ok} c={o.ok ? C.green : C.red} /><T x={656} y={275} s={16} a="middle" w={700}>{o.ok ? 'Signal present' : 'No signal'}</T>
        <T x={656} y={330} s={12} a="middle" c={C.ink2}>Stage: {blocks[v.tp - 1]}</T>
      </Board>
    ),
    read: (v, o) => [['Probe', `${prefix}${v.tp}`, ''], ['Signal', o.ok ? 'Present' : 'Absent', '']],
    columns: [['tp', 'Test point', 0], ['st', 'Stage', 0], ['s', 'Signal', 0], ['ok', 'OK', 0]],
    sample: (v, o) => ({ tp: v.tp, st: blocks[v.tp - 1], s: o.ok ? 'Present' : 'Absent', ok: o.ok ? 1 : 0, f: v.f }),
    sweep: { list: blocks.map((_, i) => ({ tp: i + 1 })) }, need: 2,
    analyse: (r, v) => {
      const s = [...r].sort((a, b) => a.tp - b.tp), bad = s.find((x) => !x.ok)
      if (!bad) return [['Diagnosis', v.f === 0 ? 'No fault in the chain' : 'Probe further', '']]
      const correct = hidden[v.f - 1] === bad.tp - 1
      return [['Faulty stage', bad.st, ''], ['Check', correct ? 'Correct' : 'Probe the earlier points', '']]
    },
  }
}
export const amKit = [dsbfc, dsbsc, ssb, ssbDemod, faultExp(['AF gen', 'RF gen', 'Bal Mod', '455k BPF', 'Bal Demod', 'Audio amp'], 8, 'AM TRAINER · FAULT SIMULATION', 'TP')]

/* ---------- Optical fibre trainer (EleEq-47) ---------- */
const N1 = 1.492, N2 = 1.406, NAF = Math.sqrt(N1 * N1 - N2 * N2)
const Fiber = ({ y = 220, x1 = 150, x2 = 620, bend, t, on = 1, c = C.red }) => {
  const d = bend ? `M${x1},${y} C${x1 + 130},${y} ${x1 + 180},${y + bend} 385,${y + bend} S${x2 - 130},${y} ${x2},${y}` : `M${x1},${y} H${x2}`
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#2B3650" strokeWidth="11" />
      <path d={d} stroke={c} strokeWidth="4" opacity={0.3 + 0.7 * on} />
      <path d={d} stroke="#fff" strokeWidth="2" strokeDasharray="2 24" strokeDashoffset={-t * 90} opacity={on} />
    </g>
  )
}
const Ofc = ({ title, children }) => <Board title={`FIBER OPTIC TRAINER · ${title}`}>{children}</Board>
const lam = (v) => (v.l === 660 ? C.red : '#8B5CF6')
const lamCtl = sel('l', 'LED wavelength', [[660, '660 nm'], [950, '950 nm']], 660)
const Tx = ({ x = 50, y = 180, l }) => (<g><rect x={x} y={y} width="100" height="80" rx="10" fill="#fff" stroke={C.steel} /><T x={x + 50} y={y + 34} s={12} a="middle" w={700}>LED Tx</T><T x={x + 50} y={y + 54} s={11} a="middle" c={C.ink2}>{l} nm</T></g>)
const Rx = ({ x = 620, y = 180 }) => (<g><rect x={x} y={y} width="100" height="80" rx="10" fill="#fff" stroke={C.steel} /><T x={x + 50} y={y + 34} s={12} a="middle" w={700}>Detector</T><T x={x + 50} y={y + 54} s={11} a="middle" c={C.ink2}>Rx</T></g>)
const na = {
  id: 'numerical-aperture', title: 'Numerical aperture measurement', short: 'The NA jig', aim: 'Determine the numerical aperture of the plastic fibre with the measurement jig.', formula: 'NA = sin θ = (D/2) / √(L² + (D/2)²)', principle: 'Light exits the fibre in a cone whose half-angle is the acceptance angle. Measuring the spot size at a known distance gives NA.', steps: ['Set the screen at a distance L.', 'Measure the spot diameter.', 'Repeat for other distances.', 'Calculate NA.'],
  controls: [num('L', 'Screen distance', 5, 30, 1, 12, 'mm')],
  out: (v) => { const th = Math.asin(NAF); return { th, D: 2 * v.L * Math.tan(th) } },
  Stage: ({ v, o }) => {
    const x = 150 + v.L * 14, sp = o.D * 7
    return (
      <Ofc title="NA JIG">
        <rect x="40" y="228" width="110" height="24" fill="#2B3650" /><T x={95} y={220} s={11} a="middle" c={C.ink2}>PMMA fibre</T>
        <path d={`M150,240 L${x},${240 - sp} V${240 + sp} Z`} fill={C.red} opacity=".22" />
        <ellipse cx={x} cy="240" rx="12" ry={sp} fill={C.red} opacity=".75" />
        <rect x={x + 6} y={50 + 20} width="10" height="340" fill={C.steel} />
        <T x={x + 26} y={240} s={12} w={600}>Screen</T>
        <Panel x={560} y={80} w={210} h={300} t="JIG SCALE" /><Lcd x={574} y={130} w={182} value={v.L} unit="mm" label="L" /><Lcd x={574} y={210} w={182} value={o.D.toFixed(2)} unit="mm" label="D" /><Lcd x={574} y={290} w={182} value={deg(o.th).toFixed(1)} unit="°" label="Half-angle" />
      </Ofc>
    )
  },
  read: (v, o) => [['Spot D', o.D.toFixed(2), 'mm']],
  columns: [['L', 'L (mm)', 0], ['D', 'D (mm)', 2], ['na', 'NA', 3]],
  sample: (v, o) => { const D = wobble(o.D, 0.03); return { L: v.L, D, na: (D / 2) / Math.sqrt(v.L * v.L + sq(D / 2)) } },
  sweep: { k: 'L', n: 9 },
  graph: { x: 'L', y: 'D', xl: 'Distance L (mm)', yl: 'Spot diameter D (mm)', fit: true },
  analyse: (r) => [['Numerical aperture', mean(r.map((x) => x.na)), '', NAF], ['Full acceptance angle', 2 * deg(Math.asin(mean(r.map((x) => x.na)))), '°', 2 * deg(Math.asin(NAF))]],
}
const P0 = (l) => (l === 660 ? 1000 : 780)
const alphaL = (l) => (l === 660 ? 0.22 : 2.6)
const bendLoss = (R) => 6.5 * Math.exp(-R / 12)
const bending = {
  id: 'bending-loss', title: 'Bending loss', short: 'Loss against bend radius', aim: 'Measure the additional loss caused by bending the fibre.', formula: 'Loss (dB) = 10 log₁₀(P_straight / P_bent)', principle: 'Tight bends push rays past the critical angle so that they escape from the core. The loss grows quickly as the bend radius falls.', steps: ['Note the straight-fibre power.', 'Wind the fibre round a mandrel.', 'Note the power again.', 'Plot loss against radius.'],
  controls: [lamCtl, num('R', 'Bend radius', 5, 60, 1, 15, 'mm')],
  out: (v) => { const Pin = P0(v.l), loss = bendLoss(v.R); return { Pin, loss, P: Pin * Math.pow(10, -loss / 10) } },
  Stage: ({ v, o, t }) => (
    <Ofc title="BENDING LOSS">
      <Tx l={v.l} /><Rx />
      <Fiber bend={clamp(1800 / v.R, 30, 180)} t={t} c={lam(v)} on={clamp(o.P / o.Pin, 0.1, 1)} />
      <Panel x={40} y={362} w={720} h={106} t="OPTICAL POWER" /><Lcd x={60} y={402} w={210} value={o.P.toFixed(1)} unit="µW" label="Received" /><Lcd x={295} y={402} w={210} value={o.loss.toFixed(2)} unit="dB" label="Bend loss" /><Lcd x={530} y={402} w={210} value={v.R} unit="mm" label="Radius" />
    </Ofc>
  ),
  read: (v, o) => [['Loss', o.loss.toFixed(2), 'dB']],
  columns: [['R', 'R (mm)', 0], ['loss', 'Loss (dB)', 2]],
  sample: (v, o) => ({ R: v.R, loss: Math.max(0, wobble(o.loss, 0.02)) }),
  sweep: { k: 'R', n: 12 },
  graph: { x: 'R', y: 'loss', xl: 'Bend radius (mm)', yl: 'Loss (dB)', curve: () => curve(bendLoss, 5, 60) },
  analyse: (r) => [['Loss at tightest bend', r.reduce((a, b) => (b.R < a.R ? b : a)).loss, 'dB']],
}
const prop = {
  id: 'propagation-loss', title: 'Propagation loss', short: 'Two cable lengths', aim: 'Determine the attenuation of the fibre by comparing the 0.5 m and 1 m cables at 660 nm and 950 nm.', formula: 'α = 10 log₁₀(P₁/P₂) / (L₂ − L₁)', principle: 'Plastic fibre absorbs much more at 950 nm than at 660 nm, which is why the shorter wavelength is preferred for longer links.', steps: ['Connect the 0.5 m cable and note the power.', 'Change to the 1 m cable.', 'Calculate α.', 'Repeat at the other wavelength.'],
  controls: [lamCtl, sel('c', 'Cable length', [[0.5, '0.5 m'], [1, '1 m'], [1.5, '1.5 m (joined)']], 0.5)],
  out: (v) => ({ P: P0(v.l) * Math.pow(10, (-alphaL(v.l) * v.c) / 10) }),
  Stage: ({ v, o, t }) => (
    <Ofc title="PROPAGATION LOSS">
      <Tx l={v.l} /><Rx />
      <Fiber t={t} c={lam(v)} on={clamp(o.P / P0(v.l), 0.1, 1)} />
      <T x={385} y={196} s={13} a="middle" w={700}>{v.c} m PMMA · SMA</T>
      <Panel x={40} y={362} w={720} h={106} t="OPTICAL POWER" /><Lcd x={60} y={402} w={330} value={o.P.toFixed(1)} unit="µW" label="Received" /><Lcd x={410} y={402} w={330} value={(10 * Math.log10(o.P / 1000)).toFixed(2)} unit="dBm" label="Level" />
    </Ofc>
  ),
  read: (v, o) => [['Received', o.P.toFixed(1), 'µW']],
  columns: [['l', 'λ (nm)', 0], ['c', 'L (m)', 1], ['db', 'P (dB rel)', 3]],
  sample: (v, o) => ({ l: v.l, c: v.c, db: 10 * Math.log10(wobble(o.P, 0.3) / P0(v.l)) }),
  sweep: { list: [0.5, 1, 1.5].map((c) => ({ c })) },
  graph: { x: 'c', y: 'db', xl: 'Cable length (m)', yl: 'Power (dB relative)', fit: true },
  analyse: (r, v) => { const f = fit(r.filter((x) => x.l === v.l), 'c', 'db'); return f && [['Attenuation α', -f.m, 'dB/m', alphaL(v.l)]] },
}
const ledI = (V, l) => { const Vf = l === 660 ? 1.75 : 1.2; return V < Vf - 0.25 ? 0 : 60 * Math.pow(Math.max(0, V - (Vf - 0.25)), 1.7) }
const led = {
  id: 'led-vi', title: 'LED V–I characteristic', short: 'Electro-optic converter', aim: 'Study the V–I characteristic of the LED used as the electro-optic converter.', formula: 'I rises steeply beyond V_f', principle: 'An LED conducts appreciable current only above its forward voltage, which is higher for shorter wavelengths.', steps: ['Set the LED drive.', 'Note the voltage and current.', 'Repeat in steps.', 'Find the knee voltage.'],
  controls: [lamCtl, num('V', 'Forward voltage', 0, 2.4, 0.02, 1.8, 'V')],
  out: (v) => ({ I: ledI(v.V, v.l) }),
  Stage: ({ v, o, t }) => (
    <Ofc title="LED V–I">
      <Tx l={v.l} /><Fiber t={t} c={lam(v)} on={clamp(o.I / 30, 0, 1)} x2={520} />
      <circle cx="150" cy="220" r={clamp(o.I, 0, 50)} fill={lam(v)} opacity=".18" />
      <Panel x={530} y={120} w={230} h={240} t="DRIVER" /><Lcd x={544} y={170} w={202} value={v.V.toFixed(2)} unit="V" label="V_f" /><Lcd x={544} y={250} w={202} value={o.I.toFixed(2)} unit="mA" label="I_f" />
    </Ofc>
  ),
  read: (v, o) => [['Current', o.I.toFixed(2), 'mA']],
  columns: [['V', 'V (V)', 2], ['I', 'I (mA)', 2]],
  sample: (v, o) => ({ V: v.V, I: Math.max(0, wobble(o.I, 0.05)) }),
  sweep: { k: 'V', n: 16, from: 0.9, to: 2.4 },
  graph: { x: 'V', y: 'I', xl: 'Forward voltage (V)', yl: 'Current (mA)', curve: (v) => curve((V) => ledI(V, v.l), 0, 2.4), live: (v) => [v.V, ledI(v.V, v.l)] },
  analyse: (r, v) => { const on = [...r].sort((a, b) => a.V - b.V).find((x) => x.I > 1); return on ? [['Knee voltage', on.V, 'V', v.l === 660 ? 1.6 : 1.05]] : [['Status', 'No conduction yet', '']] },
}
const photo = {
  id: 'photodetector', title: 'Photodetector characteristics', short: 'Responsivity', aim: 'Measure the output of the photodetector against incident optical power.', formula: 'I_p = R P', principle: 'Incident photons create electron–hole pairs in proportion to optical power. Silicon detectors respond more strongly at 950 nm.', steps: ['Set the optical power.', 'Note the photocurrent.', 'Repeat in steps.', 'Find the responsivity.'],
  controls: [lamCtl, num('P', 'Incident power', 10, 500, 10, 200, 'µW')],
  out: (v) => { const R = v.l === 660 ? 0.42 : 0.62; return { R, I: R * v.P } },
  Stage: ({ v, o, t }) => (
    <Ofc title="PHOTODETECTOR">
      <Tx l={v.l} /><Fiber t={t} c={lam(v)} on={v.P / 500} x2={520} /><rect x="520" y="192" width="20" height="56" fill="#2B3650" />
      <Panel x={560} y={120} w={200} h={240} t="RECEIVER" /><Lcd x={574} y={170} w={172} value={v.P} unit="µW" label="Input" /><Lcd x={574} y={250} w={172} value={o.I.toFixed(1)} unit="µA" label="I_p" />
    </Ofc>
  ),
  read: (v, o) => [['Photocurrent', o.I.toFixed(1), 'µA']],
  columns: [['P', 'P (µW)', 0], ['I', 'I_p (µA)', 2]],
  sample: (v, o) => ({ P: v.P, I: wobble(o.I, 0.3) }),
  sweep: { k: 'P', n: 10, from: 50, to: 500 },
  graph: { x: 'P', y: 'I', xl: 'Optical power (µW)', yl: 'Photocurrent (µA)', fit: true },
  analyse: (r, v) => { const f = fit(r, 'P', 'I'); return f && [['Responsivity', f.m, 'A/W', v.l === 660 ? 0.42 : 0.62]] },
}
const bwH = (f) => 1 / Math.sqrt(1 + Math.pow(f / 3.4, 8))
const modSim = {
  id: 'am-fm-pwm-link', title: 'AM, FM and PWM over fibre', short: 'Analog link and filter', aim: 'Send a message over the fibre with AM, FM and PWM and study the 3.4 kHz receive filter.', formula: '|H| = 1 / √(1 + (f/3.4 kHz)⁸)', principle: 'The message modulates the LED drive by amplitude, frequency or pulse width. After detection, a fourth-order Butterworth filter removes anything above 3.4 kHz.', steps: ['Choose a modulation type.', 'Set the audio frequency.', 'Compare the transmitted and received signals.', 'Plot the filter response.'],
  controls: [sel('m', 'Modulation', [['am', 'AM'], ['fm', 'FM'], ['pwm', 'PWM']], 'am'), num('f', 'Message frequency', 0.2, 8, 0.1, 1, 'kHz')],
  out: (v) => ({ H: bwH(v.f) }),
  Stage: ({ v, o, t }) => {
    const msg = (u) => Math.sin(TAU * 3 * u + t)
    const tx = (u) => {
      if (v.m === 'am') return (0.55 + 0.4 * msg(u)) * Math.sin(TAU * 40 * u)
      if (v.m === 'fm') return Math.sin(TAU * 26 * u + 5 * Math.sin(TAU * 3 * u + t))
      return ((u * 24) % 1) < 0.5 + 0.42 * msg(u) ? 0.85 : -0.85
    }
    return (
      <Ofc title="MODULATION LINK">
        <Chain blocks={['Message', 'Modulator', 'LED', 'Fibre', 'Photodiode', 'Demod', 'LPF 3.4k']} active={[0, 1, 2, 3, 4, 5, 6]} />
        <Scope x={36} y={118} w={728} h={174} title="TRANSMITTED (LED DRIVE)" n={1200} tr={[{ f: tx }]} />
        <Scope x={36} y={302} w={510} h={166} title="RECEIVED" tr={[{ f: (u) => 0.9 * msg(u), l: 'Sent' }, { f: (u) => 0.9 * o.H * msg(u - 0.015), l: 'Rx' }]} />
        <Panel x={558} y={302} w={206} h={166} t="FILTER" /><Lcd x={570} y={346} w={182} value={o.H.toFixed(3)} label="|H|" /><Lcd x={570} y={414} w={182} h={40} value={v.f.toFixed(1)} unit="kHz" s={18} />
      </Ofc>
    )
  },
  read: (v, o) => [['Gain', o.H.toFixed(3), '']],
  columns: [['f', 'f (kHz)', 1], ['H', '|H|', 3]],
  sample: (v, o) => ({ f: v.f, H: Math.max(0, wobble(o.H, 0.003)) }),
  sweep: { list: steps(0.4, 6, 29).map((f) => ({ f: +f.toFixed(1) })) }, need: 6,
  graph: { x: 'f', y: 'H', xl: 'Message frequency (kHz)', yl: 'Filter gain |H|', curve: () => curve(bwH, 0.2, 8) },
  analyse: (r) => { const s = [...r].sort((a, b) => a.f - b.f); for (let i = 0; i < s.length - 1; i++) if (s[i].H >= 0.707 && s[i + 1].H < 0.707) return [['Cut-off', s[i].f + ((s[i].H - 0.707) / (s[i].H - s[i + 1].H)) * (s[i + 1].f - s[i].f), 'kHz', 3.4]]; return [['Status', 'Readings must span the cut-off', '']] },
}
const WORDS = ['HELLO', 'FIBER', 'HONEYWELL']
const duplex = {
  id: 'rs232-duplex', title: 'Full-duplex RS232 over fibre', short: 'PC to PC at 19200 baud', aim: 'Send serial data between two PCs simultaneously over the two fibre channels at 19200 baud.', formula: 'Frame = 1 start + 8 data + 1 stop', principle: 'Two independent fibres carry data in opposite directions, so both ends can transmit at the same time. The animation is slowed so the frames are visible.', steps: ['Choose the words to send.', 'Start the link.', 'Watch the frames on each fibre.', 'Check received text at each end.'],
  controls: [sel('a', 'PC A sends', WORDS.map((w) => [w, w]), 'HELLO'), sel('b', 'PC B sends', WORDS.map((w) => [w, w]), 'FIBER'), num('r', 'Display speed', 0.5, 4, 0.5, 1.5, 'char/s')],
  out: (v, t) => { const n = Math.floor(t * v.r); return { n, ra: v.b.slice(0, n % (v.b.length + 3)), rb: v.a.slice(0, n % (v.a.length + 3)) } },
  Stage: ({ v, o, t }) => {
    const ch = v.a.charCodeAt(o.n % v.a.length)
    const frame = [0, ...Array.from({ length: 8 }, (_, i) => (ch >> i) & 1), 1]
    return (
      <Ofc title="FULL-DUPLEX RS232">
        <Panel x={36} y={70} w={170} h={220} t="PC A" /><LcdText x={48} y={110} w={146} h={160} lines={['TX', v.a, '', 'RX', o.ra]} s={15} />
        <Panel x={594} y={70} w={170} h={220} t="PC B" /><LcdText x={606} y={110} w={146} h={160} lines={['TX', v.b, '', 'RX', o.rb]} s={15} />
        <Fiber y={130} x1={206} x2={594} t={t} /><Fiber y={230} x1={206} x2={594} t={-t} c="#8B5CF6" />
        <T x={400} y={112} s={12} a="middle" w={600}>A → B</T><T x={400} y={212} s={12} a="middle" w={600}>B → A</T>
        <Scope x={36} y={304} w={728} h={164} title="UART FRAME ON THE LINE" n={600} tr={[{ f: (u) => (frame[Math.floor(u * 10)] ? 0.7 : -0.7) }]} />
      </Ofc>
    )
  },
  read: (v, o) => [['Bit time', '52.08', 'µs'], ['Received at A', o.ra || '—', ''], ['Received at B', o.rb || '—', '']],
}
export const ofcKit = [na, bending, prop, led, photo, modSim, duplex, faultExp(['Mic', 'AC amp', 'Tx driver', 'Fibre', 'Rx', 'Comparator', 'Filter', 'Speaker'], 8, 'FIBER OPTIC TRAINER · FAULT SIMULATION', 'P')]
