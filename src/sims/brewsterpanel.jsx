import { useRef } from 'react'
import { Svg, Ray, Seven } from '../lib/parts'
import { tog } from '../lib/math'
import { brewster } from './optics'

/* The Brewster's law kit drawn as on the bench: diode laser and polarizer on an optical bench,
   glass plate on a goniometer, and a silicon detector on a rotating arm. The table is a
   horizontal circle seen at an angle, so plane points map through K. */

const VB = '40 130 1720 880'
const SANS = { fontFamily: 'Figtree, Arial, sans-serif' }
const CX = 1000, CY = 540, K = 0.5, TY = 445 // goniometer centre and table height on screen
const LASER_DIR = 150, STRAIGHT = -30, ARM_R = 385
const NOSE = [385, 585], POL = [547, 540], HIT = [1000, 410], SCOPE = [1215, 350]
const WHEEL_TILT = 10, WHEEL_SQ = 0.46

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const wrap = (d) => ((d + 540) % 360) - 180
const onPlane = (r, a, y0 = CY) => [CX + r * Math.cos(rad(a)), y0 + K * r * Math.sin(rad(a))]
const pts = (list) => list.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const Txt = ({ x, y, s = 12, a = 'middle', w = 500, c = '#EDEFF3', children, ...p }) => <text x={x} y={y} fontSize={s} textAnchor={a} fontWeight={w} fill={c} style={SANS} {...p}>{children}</text>

const refAngle = (th) => LASER_DIR - 2 * th
function geometry(v, malus) {
  const R = malus ? STRAIGHT : refAngle(v.th)
  const arm = malus ? STRAIGHT : v.link ? R : v.arm
  const miss = arm - R
  return { R, arm, miss, align: malus ? 1 : Math.exp(-((miss / 1.3) ** 2)) }
}

