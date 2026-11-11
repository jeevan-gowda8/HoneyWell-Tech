import { Svg, T, Bench, Panel, Lcd, LcdText, C, Ray, Eyepiece, usePixels, Dim, Knob } from '../lib/parts'
import { num, sel, tog, TAU, PI, fit, jitter, wobble, sq, rad, deg, snap, clamp, curve, mean, dips } from '../lib/math'

const NA = 589.3e-9 // sodium mean wavelength, m
const sodium = (I) => { const a = clamp(I, 0, 1); return [40 + 215 * a, 32 + 178 * a, 8 + 40 * a] }

/* ---------- 3. Air wedge kit (PhyUGEx-35) ---------- */
function KitBody({ children, reading, lamp = true }) {
  return (
    <>
      <Bench />
      <Panel light x={30} y={60} w={330} h={385} t="INTEGRATED OPTICAL UNIT" sub="Cast aluminium" />
      <rect x="60" y="100" width="90" height="46" rx="6" fill="#39445C" />
      <circle cx="150" cy="123" r="16" fill={lamp ? 'url(#g-glow)' : '#EEE'} />
      <T x={66} y={93} s={10} c={C.ink2} w={600}>Sodium source · 35 W</T>
      <Ray x1={155} y1={123} x2={215} y2={123} c={C.amber} o={0.8} />
      <line x1="195" y1="150" x2="238" y2="98" stroke={C.ink2} strokeWidth="4" />
      <T x={245} y={92} s={10} c={C.ink2}>45° reflector</T>
      <Ray x1={215} y1={123} x2={215} y2={330} c={C.amber} o={0.65} />
      <rect x="196" y="150" width="38" height="110" rx="4" fill="#E2E6EE" stroke={C.steel} />
      <rect x="205" y="130" width="20" height="24" fill={C.ink2} rx="3" />
      <T x={243} y={205} s={10} c={C.ink2}>Microscope</T><T x={243} y={218} s={10} c={C.ink2}>10× / 3×</T>
      {children}
      <rect x="70" y="372" width="250" height="18" rx="3" fill={C.steel} />
      <T x={195} y={414} s={11} a="middle" c={C.ink2}>Micrometer stage · LC 0.01 mm</T>
      <Lcd x={90} y={420} w={210} h={24} s={13} value={reading} unit="mm" />
    </>
  )
}

function StageWedge({ v, o }) {
  const beta = o.beta * 1000 // mm
  const span = 1.2 // field width in mm
  const x = o.x
  const href = usePixels(170, 170, (u) => {
    const pos = x + (u - 0.5) * span, ph = (TAU * pos) / beta
    return sodium(0.08 + 0.9 * sq(Math.sin(ph / 2)))
  }, [beta.toFixed(5), x.toFixed(3)])
  const wedge = 12 + v.obj * 0.35
  return (
    <Svg>
      <KitBody reading={x.toFixed(2)}>
        <path d={`M100,350 L330,${350 - wedge}`} stroke="#6FB1D6" strokeWidth="5" />
        <line x1="100" x2="330" y1="353" y2="353" stroke="#6FB1D6" strokeWidth="5" />
        <rect x="318" y={350 - wedge} width="8" height={wedge} fill={C.t2} />
        <T x={120} y={342 - wedge / 3} s={10} c={C.ink2}>Glass plates</T>
      </KitBody>
      <Eyepiece cx={585} cy={190} r={125} id="ew" href={href} label="Field of view through the eyepiece">
        <line x1={585} x2={585} y1={65} y2={315} stroke="#fff" strokeWidth="1.5" />
        <line x1={460} x2={710} y1={190} y2={190} stroke="#fff" strokeWidth="1.5" />
      </Eyepiece>
      <T x={585} y={378} s={13} a="middle" w={600}>Fringe no. {v.n}</T>
      <T x={585} y={398} s={12} a="middle" c={C.ink2}>Move the stage to bring fringes under the cross-wire</T>
    </Svg>
  )
}