/* ---- parts that never change ---- */
const MAIN_SCALE = (() => {
  const items = []
  for (let L = 0; L < 360; L += 5) {
    const a = L - 30, big = L % 30 === 0, mid = L % 10 === 0
    const p = onPlane(153, a), q = onPlane(big ? 134 : mid ? 141 : 146, a)
    items.push(<line key={L} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#2A1F08" strokeWidth={big ? 1.6 : 0.8} />)
    if (big) { const t = onPlane(160, a); items.push(<Txt key={`t${L}`} x={t[0]} y={t[1] + 4} s={10.5} c="#1C1405" w={600}>{L}</Txt>) }
  }
  return items
})()

const BENCH_TICKS = (() => {
  const a = [300, 803], b = [705, 690], items = []
  for (let i = 0; i <= 54; i++) {
    const u = i / 54, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, big = i % 10 === 0
    items.push(<line key={i} x1={x} y1={y} x2={x - 3} y2={y - (big ? 18 : 10)} stroke="#2A2D33" strokeWidth={big ? 1.5 : 0.9} />)
    if (big && i) items.push(<Txt key={`t${i}`} x={x + 8} y={y + 16} s={11} c="#1D2026">{i / 2}</Txt>)
  }
  return items
})()

const WHEEL_MARKS = (() => {
  const items = []
  for (let d = -180; d < 180; d += 5) {
    const big = d % 30 === 0, a = rad(d)
    items.push(<line key={d} x1={Math.sin(a) * 92} y1={-Math.cos(a) * 92} x2={Math.sin(a) * (big ? 104 : 99)} y2={-Math.cos(a) * (big ? 104 : 99)} stroke="#E9EBEF" strokeWidth={big ? 2.4 : 1.2} />)
    if (big && Math.abs(d) <= 90) items.push(<text key={`t${d}`} x={Math.sin(a) * 78} y={-Math.cos(a) * 78 + 5} fontSize="16" textAnchor="middle" fill="#E9EBEF" style={SANS}>{Math.abs(d)}</text>)
  }
  return items
})()

const Telescope = () => (
  <g>
    <polygon points="1158,484 1490,392 1500,420 1168,512" fill="#3B4048" stroke="#22252B" />
    <rect x="1293" y="350" width="20" height="104" fill="url(#bw-post)" /><rect x="1430" y="312" width="20" height="104" fill="url(#bw-post)" />
    <g transform="translate(1200,352) rotate(-15.5)">
      <rect x="0" y="-20" width="300" height="46" rx="3" fill="url(#bw-tube)" />
      <rect x="10" y="-27" width="290" height="10" rx="2" fill="#4A4F58" />
      <rect x="-22" y="-26" width="34" height="60" rx="4" fill="url(#g-silver)" />
      <rect x="296" y="-16" width="72" height="34" rx="3" fill="#191B20" /><rect x="360" y="-24" width="30" height="50" rx="4" fill="#26282E" />
    </g>
    <circle cx="1378" cy="274" r="9" fill="#3D4149" />
  </g>
)

const STATIC_BACK = (
  <g>
    <defs>
      <linearGradient id="bw-wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1B1E23" /><stop offset="1" stopColor="#23272D" /></linearGradient>
      <linearGradient id="bw-table" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3C424B" /><stop offset=".55" stopColor="#2B2F36" /><stop offset="1" stopColor="#1C1F24" /></linearGradient>
      <linearGradient id="bw-tube" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3A3D44" /><stop offset=".4" stopColor="#121317" /><stop offset="1" stopColor="#050608" /></linearGradient>
      <linearGradient id="bw-base" x1="0" x2="1"><stop offset="0" stopColor="#8B929D" /><stop offset=".35" stopColor="#E9ECF0" /><stop offset=".62" stopColor="#B8BEC8" /><stop offset="1" stopColor="#7E8590" /></linearGradient>
      <linearGradient id="bw-ring" x1="0" x2="1"><stop offset="0" stopColor="#B98F2F" /><stop offset=".4" stopColor="#EFCD72" /><stop offset="1" stopColor="#B58A2B" /></linearGradient>
      <linearGradient id="bw-bench" x1="0" x2="1"><stop offset="0" stopColor="#AEB4BE" /><stop offset=".45" stopColor="#F0F2F5" /><stop offset="1" stopColor="#98A0AB" /></linearGradient>
      <linearGradient id="bw-post" x1="0" x2="1"><stop offset="0" stopColor="#7E858F" /><stop offset=".4" stopColor="#E4E7EB" /><stop offset="1" stopColor="#6F7680" /></linearGradient>
      <radialGradient id="bw-shadow"><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
    </defs>
    <rect x="40" y="130" width="1720" height="300" fill="url(#bw-wall)" />
    <rect x="40" y="430" width="1720" height="580" fill="url(#bw-table)" />
  </g>
)
const STATIC_BASE = (
  <g>
    <ellipse cx={CX} cy={CY + 120} rx="260" ry="100" fill="url(#bw-shadow)" />
    <path d={`M${CX - 192},${CY} v62 a192,95 0 0 0 384,0 v-62 a192,95 0 0 1 -384,0 z`} fill="url(#bw-base)" />
    <ellipse cx={CX} cy={CY} rx="192" ry="95" fill="#D5D9E0" stroke="#A1A8B3" />
    <ellipse cx={CX} cy={CY} rx="168" ry="84" fill="url(#bw-ring)" stroke="#7A5C1A" />
    {MAIN_SCALE}
    <ellipse cx={CX} cy={CY} rx="132" ry="66" fill="#3D4149" stroke="#2A2D33" />
    <circle cx="850" cy="506" r="10" fill="#2A2C31" /><circle cx="1067" cy="661" r="10" fill="#2A2C31" />
    <rect x={CX - 20} y={TY + 36} width="40" height="52" fill="url(#bw-post)" />
  </g>
)
const STATIC_FRONT = (
  <g>
    <polygon points="258,772 712,640 730,706 275,828" fill="url(#bw-bench)" stroke="#6C7380" />
    <polygon points="258,772 275,828 262,834 240,790" fill="#2B2E35" />
    <polygon points="712,640 730,706 748,700 730,652" fill="#2B2E35" />
    {BENCH_TICKS}
    <polygon points="282,750 332,736 334,770 288,784" fill="#17181C" /><rect x="294" y="636" width="20" height="112" fill="url(#bw-post)" />
    <polygon points="526,680 572,666 576,698 532,712" fill="#17181C" /><rect x="537" y="630" width="18" height="52" fill="url(#bw-post)" />
    <g transform="translate(250,612) rotate(-15)">
      <rect x="0" y="-18" width="122" height="38" rx="3" fill="url(#bw-tube)" />
      <rect x="4" y="-25" width="116" height="9" rx="2" fill="#585D66" />
      <rect x="118" y="-14" width="17" height="30" rx="2" fill="url(#g-silver)" />
      <text x="58" y="-29" fontSize="10" textAnchor="middle" fill="#F2998F" style={SANS}>650 nm</text>
    </g>
    <path d="M254,622 C200,660 210,850 300,905 S820,985 1336,920" fill="none" stroke="#0B0C0F" strokeWidth="5" />
    <path d="M1330,760 l40,-34 h310 l30,34 z" fill="#4A6E96" />
    <rect x="1330" y="760" width="380" height="210" fill="#2F5075" />
    <rect x="1340" y="770" width="360" height="190" fill="#EDF0F4" />
    <Txt x={1520} y={794} s={14} w={700} c="#1D3F66">PHOTO DETECTOR OUTPUT UNIT</Txt>
    <rect x="1370" y="808" width="300" height="78" rx="5" fill="#0C0D10" /><rect x="1378" y="815" width="284" height="64" rx="2" fill="#250606" />
    <Txt x={1520} y={906} s={11.5} c="#3F4B5C">RANGE 0 – 199</Txt>
    <Txt x={1400} y={958} s={10.5} c="#3F4B5C">ZERO</Txt><Txt x={1490} y={958} s={10.5} c="#3F4B5C">GAIN</Txt><Txt x={1590} y={958} s={10.5} c="#3F4B5C">INPUT</Txt><Txt x={1655} y={958} s={10.5} c="#3F4B5C">POWER</Txt>
    <circle cx="1590" cy="932" r="11" fill="url(#g-silver)" stroke="#555" /><circle cx="1590" cy="932" r="4.5" fill="#0A0B0D" />
  </g>
)

const UnitKnob = ({ x, u, onDown }) => {
  const a = -135 + 270 * u
  return (
    <g className="hot" style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={onDown}>
      <circle cx={x} cy={932} r="20" fill="transparent" />
      <circle cx={x} cy={932} r="15" fill="#2A2C31" stroke="#0B0C0F" />
      <g transform={`rotate(${a} ${x} 932)`}><rect x={x - 1.6} y={919} width="3.2" height="10" rx="1.5" fill="#fff" /></g>
    </g>
  )
}

function make(malus, nameOf) {
  return function Stage({ v, o, set }) {
    const svg = useRef(null), drag = useRef(null)
    const point = (e) => { const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current.getScreenCTM().inverse()); return [q.x, q.y] }
    const planeAngle = ([x, y]) => deg(Math.atan2((y - CY) / K, x - CX))
    const wheelAngle = ([x, y]) => {
      const dx = x - POL[0], dy = y - POL[1], t = rad(-WHEEL_TILT)
      return deg(Math.atan2((dx * Math.cos(t) - dy * Math.sin(t)) / WHEEL_SQ, -(dx * Math.sin(t) + dy * Math.cos(t))))
    }
    const begin = (kind) => (e) => {
      e.stopPropagation()
      svg.current.setPointerCapture?.(e.pointerId)
      const p = point(e)
      drag.current = { kind, x: e.clientX, y: e.clientY, a: kind === 'pol' ? wheelAngle(p) : planeAngle(p), th: v.th, phi: v.phi, gain: v.gain, zero: v.zero }
    }
    const onMove = (e) => {
      const d = drag.current
      if (!d) return
      const p = point(e)
      if (d.kind === 'table') set('th', clamp(Math.round((d.th - wrap(planeAngle(p) - d.a)) * 2) / 2, 40, 75))
      if (d.kind === 'arm') { set('link', false); set('arm', clamp(Math.round(planeAngle(p) * 2) / 2, -15, 85)) }
      if (d.kind === 'pol') set('phi', clamp(Math.round(d.phi + wrap(wheelAngle(p) - d.a)), malus ? -90 : 0, 90))
      const move = (e.clientX - d.x) - (e.clientY - d.y)
      if (d.kind === 'gain') set('gain', +clamp(d.gain + move * 0.002, 0.8, 1.2).toFixed(3))
      if (d.kind === 'zero') set('zero', +clamp(d.zero + move * 0.04, -5, 5).toFixed(1))
    }
    const onUp = () => { drag.current = null }

    const g = geometry(v, malus)
    const N = LASER_DIR - (malus ? 56 : v.th)
    const head = [CX + ARM_R * Math.cos(rad(g.arm)), HIT[1] + K * ARM_R * Math.sin(rad(g.arm))]
    const beamEnd = [CX + ARM_R * Math.cos(rad(g.R)), HIT[1] + K * ARM_R * Math.sin(rad(g.R))]
    const armA = onPlane(165, g.arm, CY + 45), armB = [head[0] + 2, head[1] + 134]

    /* glass plate standing on the turntable */
    const t = N + 90, gl = onPlane(58, t, TY), gr = onPlane(58, t + 180, TY), H = 78
    const glass = [gl, gr, [gr[0], gr[1] - H], [gl[0], gl[1] - H]]

    const arm = (
      <g>
        <g className="hot" style={{ cursor: malus ? 'default' : 'grab', touchAction: 'none' }} onPointerDown={malus ? undefined : begin('arm')}>
          <line x1={armA[0]} y1={armA[1]} x2={armB[0]} y2={armB[1]} stroke="#22252B" strokeWidth="28" strokeLinecap="round" />
          <line x1={armA[0]} y1={armA[1] - 9} x2={armB[0]} y2={armB[1] - 9} stroke="#3B3F47" strokeWidth="6" strokeLinecap="round" />
          <rect x={head[0] - 8} y={head[1] + 24} width="20" height="112" fill="url(#bw-post)" />
          <polygon points={pts([[head[0] - 18, head[1] - 22], [head[0] + 36, head[1] - 40], [head[0] + 64, head[1] - 24], [head[0] + 64, head[1] + 28], [head[0] + 36, head[1] + 56], [head[0] - 18, head[1] + 36]])} fill="#203A5F" stroke="#16263F" />
          <polygon points={pts([[head[0] - 18, head[1] - 22], [head[0] + 36, head[1] - 40], [head[0] + 64, head[1] - 24], [head[0] + 8, head[1] - 6]])} fill="#34557F" />
          <text x={head[0] + 22} y={head[1] - 42} fontSize="10.5" textAnchor="middle" fill="#C9D5E8" style={SANS}>Si DETECTOR</text>
          <circle cx={head[0]} cy={head[1]} r="9" fill="#111" stroke="#9AA3AF" strokeWidth="2" />
          <circle cx={head[0]} cy={head[1]} r="30" fill="transparent" />
        </g>
      </g>
    )
    const cable = <path d={`M${head[0] + 54},${head[1] + 26} C${head[0] + 70},${head[1] + 150} 1290,830 1336,935`} fill="none" stroke="#0B0C0F" strokeWidth="5" />
    const reflectedBright = clamp(0.12 + o.raw / 40, 0.12, 1)
    const transmit = malus ? clamp(o.raw / 150 + 0.05, 0.05, 1) : 0.55
    const digits = v.on ? (o.I > 199.9 ? '1' : o.I.toFixed(1).padStart(4, '0')) : ''

    return (
      <div>
      <Svg vb={VB} svgRef={svg} onPointerMove={onMove} onPointerUp={onUp}>
        {STATIC_BACK}
        {!malus && <Telescope />}
        {malus && arm}
        {malus && cable}
        {STATIC_BASE}

        {[0, 90, 180, 270].map((d) => <polygon key={d} points={pts([onPlane(127, N + d - 8), onPlane(127, N + d + 8), onPlane(153, N + d + 6), onPlane(153, N + d - 6)])} fill="#D9B24C" stroke="#7A5C1A" />)}
        <g className="hot" style={{ cursor: malus ? 'default' : 'grab', touchAction: 'none' }} onPointerDown={malus ? undefined : begin('table')}>
          <ellipse cx={CX} cy={TY + 12} rx="74" ry="37" fill="#9AA1AC" />
          <ellipse cx={CX} cy={TY} rx="74" ry="37" fill="#D8DCE2" stroke="#8B929D" />
          {[N + 200, N + 320, N + 80].map((a, i) => { const s = onPlane(60, a, TY); return <g key={i}><rect x={s[0] - 7} y={s[1] - 16} width="14" height="22" rx="2" fill="#33363D" /><ellipse cx={s[0]} cy={s[1] - 16} rx="7" ry="3.5" fill="#55585F" /></g> })}
          {!malus && (
            <g>
              <line x1={gl[0]} y1={gl[1]} x2={gr[0]} y2={gr[1]} stroke="#0D0E10" strokeWidth="7" />
              <polygon points={pts(glass)} fill="rgba(170,220,240,.62)" stroke="#D9F0FA" strokeWidth="1.5" />
              <polygon points={pts([glass[3], glass[2], [glass[2][0], glass[2][1] + 10], [glass[3][0], glass[3][1] + 10]])} fill="rgba(255,255,255,.4)" />
            </g>
          )}
          <circle cx={CX} cy={TY} r="72" fill="transparent" />
          <polygon points={pts(glass)} fill="transparent" />
        </g>

        {!malus && arm}
        {!malus && cable}

        {STATIC_FRONT}

        {/* light */}
        {v.on && <g pointerEvents="none"><Ray x1={NOSE[0]} y1={NOSE[1]} x2={POL[0]} y2={POL[1]} w={4} /></g>}

        {/* polarizer wheel */}
        <g className="hot" style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={begin('pol')} transform={`translate(${POL[0]} ${POL[1]}) rotate(${WHEEL_TILT}) scale(${WHEEL_SQ} 1)`}>
          <circle cx="16" cy="0" r="112" fill="#0D0E10" />
          <circle r="112" fill="#1A1C21" stroke="#3B3F47" strokeWidth="3" />
          {WHEEL_MARKS}
          <circle r="42" fill="rgba(150,40,50,.5)" stroke="#555" strokeWidth="2" />
          <g transform={`rotate(${v.phi})`}>
            <line x1="0" x2="0" y1="-40" y2="40" stroke="#FFB4A8" strokeWidth="3" />
            {[-24, -12, 12, 24].map((x) => <line key={x} x1={x} x2={x} y1="-34" y2="34" stroke="#FFB4A8" strokeWidth="1.2" opacity=".6" />)}
            <polygon points="0,-112 -11,-128 11,-128" fill="#FF3B30" />
          </g>
        </g>
        <circle cx={578} cy={648} r="10" fill="#2A2C31" />

        {v.on && (
          <g pointerEvents="none">
            <Ray x1={POL[0]} y1={POL[1]} x2={HIT[0]} y2={HIT[1]} w={4} o={malus ? transmit : 1} />
            {!malus && <Ray x1={HIT[0]} y1={HIT[1]} x2={SCOPE[0]} y2={SCOPE[1]} w={3} o={transmit} />}
            {malus && <Ray x1={HIT[0]} y1={HIT[1]} x2={head[0]} y2={head[1]} w={4} o={transmit} />}
            {!malus && <Ray x1={HIT[0]} y1={HIT[1]} x2={beamEnd[0]} y2={beamEnd[1]} w={3} o={reflectedBright} />}
            {!malus && <g><circle cx={HIT[0]} cy={HIT[1]} r="11" fill="#FF3B30" opacity=".4" /><circle cx={HIT[0]} cy={HIT[1]} r="4.5" fill="#FFE0DA" /></g>}
            {g.align > 0.6 && <circle cx={head[0]} cy={head[1]} r="7" fill="#FF6B5E" />}
          </g>
        )}

        {/* readings */}
        {!malus && (
          <g>
            <rect x={CX - 138} y={668} width="276" height="28" rx="3" fill="#12141A" stroke="#555" />
            <text x={CX} y={688} fontSize="14" fontWeight="600" textAnchor="middle" fill="#F0E6C8" style={SANS}>{nameOf(v.n)} · i = {v.th.toFixed(1)}°</text>
          </g>
        )}
        {v.on && [...digits].reduce((acc, ch, i, arr) => {
          if (ch === '.') { acc.push(<circle key={i} cx={acc.x - 10} cy={872} r="4.5" fill="#FF3B30" />); return acc }
          acc.push(<Seven key={i} x={acc.x} y={826} ch={ch} s={21} c="#FF3B30" />); acc.x += 44
          void arr
          return acc
        }, Object.assign([], { x: digits === '1' ? 1570 : 1500 - (digits.length - 4) * 44 }))}

        <UnitKnob x={1400} u={(v.zero + 5) / 10} onDown={begin('zero')} />
        <UnitKnob x={1490} u={(v.gain - 0.8) / 0.4} onDown={begin('gain')} />
        <g onClick={() => set('on', !v.on)} style={{ cursor: 'pointer' }} role="switch" aria-checked={v.on} aria-label="Power">
          <rect x="1635" y="918" width="40" height="28" rx="3" fill="#15161A" />
          <rect x={v.on ? 1639 : 1656} y="922" width="16" height="20" rx="1.5" fill={v.on ? '#D92D20' : '#6E1812'} />
        </g>
      </Svg>
      <p className="stage3d-hint">{malus ? 'Drag the polarizer wheel to rotate it. ZERO, GAIN and POWER work on the output unit.' : 'Drag the turntable to rotate the glass and the polarizer wheel to set its angle. Drag the detector arm to align it by hand. ZERO, GAIN and POWER work on the output unit.'}</p>
      </div>
    )
  }
}

const OFF = 'Turn the POWER switch on the output unit on first.'
const build = (uniqueN) => brewster(uniqueN).map((e) => {
  const malus = e.id === 'malus-law'
  const nOpt = e.controls.find((c) => c.k === 'n')
  const nameOf = (n) => (nOpt ? nOpt.options.find((o) => o[0] === n)?.[1] ?? '' : '')
  const controls = e.controls.map((c) => (c.k === 'phi' ? { ...c, step: 1 } : c))
  if (!malus) controls.push(tog('link', 'Detector arm follows the reflected beam', true))
  return {
    ...e,
    wide: true,
    controls,
    state: () => ({ on: true, gain: 1, zero: 0, arm: refAngle(50) }),
    out: (v, t) => {
      const o = e.out(v, t), g = geometry(v, malus)
      const shown = v.on ? Math.max(0, o.I * g.align * v.gain + v.zero) : 0
      return { ...o, raw: o.I, I: shown, align: g.align }
    },
    Stage: make(malus, nameOf),
    sample: (v, o) => {
      if (!v.on) return { error: OFF }
      if (o.align < 0.6) return { error: 'The reflected beam is missing the detector. Drag the detector arm onto the red spot.' }
      if (o.I > 199.9) return { error: 'The output unit is over range. Turn GAIN down.' }
      return e.sample(v, o)
    },
    ...(malus ? {} : { sweep: { list: () => Array.from({ length: 46 }, (_, i) => ({ th: 45 + i * 0.5, link: true })) } }),
    steps: malus
      ? ['The laser, polarizer and detector are aligned straight through.', 'Drag the polarizer wheel to set its angle.', 'Record the detector reading at each angle.', 'Plot I against cos²θ.']
      : ['Drag the polarizer wheel to 0° for p-polarised light.', 'Drag the turntable to change the angle of incidence.', 'Keep the detector on the reflected beam and record the reading.', 'Locate the minimum and calculate n = tan θ_B.'],
    tip: malus ? 'ZERO and GAIN on the output unit shift the readings, as on the real unit.' : 'The arm follows the beam by default. Drag it yourself, or untick the option, to align it by hand. ZERO and GAIN shift the readings, as on the real unit.',
  }
})
export const brewsterPanelKit = build(false)
export const brewsterPanelPG = build(true)