const OBJ = { 30: ['Fine foil', 30], 75: ['Paper strip', 75], 110: ['Fibre', 110] }
const wedge = {
  id: 'air-wedge-thickness', title: 'Air wedge: thickness of an object', short: 'Fringe width to thickness',
  aim: 'Measure the thickness of a thin object from the fringe width of an air wedge.',
  formula: 'β = λ L / (2 t)     t = λ L / (2 β)',
  principle: 'Two flat plates touching at one end and separated by the object at the other enclose a wedge of air. Sodium light forms straight, equally spaced fringes whose spacing shrinks as the wedge steepens.',
  steps: ['Select the object placed at the wedge end.', 'Focus the microscope on the fringes.', 'Move to successive fringe numbers and note each micrometer reading.', 'Find β from the slope, then calculate t.'],
  controls: [sel('obj', 'Object in wedge', Object.entries(OBJ).map(([k, a]) => [+k, a[0]]), 75), num('L', 'Wedge length L', 40, 80, 5, 60, 'mm'), num('n', 'Fringe number under cross-wire', 0, 30, 1, 0)],
  out: (v) => { const beta = (NA * (v.L / 1000)) / (2 * v.obj * 1e-6); return { beta, x: v.n * beta * 1000 } },
  Stage: StageWedge,
  read: (v, o) => [['Micrometer', o.x.toFixed(2), 'mm'], ['Fringe no.', v.n, ''], ['Wavelength', '589.3', 'nm']],
  columns: [['n', 'Fringe', 0], ['x', 'Reading (mm)', 2]],
  sample: (v, o) => ({ n: v.n, x: snap(wobble(o.x, 0.004), 0.01) }),
  sweep: { k: 'n', n: 11 },
  graph: { x: 'n', y: 'x', xl: 'Fringe number', yl: 'Micrometer reading (mm)', fit: true },
  analyse: (r, v) => { const f = fit(r, 'n', 'x'); return f && [['Fringe width β', f.m, 'mm'], ['Thickness t', ((NA * v.L) / (2 * f.m)) * 1e6, 'µm', v.obj]] },
  tip: 'The object is treated as unknown: its true value is only used to score your result.',
}

function StageNewton({ v, o }) {
  const span = 2.5 // mm across the field
  const href = usePixels(280, 280, (u, w) => {
    const r = Math.hypot((u - 0.5) * span, (w - 0.5) * span) * 1e-3
    const t = (r * r) / (2 * v.R * 1e-3)
    return sodium(0.04 + 0.92 * sq(Math.sin((TAU * t) / NA)))
  }, [v.R])
  const rr = (o.D / 2 / span) * 250
  return (
    <Svg>
      <KitBody reading={o.D.toFixed(2)}>
        <path d="M130,350 Q215,310 300,350 Z" fill={C.glass} stroke="#6FB1D6" />
        <line x1="100" x2="330" y1="353" y2="353" stroke="#6FB1D6" strokeWidth="5" />
        <T x={215} y={344} s={10} a="middle" c={C.ink2}>Plano-convex lens</T>
      </KitBody>
      <Eyepiece cx={585} cy={190} r={125} id="en" href={href} label="Newton's rings">
        <circle cx={585} cy={190} r={rr} fill="none" stroke={C.t1} strokeWidth="2" strokeDasharray="5 4" />
      </Eyepiece>
      <T x={585} y={378} s={13} a="middle" w={600}>Dark ring n = {v.n}</T>
    </Svg>
  )
}
const newton = {
  id: 'newtons-rings', title: "Newton's rings: wavelength of sodium", short: 'D² against ring order',
  aim: 'Use the plano-convex lens and glass plate supplied with the kit to determine the wavelength of sodium light.',
  formula: 'Dₙ² = 4 n R λ     λ = slope / (4 R)',
  principle: 'The curved lens on a flat plate forms a thin air film that produces concentric dark rings. The square of the ring diameter increases linearly with ring order.',
  steps: ['Set the lens radius found with the spherometer.', 'Centre the cross-wire on the ring pattern.', 'Measure the diameter of successive rings.', 'Find λ from the slope of D² against n.'],
  controls: [num('R', 'Radius of curvature R', 90, 110, 1, 100, 'mm'), num('n', 'Ring order n', 1, 16, 1, 4)],
  out: (v) => ({ D: 2 * Math.sqrt(v.n * (v.R * 1e-3) * NA) * 1000 }),
  Stage: StageNewton,
  read: (v, o) => [['Diameter Dₙ', o.D.toFixed(2), 'mm'], ['Dₙ²', sq(o.D).toFixed(3), 'mm²']],
  columns: [['n', 'Ring n', 0], ['D', 'D (mm)', 2], ['D2', 'D² (mm²)', 3]],
  sample: (v, o) => { const D = snap(wobble(o.D, 0.003), 0.01); return { n: v.n, D, D2: D * D } },
  sweep: { k: 'n', n: 16 },
  graph: { x: 'n', y: 'D2', xl: 'Ring order n', yl: 'D² (mm²)', fit: true },
  analyse: (r, v) => { const f = fit(r, 'n', 'D2'); return f && [['Wavelength λ', ((f.m * 1e-6) / (4 * v.R * 1e-3)) * 1e9, 'nm', 589.3]] },
}

function StageSphero({ v, o }) {
  const y0 = 300, bump = o.h * 16, tipY = y0 - v.s * 16
  return (
    <Svg>
      <Bench />
      <Panel light x={40} y={80} w={470} h={370} t="SPHEROMETER ON LENS" sub="Three-leg brass" />
      <line x1="90" x2="460" y1={y0} y2={y0} stroke="#6FB1D6" strokeWidth="6" />
      <path d={`M150,${y0} Q275,${y0 - bump * 2} 400,${y0} Z`} fill={C.glass} stroke="#6FB1D6" />
      <line x1="150" y1={y0} x2="180" y2="170" stroke={C.brass} strokeWidth="7" /><line x1="400" y1={y0} x2="370" y2="170" stroke={C.brass} strokeWidth="7" />
      <rect x="160" y="150" width="230" height="26" rx="6" fill={C.brass} stroke="#9B7B2C" />
      <rect x="269" y={tipY - 160} width="12" height={165} fill={C.ink2} />
      <path d={`M269,${tipY + 5} L281,${tipY + 5} L275,${tipY + 14} Z`} fill={C.ink} />
      <rect x="225" y={tipY - 180} width="100" height="22" rx="6" fill="url(#g-metal)" stroke={C.steel} />
      <Dim x1={150} y1={330} x2={400} y2={330} l={`Leg separation l = ${o.l} mm`} off={-8} />
      <Panel x={540} y={80} w={230} h={210} t="READING" />
      <Lcd x={556} y={130} w={198} value={v.s.toFixed(2)} unit="mm" label="Screw above plate (LC 0.01 mm)" />
      <Lcd x={556} y={205} w={198} value={o.touch ? 'CONTACT' : (o.gap > 0 ? 'ABOVE' : 'PRESSING')} label="Tip status" s={18} />
    </Svg>
  )
}
const sphero = {
  id: 'spherometer', title: 'Radius of curvature with spherometer', short: 'Sag of the lens',
  aim: 'Determine the radius of curvature of the supplied plano-convex lens with the spherometer.',
  formula: 'R = l² / (6 h) + h / 2',
  principle: 'The central screw is raised from the flat plate by the sag h of the lens, measured against the three-leg base of side l.',
  steps: ['Choose the lens.', 'Lower the screw until it just touches the lens surface.', 'Record the sag and repeat.', 'Calculate R.'],
  controls: [sel('f', 'Lens focal length', [[180, '180 mm'], [200, '200 mm'], [220, '220 mm']], 200), num('s', 'Screw height', 0, 8, 0.01, 6.5, 'mm')],
  out: (v) => {
    const l = 50, R = 0.5 * v.f
    const h = R - Math.sqrt(R * R - (l * l) / 3) // from R = l^2/6h + h/2
    return { l, R, h, gap: v.s - h, touch: Math.abs(v.s - h) < 0.03 }
  },
  Stage: StageSphero,
  read: (v, o) => [['Screw', v.s.toFixed(2), 'mm'], ['Contact', o.touch ? 'Yes' : 'No', '']],
  columns: [['h', 'Sag h (mm)', 2], ['R', 'R (mm)', 1]],
  sample: (v, o) => { if (!o.touch) return { error: 'Bring the screw tip into contact with the lens first.' }; const h = snap(wobble(o.h, 0.01), 0.01); return { h, R: (o.l * o.l) / (6 * h) + h / 2 } },
  sweep: { list: (v) => Array.from({ length: 5 }, () => { const R = 0.5 * v.f; return { s: +(R - Math.sqrt(R * R - 2500 / 3)).toFixed(2) } }) },
  need: 2,
  analyse: (r, v) => [['Mean R', mean(r.map((x) => x.R)), 'mm', 0.5 * v.f]],
}
export const airWedge = [wedge, newton, sphero]

/* ---------- Brewster kit (PhyUGEx-48, PhyPGEx-18) ---------- */
const GLASS = { 1.52: 'Crown glass', 1.62: 'Flint glass', 1.46: 'Fused silica' }
const fresnel = (i, n) => {
  const r = Math.asin(Math.sin(i) / n)
  const rs = (Math.cos(i) - n * Math.cos(r)) / (Math.cos(i) + n * Math.cos(r))
  const rp = (n * Math.cos(i) - Math.cos(r)) / (n * Math.cos(i) + Math.cos(r))
  return [rs * rs, rp * rp]
}
const SCALE = 700 // detector reading per unit reflectance
const refl = (th, n, phi) => { const [Rs, Rp] = fresnel(rad(th), n); return SCALE * (Rp * sq(Math.cos(rad(phi))) + Rs * sq(Math.sin(rad(phi)))) + 0.15 }

function StageBrewster({ v, o }) {
  const cx = 400, cy = 250, R = 190, a = rad(v.th)
  const inA = [cx - Math.sin(a) * R, cy - Math.cos(a) * R]
  const outA = [cx + Math.sin(a) * R, cy - Math.cos(a) * R]
  return (
    <Svg>
      <Bench y={470} />
      <circle cx={cx} cy={cy} r={R + 30} fill="#fff" stroke={C.line} />
      <circle cx={cx} cy={cy} r={R + 10} fill="url(#g-metal)" stroke={C.steel} />
      {Array.from({ length: 72 }, (_, i) => { const b = rad(i * 5), big = i % 6 === 0; return <line key={i} x1={cx + Math.cos(b) * (R + 10)} y1={cy + Math.sin(b) * (R + 10)} x2={cx + Math.cos(b) * (R + (big ? 28 : 20))} y2={cy + Math.sin(b) * (R + (big ? 28 : 20))} stroke={C.ink3} /> })}
      <circle cx={cx} cy={cy} r={R - 40} fill="#F7F8FA" stroke={C.line} />
      <line x1={cx} x2={cx} y1={cy} y2={cy - R + 40} stroke={C.ink3} strokeDasharray="5 5" />
      <rect x={cx - 72} y={cy} width="144" height="20" fill={C.glass} stroke="#6FB1D6" />
      <T x={cx} y={cy + 38} s={11} a="middle" c={C.ink2}>{GLASS[v.n]}</T>
      <Ray x1={inA[0]} y1={inA[1]} x2={cx} y2={cy} />
      <Ray x1={cx} y1={cy} x2={outA[0]} y2={outA[1]} o={clamp(0.08 + o.I / 60, 0.08, 1)} />
      <g transform={`translate(${inA[0]},${inA[1]}) rotate(${v.th})`}>
        <rect x="-16" y="-52" width="32" height="56" rx="4" fill={C.ink2} />
        <T x={0} y={-58} s={10} a="middle" c={C.ink2} transform="rotate(0)">650 nm</T>
      </g>
      <g transform={`translate(${outA[0]},${outA[1]}) rotate(${-v.th})`}>
        <rect x="-18" y="-46" width="36" height="46" rx="4" fill={C.t1} />
      </g>
      <Panel x={18} y={24} w={180} h={120} t="PHOTO DETECTOR" />
      <Lcd x={32} y={70} w={150} value={o.I.toFixed(1)} unit="µA" label="Current" />
      <Panel x={602} y={24} w={180} h={120} t="POLARIZER" />
      <Knob x={648} y={84} val={(v.phi + 90) / 180} r={22} />
      <T x={688} y={82} s={20} w={700} c={C.silk}>{v.phi}°</T>
      <T x={688} y={100} s={10} c={C.silk2}>{v.phi === 0 ? 'p-polarised' : v.phi === 90 ? 's-polarised' : 'mixed'}</T>
      <T x={cx - R - 12} y={cy + 40} s={13} a="end" w={700} c={C.t2}>i = {v.th.toFixed(1)}°</T>
    </Svg>
  )
}
export const brewster = (uniqueN) => [
  {
    id: 'brewster-angle', title: uniqueN ? "Verification of Brewster's law" : 'Refractive index of glass', short: 'Reflected minimum',
    aim: uniqueN ? "Verify Brewster's law by locating the angle at which p-polarised reflection vanishes." : "Determine the refractive index of a glass slab from its Brewster angle.",
    formula: 'tan θ_B = n',
    principle: 'When reflected and refracted rays are perpendicular, the p-polarised component cannot be reflected. The detector current falls to a minimum at the Brewster angle.',
    steps: ['Set the polarizer to 0° for p-polarised light.', 'Rotate the table through the incidence angles.', 'Note the detector current at each angle.', 'Locate the minimum and calculate n = tan θ_B.'],
    controls: [sel('n', 'Glass sample', Object.entries(GLASS).map(([k, l]) => [+k, l]), 1.52), num('th', 'Angle of incidence', 40, 75, 0.5, 50, '°'), num('phi', 'Polarizer angle', 0, 90, 5, 0, '°')],
    out: (v) => ({ I: refl(v.th, v.n, v.phi) }),
    Stage: StageBrewster,
    read: (v, o) => [['Detector current', o.I.toFixed(2), 'µA'], ['tan i', Math.tan(rad(v.th)).toFixed(3), '']],
    columns: [['th', 'i (°)', 1], ['I', 'I (µA)', 2]],
    sample: (v, o) => ({ th: v.th, I: Math.max(0, jitter(o.I, 0.006)) }),
    sweep: { k: 'th', n: 36, from: 45, to: 67.5 },
    need: 12,
    graph: { x: 'th', y: 'I', xl: 'Angle of incidence (°)', yl: 'Detector current (µA)', curve: (v) => curve((a) => refl(a, v.n, v.phi), 40, 75), zero: false, live: (v) => [v.th, refl(v.th, v.n, v.phi)] },
    analyse: (r, v) => {
      const m = r.reduce((a, b) => (b.I < a.I ? b : a))
      return [['Brewster angle θ_B', m.th, '°', deg(Math.atan(v.n))], ['Refractive index n', Math.tan(rad(m.th)), '', v.n]]
    },
  },
  {
    id: 'malus-law', title: "Malus's law with the polarizer", short: 'I against cos²θ',
    aim: 'Confirm the transmitted intensity law using the laser, polarizer and detector.',
    formula: 'I = I₀ cos² θ',
    principle: 'The diode laser is linearly polarised. A rotating polarizer passes only the component along its axis, so the detector follows cos²θ.',
    steps: ['Align the laser straight into the detector.', 'Rotate the polarizer in steps.', 'Note the current each time.', 'Plot I against cos²θ.'],
    controls: [num('phi', 'Polarizer angle', -90, 90, 5, 20, '°')],
    out: (v) => ({ I: 150 * sq(Math.cos(rad(v.phi))) }),
    Stage: ({ v, o }) => (
      <Svg>
        <Bench y={330} />
        <rect x="60" y="300" width="680" height="30" fill="url(#g-metal)" stroke={C.steel} />
        <T x={400} y={352} s={11} a="middle" c={C.ink2}>Triangular optical bench · 300 mm</T>
        <rect x="80" y="170" width="110" height="46" rx="6" fill={C.ink2} /><T x={135} y={160} s={11} a="middle" c={C.ink2}>Diode laser 650 nm</T>
        <Ray x1={190} y1={193} x2={380} y2={193} />
        <Ray x1={420} y1={193} x2={620} y2={193} o={clamp(o.I / 150 + 0.05, 0.05, 1)} />
        <circle cx="400" cy="193" r="62" fill="rgba(70,110,180,.12)" stroke={C.ink} strokeWidth="5" />
        <g transform={`rotate(${v.phi} 400 193)`}>{Array.from({ length: 9 }, (_, i) => <line key={i} x1={376 + i * 6} x2={376 + i * 6} y1={140} y2={246} stroke={C.ink2} />)}<line x1="400" x2="400" y1="118" y2="268" stroke={C.t2} strokeWidth="3" /></g>
        <rect x="620" y="166" width="70" height="54" rx="6" fill={C.t1} /><T x={655} y={156} s={11} a="middle" c={C.ink2}>Detector</T>
        <Lcd x={590} y={250} w={140} value={o.I.toFixed(1)} unit="µA" />
        <T x={400} y={100} s={14} a="middle" w={700}>Axis at {v.phi}°</T>
      </Svg>
    ),
    read: (v, o) => [['Detector current', o.I.toFixed(1), 'µA'], ['cos²θ', sq(Math.cos(rad(v.phi))).toFixed(3), '']],
    columns: [['phi', 'θ (°)', 0], ['c2', 'cos²θ', 3], ['I', 'I (µA)', 1]],
    sample: (v, o) => ({ phi: v.phi, c2: sq(Math.cos(rad(v.phi))), I: wobble(o.I, 0.4) }),
    sweep: { k: 'phi', n: 19, from: -90, to: 90 },
    graph: { x: 'c2', y: 'I', xl: 'cos²θ', yl: 'Current (µA)', fit: true },
    analyse: (r) => { const f = fit(r, 'c2', 'I'); return f && [['I₀ from slope', f.m, 'µA', 150], ['Linearity R²', f.r2.toFixed(4), '']] },
  },
]

/* ---------- Michelson interferometer (PhyUGEx-80, PhyPGEx-20) ---------- */
function Layout({ d, extra, label }) {
  const cx = 230, cy = 240, shift = clamp(d, 0, 90)
  return (
    <g>
      <Panel light x={18} y={30} w={410} h={420} t="INTERFEROMETER" sub="Top view" />
      <circle cx="60" cy={cy} r="14" fill="url(#g-glow)" /><rect x="34" y={cy - 18} width="24" height="36" rx="3" fill={C.ink2} />
      <Ray x1={60} y1={cy} x2={cx} y2={cy} c={C.amber} o={0.8} />
      <Ray x1={cx} y1={cy} x2={cx} y2={70} c={C.amber} o={0.75} />
      <Ray x1={cx} y1={cy} x2={370 + shift * 0.2} y2={cy} c={C.amber} o={0.75} />
      <Ray x1={cx} y1={cy} x2={cx} y2={420} c={C.amber} o={0.9} />
      <line x1={cx - 26} y1={cy + 26} x2={cx + 26} y2={cy - 26} stroke="#6FB1D6" strokeWidth="6" />
      <rect x={cx - 26} y="54" width="52" height="12" fill={C.ink2} /><T x={cx + 34} y={64} s={11} c={C.ink2}>M₂ fixed</T>
      <rect x={370 + shift * 0.2} y={cy - 26} width="12" height="52" fill={C.t2} /><T x={384} y={cy - 36} s={11} a="end" c={C.t2} w={600}>M₁ moves</T>
      <rect x={cx - 18} y="422" width="36" height="20" rx="3" fill={C.ink2} /><T x={cx + 28} y={437} s={11} c={C.ink2}>Telescope</T>
      <T x={120} y={cy - 12} s={10.5} c={C.ink2}>Beam splitter 50/50</T>
      {extra}
      {label}
    </g>
  )
}

function StageMichelson({ v, o, t }) {
  const dMove = o.d
  const lam1 = v.mode === 'doublet' ? 589.0 : 589.3, lam2 = 589.6
  const href = usePixels(180, 180, (u, w) => {
    const r2 = sq(u - 0.5) + sq(w - 0.5)
    const ph = (d, l) => TAU * ((2 * d * 1000) / l - 30 * r2)
    if (v.mode === 'doublet') {
      const I = 0.5 + 0.25 * (Math.cos(ph(dMove, lam1)) + Math.cos(ph(dMove, lam2)))
      return sodium(I)
    }
    return sodium(0.5 + 0.48 * Math.cos(ph(dMove, 589.3)))
  }, [dMove.toFixed(3), v.mode])
  void t
  return (
    <Svg>
      <Bench />
      <Layout d={dMove % 90} />
      <Eyepiece cx={620} cy={180} r={130} id="em" href={href} label="Fringes in the telescope" />
      <Panel x={480} y={360} w={290} h={90} t="MICROMETER" />
      <Lcd x={494} y={392} w={262} value={(dMove / 1000).toFixed(4)} unit="mm" s={20} />
    </Svg>
  )
}
const lamRow = (N, d) => ({ N, d })
const mdIn = (v, t) => v.d + (v.motor ? t * 0.45 : 0)

export const michelsonNa = [
  {
    id: 'sodium-wavelength', title: 'Wavelength of sodium D line', short: 'Fringe counting',
    aim: 'Determine the wavelength of the sodium D line by counting fringes as the mirror is displaced.',
    formula: '2 d = N λ     λ = 2 × slope(d–N)',
    principle: 'Each time M₁ moves by λ/2 the path difference changes by one wavelength and one circular fringe appears or vanishes at the centre.',
    steps: ['Align the mirrors to obtain circular fringes.', 'Turn the fine screw and watch the centre.', 'Note the micrometer reading after every 40 fringes.', 'Find λ from the slope of d against N.'],
    controls: [num('d', 'M₁ position', 0, 60, 0.1, 5, 'µm'), tog('motor', 'Drive mirror continuously', false), sel('mode', 'Light', [['single', 'Sodium D']], 'single')],
    out: (v, t) => ({ d: mdIn(v, t) }),
    Stage: StageMichelson,
    read: (v, o) => [['Displacement', o.d.toFixed(2), 'µm'], ['Fringes passed N', Math.floor((2 * o.d * 1000) / 589.3), '']],
    columns: [['N', 'N', 0], ['d', 'd (µm)', 2]],
    sample: (v, o) => { const N = Math.round((2 * o.d * 1000) / 589.3); return lamRow(N, wobble((N * 589.3) / 2000, 0.03)) },
    sweep: { k: 'd', n: 11, from: 5, to: 55 },
    graph: { x: 'N', y: 'd', xl: 'Fringes counted N', yl: 'Mirror displacement (µm)', fit: true },
    analyse: (r) => { const f = fit(r, 'N', 'd'); return f && [['Wavelength λ', 2000 * f.m, 'nm', 589.3]] },
  },
  {
    id: 'sodium-doublet', title: 'Separation of the sodium doublet', short: 'Visibility minima',
    aim: 'Measure the wavelength separation of the sodium D₁ and D₂ lines from the fading of fringe visibility.',
    formula: 'Δd = λ² / (2 Δλ)     Δλ = λ² / (2 Δd)',
    principle: 'The two lines form independent fringe systems. Moving the mirror takes them in and out of step, so visibility falls to zero periodically.',
    steps: ['Move the mirror over a long range.', 'Find positions of least visibility.', 'Measure the spacing between consecutive minima.', 'Calculate Δλ.'],
    controls: [num('d', 'M₁ position', 0, 1500, 5, 60, 'µm'), sel('mode', 'Light', [['doublet', 'D₁ + D₂']], 'doublet')],
    out: (v) => ({ d: v.d, V: Math.abs(Math.cos((PI * 2 * v.d * 1000 * 0.6) / sq(589.3))) }),
    Stage: StageMichelson,
    read: (v, o) => [['Displacement', o.d.toFixed(0), 'µm'], ['Visibility', o.V.toFixed(3), '']],
    columns: [['d', 'd (µm)', 0], ['V', 'Visibility', 3]],
    sample: (v, o) => ({ d: v.d, V: Math.max(0, wobble(o.V, 0.004)) }),
    sweep: { k: 'd', n: 61 },
    need: 20,
    graph: { x: 'd', y: 'V', xl: 'Mirror displacement (µm)', yl: 'Fringe visibility', curve: () => curve((d) => Math.abs(Math.cos((PI * 2 * d * 1000 * 0.6) / sq(589.3))), 0, 1500, 400), live: (v) => [v.d, Math.abs(Math.cos((PI * 2 * v.d * 1000 * 0.6) / sq(589.3)))] },
    analyse: (r) => {
      const m = dips(r, 'd', 'V', 3)
      if (m.length < 2) return [['Minima found', String(m.length), '']]
      const dd = (m[m.length - 1].d - m[0].d) / (m.length - 1)
      return [['Spacing of minima Δd', dd, 'µm', 289.4], ['Δλ', sq(589.3) / (2 * dd * 1000), 'nm', 0.6]]
    },
    tip: 'Auto-collect sweeps the full 1.5 mm travel so several minima appear.',
  },
]

function StageGlass({ v, o }) {
  const href = usePixels(180, 180, (u, w) => {
    const r2 = sq(u - 0.5) + sq(w - 0.5)
    return sodium(0.5 + 0.48 * Math.cos(TAU * (o.path - 30 * r2)))
  }, [o.path.toFixed(3)])
  return (
    <Svg>
      <Bench />
      <Layout d={0} extra={v.ins && <rect x={288} y={200} width={Math.max(6, v.t / 3)} height="80" fill="rgba(80,150,210,.45)" stroke="#6FB1D6" />} />
      <T x={300} y={192} s={11} c={C.t1} w={600}>{v.ins ? 'Sheet in arm' : ''}</T>
      <Eyepiece cx={620} cy={180} r={130} id="eg" href={href} label="Fringes in the telescope" />
      <Panel x={480} y={360} w={290} h={90} t="FRINGE SHIFT" />
      <Lcd x={494} y={392} w={262} value={v.ins ? o.N.toFixed(1) : '0.0'} unit="N" s={20} />
    </Svg>
  )
}
export const michelsonGlass = [
  {
    id: 'thin-glass-ri', title: 'Refractive index of a thin glass sheet', short: 'Fringe shift',
    aim: 'Determine the refractive index of a thin glass sheet from the fringe shift it causes.',
    formula: '2 (μ − 1) t = N λ',
    principle: 'A sheet placed in one arm increases that optical path by 2(μ − 1)t. The fringe system shifts by N, which is counted while restoring the original field.',
    steps: ['Observe the fringes with no sheet.', 'Insert the sheet in the arm.', 'Count the fringes passing the centre.', 'Plot N against t and calculate μ.'],
    controls: [num('t', 'Sheet thickness t', 5, 40, 1, 15, 'µm'), tog('ins', 'Sheet inserted', true)],
    out: (v) => { const N = (2 * 0.515 * v.t * 1000) / 589.3; return { N, path: v.ins ? N : 0 } },
    Stage: StageGlass,
    read: (v, o) => [['Fringe shift', v.ins ? o.N.toFixed(1) : '0', ''], ['Thickness', v.t, 'µm']],
    columns: [['t', 't (µm)', 0], ['N', 'N', 1]],
    sample: (v, o) => (v.ins ? { t: v.t, N: Math.round(o.N * 2) / 2 } : { error: 'Insert the sheet first.' }),
    sweep: { k: 't', n: 8 },
    graph: { x: 't', y: 'N', xl: 'Thickness (µm)', yl: 'Fringe shift N', fit: true },
    analyse: (r) => { const f = fit(r, 't', 'N'); return f && [['Refractive index μ', 1 + (f.m * 589.3) / 2000, '', 1.515]] },
  },
  michelsonNa[0],
]
