import { useRef, useState } from 'react'
import { Svg, Seven } from '../lib/parts'
import { num, sel, TAU, cadd, cmul, cdiv, cabs, clamp, wobble, steps } from '../lib/math'

/* A working replica of the Series and Parallel LCR Resonance Kit front panel.
   Components are patched with cords; every wiring is solved as a real AC network. */

const VB = '0 0 1000 800'
const RG = 600, RC = 15 // generator output resistance, inductor winding resistance

const BANK = [
  { id: 'c1', x: 99, t: 'C', val: 0.01e-6, label: '0.01 µF' },
  { id: 'c2', x: 179, t: 'C', val: 0.1e-6, label: '0.1 µF' },
  { id: 'r1', x: 260, t: 'R', val: 750, label: '750 Ω' },
  { id: 'r2', x: 336, t: 'R', val: 1000, label: '1 kΩ' },
  { id: 'l1', x: 404, t: 'L', val: 0.1, label: '100 mH' },
  { id: 'l2', x: 487, t: 'L', val: 0.2, label: '200 mH' },
]
const POS = {
  S1: [797, 284], S2: [797, 376], S3: [797, 421], S4: [797, 512], S5: [797, 569], S6: [797, 662], P1: [896, 284], P2: [896, 662],
}
BANK.forEach((b) => { POS[`${b.id}a`] = [b.x, 556]; POS[`${b.id}b`] = [b.x, 652] })
const SOCKETS = Object.keys(POS)
const INTERNAL = [['S1', 'P1'], ['S6', 'P2'], ['S2', 'S3'], ['S4', 'S5']]
const CORD_COL = ['#D92D20', '#1570EF', '#F5B301', '#12B76A', '#EE46BC', '#F2F4F7']

const SERIES = [['S1', 'l1a'], ['l1b', 'S2'], ['S3', 'c1a'], ['c1b', 'S4'], ['S5', 'r1a'], ['r1b', 'S6']]
const PARALLEL = [['S1', 'l1a'], ['l1b', 'S2'], ['S3', 'S4'], ['S5', 'r1a'], ['r1b', 'S6'], ['P1', 'c1a'], ['c1b', 'P2']]

/* ---- circuit solver ---- */
function nets(cords) {
  const par = Object.fromEntries(SOCKETS.map((s) => [s, s]))
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a] } return a }
  ;[...INTERNAL, ...cords].forEach(([a, b]) => { par[find(a)] = find(b) })
  return find
}
function analyse(cords) {
  const find = nets(cords)
  const top = find('S1'), bot = find('S6')
  const used = (s) => cords.some((c) => c.includes(s)) || SOCKETS.some((o) => o !== s && find(o) === find(s) && !o.startsWith('c') && !o.startsWith('r') && !o.startsWith('l'))
  const comps = BANK.filter((b) => used(`${b.id}a`) && used(`${b.id}b`) && find(`${b.id}a`) !== find(`${b.id}b`)).map((b) => ({ ...b, a: find(`${b.id}a`), b: find(`${b.id}b`) }))
  const nodes = [...new Set([top, bot, ...comps.flatMap((c) => [c.a, c.b])])]
  const parC = comps.find((c) => c.t === 'C' && ((c.a === top && c.b === bot) || (c.a === bot && c.b === top)))
  return { find, top, bot, comps, nodes, short: top === bot, parallel: !!parC, parC }
}
const admit = (c, w) => (c.t === 'R' ? [1 / c.val, 0] : c.t === 'C' ? [0, w * c.val] : cdiv([1, 0], [RC, w * c.val]))
function solve(A, f, amp) {
  if (A.short) return null
  const w = TAU * f
  const idx = new Map(A.nodes.filter((n) => n !== A.bot).map((n, i) => [n, i]))
  const n = idx.size
  if (n === 0) return null
  const Y = Array.from({ length: n }, () => Array.from({ length: n + 1 }, () => [0, 0]))
  const add = (i, j, y) => { Y[i][j] = cadd(Y[i][j], y) }
  for (let i = 0; i < n; i++) add(i, i, [1e-9, 0])
  const stamp = (a, b, y) => {
    const i = idx.get(a), j = idx.get(b)
    if (i !== undefined) add(i, i, y)
    if (j !== undefined) add(j, j, y)
    if (i !== undefined && j !== undefined) { add(i, j, [-y[0], -y[1]]); add(j, i, [-y[0], -y[1]]) }
  }
  stamp(A.top, A.bot, [1 / RG, 0])
  A.comps.forEach((c) => stamp(c.a, c.b, admit(c, w)))
  const it = idx.get(A.top)
  Y[it][n] = [amp / RG, 0]
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (cabs(Y[r][c]) > cabs(Y[p][c])) p = r
    ;[Y[c], Y[p]] = [Y[p], Y[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const m = cdiv(Y[r][c], Y[c][c])
      for (let k = c; k <= n; k++) { const q = cmul(m, Y[c][k]); Y[r][k] = [Y[r][k][0] - q[0], Y[r][k][1] - q[1]] }
    }
  }
  const V = new Map([[A.bot, [0, 0]]])
  idx.forEach((i, node) => V.set(node, cdiv(Y[i][n], Y[i][i])))
  return (node) => V.get(node) ?? [0, 0]
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]

/* The meter reads across R in series use. With C patched in parallel it reads the line
   current as the drop across the generator's output resistance, which dips at resonance. */
function meterPhasor(A, f, amp) {
  const V = solve(A, f, amp)
  if (!V || A.short) return [0, 0]
  if (A.parallel) return sub([amp, 0], V(A.top))
  const R = A.comps.find((c) => c.t === 'R')
  return R ? sub(V(R.a), V(R.b)) : [0, 0]
}
const HARM = { sine: [[1, 1]], square: [1, 3, 5, 7, 9, 11].map((n) => [n, 4 / (Math.PI * n)]), triangle: [1, 3, 5, 7].map((n) => [n, 8 / (Math.PI * Math.PI * n * n)]) }
function isClosed(A) {
  if (A.short || !A.comps.length) return false
  const V = solve(A, 5000, 1)
  if (!V) return false
  return A.parallel || A.comps.every((c) => cabs(cmul(sub(V(c.a), V(c.b)), admit(c, TAU * 5000))) > 1e-6) && A.comps.some((c) => c.t === 'R')
}

const cache = new Map()
function wiring(cords) {
  const key = JSON.stringify(cords)
  if (cache.has(key)) return cache.get(key)
  const A = analyse(cords)
  const closed = isClosed(A)
  let peak = null
  if (closed) {
    const sgn = A.parallel ? -1 : 1
    const scan = (a, b, n) => { let best = [a, -Infinity]; for (let i = 0; i <= n; i++) { const f = a * Math.pow(b / a, i / n), m = sgn * cabs(meterPhasor(A, f, 1)); if (m > best[1]) best = [f, m] } return best }
    let [f, m] = scan(10, 1e6, 500)
    ;[f, m] = scan(f / 1.05, f * 1.05, 240)
    const lvl = m / Math.SQRT2
    const edge = (dir) => { let x = f; for (let i = 0; i < 4000; i++) { const nx = x * Math.pow(1.002, dir); if (nx < 10 || nx > 1e6) return null; if (cabs(meterPhasor(A, nx, 1)) < lvl) return nx; x = nx } return null }
    const lo = A.parallel ? null : edge(-1), hi = A.parallel ? null : edge(1)
    peak = { f, m, lo, hi, bw: lo && hi ? hi - lo : null, dip: A.parallel }
  }
  const L = A.comps.find((c) => c.t === 'L'), C = A.parC || A.comps.find((c) => c.t === 'C'), R = A.comps.find((c) => c.t === 'R')
  const info = { A, closed, peak, L, C, R, f0: L && C ? 1 / (TAU * Math.sqrt(L.val * C.val)) : null }
  if (cache.size > 300) cache.clear()
  cache.set(key, info)
  return info
}

function compute(v, t = 0) {
  const W = wiring(v.cords), A = W.A, f = v.f * 1000, amp = v.Vpp / 2
  let rms2 = 0
  HARM[v.wave].forEach(([n, a]) => { const p = meterPhasor(A, f * n, amp * a); rms2 += cabs(p) ** 2 / 2 })
  const V = W.closed ? Math.sqrt(rms2) : 0
  const sol = W.closed ? solve(A, f, amp) : null
  const w = TAU * f, th = t * TAU * 0.55
  const elem = (c) => (sol ? cmul(sub(sol(c.a), sol(c.b)), admit(c, w)) : [0, 0])
  const scale = amp / RG || 1
  const cur = {}
  A.comps.forEach((c) => { const I = elem(c); cur[c.id] = { mag: Math.min(1.4, cabs(I) / scale), arg: Math.atan2(I[1], I[0]), raw: I } })
  const src = sol ? sub([amp, 0], sol(A.top)) : [0, 0]
  const srcI = { mag: Math.min(1.4, cabs(src) / RG / scale), arg: Math.atan2(src[1], src[0]) }
  const seriesEl = A.comps.find((c) => c !== A.parC)
  const ser = seriesEl ? cur[seriesEl.id] : { mag: 0, arg: 0 }
  const par = A.parC ? cur[A.parC.id] : { mag: 0, arg: 0 }
  /* normalised values for the particle view, with true relative phase */
  const pr = (id, c) => (c ? Math.sin(th + cur[c.id].arg) * Math.min(1, cur[c.id].mag * 1.6) : 0) + (id ? 0 : 0)
  let q = 0, uC = 0, uL = 0
  if (W.C && sol) {
    const vc = sub(sol(W.C.a), sol(W.C.b)), vm = Math.max(0.001, amp * 1.6)
    q = clamp(Math.min(1, cabs(vc) / vm) * Math.sin(th + Math.atan2(vc[1], vc[0])), -1, 1)
    const Ipk = W.L ? cabs(elem(W.L)) : 0
    const eC = 0.5 * W.C.val * (cabs(vc) * Math.sin(th + Math.atan2(vc[1], vc[0]))) ** 2
    const iL = W.L ? Ipk * Math.sin(th + cur[W.L.id].arg) : 0
    const eL = W.L ? 0.5 * W.L.val * iL * iL : 0
    const emax = Math.max(0.5 * W.C.val * cabs(vc) ** 2, W.L ? 0.5 * W.L.val * Ipk * Ipk : 0, 1e-15)
    uC = eC / emax; uL = eL / emax
  }
  return { ...W, V, cur, srcI, ser, par, th, iR: pr('r', W.R), iL: pr('l', W.L), q, uC, uL, fHz: f }
}

/* ---- panel drawing ---- */
const SANS = { fontFamily: 'Figtree, Arial, sans-serif' }
const Silk = ({ x, y, s = 16, a = 'middle', w = 700, children }) => <text x={x} y={y} fontSize={s} textAnchor={a} fontWeight={w} fill="#F1F2F4" style={SANS}>{children}</text>
const wire = { fill: 'none', stroke: '#E9EBEF', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }
const SymR = ({ x, y }) => <path {...wire} d={`M${x},${y - 24} l-9,4 18,8 -18,8 18,8 -18,8 9,4`} />
const SymC = ({ x, y }) => <path {...wire} d={`M${x - 16},${y - 5} h32 M${x - 16},${y + 5} h32`} />
const SymL = ({ x, y }) => <path {...wire} d={`M${x},${y - 26} a8,6.5 0 0 1 0,13 a8,6.5 0 0 1 0,13 a8,6.5 0 0 1 0,13 a8,6.5 0 0 1 0,13`} />
const SYM = { R: SymR, C: SymC, L: SymL }

function Socket({ id, hot, onDown, onEnter, onLeave }) {
  const [x, y] = POS[id]
  return (
    <g className="socket" onPointerDown={(e) => onDown(e, id)} onPointerEnter={() => onEnter(id)} onPointerLeave={onLeave} style={{ cursor: 'crosshair', touchAction: 'none' }}>
      <circle cx={x} cy={y} r={20} fill="transparent" />
      {hot && <circle cx={x} cy={y} r={18} fill="#4FC3FF" opacity=".35" />}
      <circle cx={x} cy={y} r={12.5} fill="url(#g-brass)" stroke="#6E5620" />
      <circle cx={x} cy={y} r={6} fill="#1A1408" stroke="#8A6F2C" />
    </g>
  )
}

const cordPath = ([x1, y1], [x2, y2]) => {
  const d = Math.hypot(x2 - x1, y2 - y1), sag = 24 + d * 0.17
  return `M${x1},${y1} C${x1},${y1 + sag} ${x2},${y2 + sag} ${x2},${y2}`
}

function Knob({ x, y, val, onChange, label }) {
  const drag = useRef(null)
  const a = -135 + 270 * val
  return (
    <g style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, val } }}
      onPointerMove={(e) => { if (!drag.current) return; onChange(clamp(drag.current.val + ((e.clientX - drag.current.px) - (e.clientY - drag.current.py)) / 240, 0, 1)) }}
      onPointerUp={() => { drag.current = null }}>
      <circle cx={x} cy={y} r={40} fill="transparent" />
      <polygon points={Array.from({ length: 6 }, (_, i) => `${x + 30 * Math.cos((i * Math.PI) / 3)},${y + 30 * Math.sin((i * Math.PI) / 3)}`).join(' ')} fill="url(#g-silver)" stroke="#7A8290" />
      <circle cx={x} cy={y} r={19} fill="url(#g-silver)" stroke="#5F6773" />
      <g transform={`rotate(${a} ${x} ${y})`}><rect x={x - 2.5} y={y - 19} width="5" height="15" rx="2" fill="#2A2E36" /></g>
      <text x={x} y={y + 58} textAnchor="middle" fontSize="15" fontWeight="700" fill="#F1F2F4" style={SANS}>{label[0]}</text>
      <text x={x} y={y + 76} textAnchor="middle" fontSize="13" fontWeight="600" fill="#D5D9E0" style={SANS}>{label[1]}</text>
    </g>
  )
}

const PushBtn = ({ x, y, onClick, label }) => (
  <g className="pushbtn" onClick={onClick} style={{ cursor: 'pointer' }} role="button" aria-label={label}>
    <rect x={x - 24} y={y - 24} width="48" height="48" rx="6" fill="#0A0B0E" stroke="#2F333B" />
    <rect className="cap" x={x - 16} y={y - 16} width="32" height="32" rx="4" fill="url(#g-silver)" stroke="#6C7380" />
  </g>
)

function fmtFreq(f) { return f >= 1000 ? `${(f / 1000).toFixed(f >= 1e5 ? 1 : 3)} kHz` : `${f.toFixed(1)} Hz` }
const WAVES = ['sine', 'square', 'triangle']

function Panel7({ V }) {
  const s = Math.min(9.999, V).toFixed(3).replace('.', '')
  return (
    <g>
      <rect x="702" y="112" width="164" height="72" rx="3" fill="#1A0606" stroke="#3B3F47" />
      {s.split('').map((ch, i) => <Seven key={i} x={720 + i * 36} y={126} ch={ch} s={22} c="#FF3B30" />)}
      <circle cx={748} cy={172} r={3.4} fill="#FF3B30" />
      <text x={898} y={160} fontSize="22" fontWeight="700" fill="#F1F2F4" style={SANS} textAnchor="middle">V</text>
    </g>
  )
}

function Stage({ v, o, t, set }) {
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [hover, setHover] = useState(null)
  const pt = (e) => {
    const m = svgRef.current.getScreenCTM().inverse()
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
    return [q.x, q.y]
  }
  const down = (e, id) => {
    e.stopPropagation()
    svgRef.current.setPointerCapture?.(e.pointerId)
    setDrag({ from: id, to: pt(e) })
  }
  const move = (e) => {
    if (!drag) return
    const p = pt(e)
    const near = SOCKETS.find((s) => s !== drag.from && Math.hypot(POS[s][0] - p[0], POS[s][1] - p[1]) < 26)
    setHover(near || null)
    setDrag((d) => (d ? { ...d, to: p } : d))
  }
  const up = (e) => {
    if (!drag) return
    const p = pt(e)
    const h = SOCKETS.find((s) => s !== drag.from && Math.hypot(POS[s][0] - p[0], POS[s][1] - p[1]) < 26)
    if (h && h !== drag.from && !v.cords.some((c) => c.includes(h) && c.includes(drag.from))) set('cords', [...v.cords, [drag.from, h]])
    setDrag(null); setHover(null)
  }
  const flow = (m, arg) => m * 34 * Math.sin(o.th + arg)
  const El = ({ d, mag, arg }) => mag > 0.004 && (
    <path d={d} fill="none" stroke="#5CC8FF" strokeWidth="5" strokeLinecap="round" strokeDasharray="0 17" strokeDashoffset={flow(mag, arg)} />
  )
  const logf = Math.log(clamp(v.f, 0.01, 1000) / 0.01) / Math.log(1e5)
  const lcd2 = !o.A.comps.length ? 'NO CIRCUIT' : o.A.short ? 'SHORT CIRCUIT' : !o.closed ? 'OPEN CIRCUIT' : `${v.wave.toUpperCase()} ${v.Vpp.toFixed(1)}Vpp`
  const cordCur = (c) => {
    const owner = o.A.comps.find((k) => c.some((s) => s.startsWith(k.id)))
    return owner ? o.cur[owner.id] : o.ser
  }
  void t
  return (
    <Svg vb={VB} svgRef={svgRef} onPointerMove={move} onPointerUp={up}>
      <rect width="1000" height="800" fill="#E9E9E6" />
      <rect x="18" y="14" width="964" height="772" rx="6" fill="url(#g-blackpanel)" stroke="#000" />
      <rect x="18" y="14" width="964" height="772" rx="6" fill="url(#g-sheen)" />
      <Silk x={505} y={58} s={23}>SERIES AND PARALLEL LCR RESONANCE KIT</Silk>

      {/* LCD */}
      <rect x="140" y="112" width="240" height="76" rx="3" fill="#0B0D10" stroke="#3B3F47" />
      <rect x="150" y="122" width="220" height="56" rx="2" fill="#A9CF3A" />
      <text x="160" y="146" fontSize="20" fontWeight="600" fontFamily="ui-monospace, Consolas, monospace" fill="#22300A">F:{fmtFreq(o.fHz)}</text>
      <text x="160" y="170" fontSize="20" fontWeight="600" fontFamily="ui-monospace, Consolas, monospace" fill="#22300A">{lcd2}</text>
      <Panel7 V={o.V} />

      {/* frequency step buttons and waveform */}
      <PushBtn x={163} y={268} label="Frequency up" onClick={() => { const step = Math.pow(10, Math.floor(Math.log10(v.f)) - 2); set('f', +clamp(v.f + step, 0.01, 1000).toPrecision(5)) }} />
      <PushBtn x={262} y={268} label="Frequency down" onClick={() => { const step = Math.pow(10, Math.floor(Math.log10(v.f * 0.9999)) - 2); set('f', +clamp(v.f - step, 0.01, 1000).toPrecision(5)) }} />
      <PushBtn x={361} y={268} label="Next waveform" onClick={() => set('wave', WAVES[(WAVES.indexOf(v.wave) + 1) % 3])} />
      <path d="M163,316 l11,14 h-7 v13 h-8 v-13 h-7 z" fill="#F1F2F4" />
      <path d="M262,343 l11,-14 h-7 v-13 h-8 v13 h-7 z" fill="#F1F2F4" />
      <Silk x={361} y={335} s={15}>WAVEFORM</Silk>
      <Knob x={208} y={420} val={logf} label={['FREQUENCY', '(up to 1 MHz)']} onChange={(u) => set('f', +(0.01 * Math.pow(1e5, u)).toPrecision(4))} />
      <Knob x={330} y={420} val={v.Vpp / 10} label={['AMPLITUDE', '(10 V p-p)']} onChange={(u) => set('Vpp', +(u * 10).toFixed(1))} />

      {/* component bank */}
      {BANK.map((b) => { const S = SYM[b.t]; return (
        <g key={b.id}>
          <path {...wire} d={b.t === 'C' ? `M${b.x},556 V${604 - 5} M${b.x},${604 + 5} V652` : `M${b.x},556 V${b.t === 'L' ? 578 : 580} M${b.x},${b.t === 'L' ? 630 : 628} V652`} />
          <S x={b.x} y={b.t === 'L' ? 604 : 604} />
          <Silk x={b.x} y={698} s={16}>{b.label}</Silk>
        </g>
      ) })}

      {/* printed circuit */}
      <path {...wire} d="M797,284 H640 V448 M640,498 V662 H797" />
      <circle cx="640" cy="473" r="24" fill="#111318" stroke="#E9EBEF" strokeWidth="2.4" />
      <path {...wire} d="M627,473 c4,-13 9,-13 13,0 s9,13 13,0" />
      <path {...wire} d="M797,284 H896 M797,662 H896" />
      <path {...wire} d="M797,376 V421 M797,512 V569" />
      <path {...wire} d="M797,296 V303 M797,357 V364 M797,433 V461 M797,471 V500 M797,581 V590 M797,644 V650" />
      <SymL x={797} y={330} /><SymC x={797} y={466} /><SymR x={797} y={616} />
      <path {...wire} d="M896,296 V468 M896,478 V650" /><SymC x={896} y={473} />
      <Silk x={838} y={336} s={18}>L</Silk><Silk x={838} y={472} s={18}>C</Silk><Silk x={838} y={622} s={18}>R</Silk><Silk x={934} y={479} s={18}>C</Silk>

      {/* electrons moving in the printed traces, displaced by the instantaneous current */}
      <El d="M797,284 H640 V448" mag={o.srcI.mag} arg={o.srcI.arg} />
      <El d="M640,498 V662 H797" mag={o.srcI.mag} arg={o.srcI.arg} />
      <El d="M797,376 V421" mag={o.ser.mag} arg={o.ser.arg} />
      <El d="M797,512 V569" mag={o.ser.mag} arg={o.ser.arg} />
      <El d="M797,284 H896" mag={o.par.mag} arg={o.par.arg} />
      <El d="M797,662 H896" mag={o.par.mag} arg={o.par.arg} />

      {SOCKETS.map((s) => <Socket key={s} id={s} hot={hover === s || (drag && drag.from === s)} onDown={down} onEnter={(id) => { if (!drag) setHover(id) }} onLeave={() => { if (!drag) setHover(null) }} />)}

      {/* patch cords */}
      {v.cords.map((c, i) => {
        const a = POS[c[0]], b = POS[c[1]], d = cordPath(a, b), col = CORD_COL[i % CORD_COL.length], f = cordCur(c)
        return (
          <g key={`${c[0]}${c[1]}`} className="cord" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); set('cords', v.cords.filter((x) => x !== c)) }}>
            <path d={d} fill="none" stroke="transparent" strokeWidth="18" />
            <path d={d} fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="8" transform="translate(2,4)" />
            <path d={d} fill="none" stroke={col} strokeWidth="6.5" strokeLinecap="round" />
            <path d={d} fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.6" />
            {f && f.mag > 0.004 && <path d={d} fill="none" stroke="#0B2A52" strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0 16" strokeDashoffset={flow(f.mag, f.arg)} />}
            {[a, b].map((p, k) => <g key={k}><circle cx={p[0]} cy={p[1]} r={10.5} fill={col} stroke="#000" strokeOpacity=".4" /><circle cx={p[0]} cy={p[1]} r={4} fill="#fff" fillOpacity=".55" /></g>)}
          </g>
        )
      })}
      {drag && <path d={cordPath(POS[drag.from], drag.to)} fill="none" stroke="#4FC3FF" strokeWidth="6.5" strokeLinecap="round" pointerEvents="none" />}
    </Svg>
  )
}

/* ---- experiments ---- */
const act = (k, label, cords) => ({ k, type: 'action', label, run: (set) => set('cords', cords) })
const ctrls = [
  num('f', 'Frequency', 0.01, 1000, 0.01, 4.5, 'kHz', { log: true }),
  num('Vpp', 'Amplitude', 0, 10, 0.1, 10, 'V p-p'),
  sel('wave', 'Waveform', [['sine', 'Sine'], ['square', 'Square'], ['triangle', 'Triangle']], 'sine'),
  act('aS', 'Wire series circuit', SERIES), act('aP', 'Wire parallel circuit', PARALLEL), act('aC', 'Remove all cords', []),
]
const range = (w) => {
  if (!w.peak) return null
  if (w.peak.dip) return [(w.peak.f * 0.55) / 1000, (w.peak.f * 1.55) / 1000]
  const bw = w.peak.bw ?? w.peak.f / 2, a = Math.max(10, w.peak.f - bw * 2.2), b = w.peak.f + bw * 2.2
  return [a / 1000, b / 1000]
}
const bwFrom = (r) => {
  const s = [...r].sort((a, b) => a.f - b.f), top = s.reduce((a, b) => (b.V > a.V ? b : a)), lvl = top.V / Math.SQRT2, i = s.indexOf(top)
  let lo = null, hi = null
  for (let j = i; j > 0; j--) if (s[j - 1].V < lvl) { lo = s[j - 1].f + ((lvl - s[j - 1].V) / (s[j].V - s[j - 1].V)) * (s[j].f - s[j - 1].f); break }
  for (let j = i; j < s.length - 1; j++) if (s[j + 1].V < lvl) { hi = s[j].f + ((s[j].V - lvl) / (s[j].V - s[j + 1].V)) * (s[j + 1].f - s[j].f); break }
  return { top: { ...top, f: vertex(s, i) }, bw: lo !== null && hi !== null ? hi - lo : null }
}
/** Extremum position from a parabola through the nearest readings, so scatter does not matter. */
function vertex(s, i, sign = 1) {
  const p = s.slice(Math.max(0, i - 3), i + 4), n = p.length
  if (n < 5) return s[i].f
  const x0 = s[i].f, X = p.map((r) => r.f - x0), Y = p.map((r) => sign * r.V)
  const S = (k) => X.reduce((a, x) => a + x ** k, 0), T = (k) => X.reduce((a, x, j) => a + Y[j] * x ** k, 0)
  const M = [[S(4), S(3), S(2), T(2)], [S(3), S(2), S(1), T(1)], [S(2), S(1), n, T(0)]]
  for (let c = 0; c < 3; c++) {
    let b = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[b][c])) b = r
    ;[M[c], M[b]] = [M[b], M[c]]
    for (let r = 0; r < 3; r++) if (r !== c) { const m = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= m * M[c][k] }
  }
  const A = M[0][3] / M[0][0], B = M[1][3] / M[1][1]
  return A < 0 ? x0 - B / (2 * A) : s[i].f
}
const sine = (v) => ({ ...v, wave: 'sine' })
const base = (cords) => ({
  state: () => ({ cords }),
  controls: ctrls,
  out: compute,
  Stage,
  read: (v, o) => [
    ['Meter', o.V.toFixed(3), 'V'],
    ['Reading', o.A.parallel ? 'Line current' : 'Across R', ''],
    ['Calculated f₀', o.f0 ? (o.f0 / 1000).toFixed(3) : '—', 'kHz'],
  ],
  tip: 'Drag from one brass socket to another to patch a cord. Click a cord to remove it. Drag the knobs, or press the buttons on the panel.',
  columns: [['f', 'f (kHz)', 3], ['V', 'V (V)', 3]],
  sample: (v, o) => (o.closed ? { f: v.f, V: wobble(o.V, 0.002) } : { error: 'The circuit is not complete. Check the patch cords.' }),
  sweep: { list: (v) => { const r = range(wiring(v.cords)); return r ? steps(r[0], r[1], 45).map((f) => ({ f: +f.toPrecision(5), wave: 'sine' })) : [] } },
  need: 12,
  graph: {
    x: 'f', y: 'V', xl: 'Frequency (kHz)', yl: 'Meter (V rms)', zero: false,
    curve: (v) => { const r = range(wiring(v.cords)); return r ? steps(r[0], r[1], 200).map((f) => [f, compute({ ...sine(v), f }).V]) : [] },
    live: (v) => { const r = range(wiring(v.cords)); return r && v.f >= r[0] && v.f <= r[1] ? [v.f, compute(v).V] : null },
  },
  micro: (v, o) => ({ scene: 'rlc', title: 'Inside the components', note: 'Electrons jostle through the resistor, charge piles onto the capacitor plates, and magnetic field builds around the inductor. Slowed down so you can watch one AC cycle.', iR: o.iR, iL: o.iL, q: o.q, uC: o.uC, uL: o.uL }),
})
const expected = (v) => wiring(v.cords).peak
export const lcrPanelKit = [
  {
    ...base(SERIES), id: 'series-resonance', title: 'Series RLC resonance', short: 'Patch L, C and R in series',
    aim: 'Patch a series LCR circuit on the kit and determine its resonant frequency.',
    formula: 'f₀ = 1 / (2π √(L C))',
    principle: 'At f₀ the reactances of L and C cancel, the impedance is smallest, and the voltage across R peaks. Energy swings between the capacitor and the inductor.',
    steps: ['Patch an inductor, a capacitor and a resistor from the bank across L, C and R.', 'Set the amplitude to 10 V p-p with a sine wave.', 'Sweep the frequency with the knob or the arrow buttons.', 'Note the frequency at which the meter peaks.'],
    analyse: (r, v) => { const p = expected(v); return p ? [['Resonant frequency', bwFrom(r).top.f, 'kHz', p.f / 1000]] : [['Status', 'Complete the circuit', '']] },
  },
  {
    ...base(PARALLEL), id: 'parallel-resonance', title: 'Parallel RLC resonance', short: 'Line current dips at resonance',
    aim: 'Patch the parallel tank circuit on the kit and determine its resonant frequency.',
    formula: 'f₀ = (1/2π) √(1/(L C) − R²/L²)',
    principle: 'With C across the L–R branch, current circulates inside the tank at resonance and very little is drawn from the generator. The meter, reading the line current, falls to a minimum.',
    steps: ['Patch L and R in their positions and link across the series C position.', 'Patch a capacitor across the parallel C sockets.', 'Sweep the frequency.', 'Note the frequency at which the meter reading is smallest.'],
    analyse: (r, v) => {
      const p = expected(v); if (!p) return [['Status', 'Complete the circuit', '']]
      const s = [...r].sort((a, b) => a.f - b.f), min = s.reduce((a, b) => (b.V < a.V ? b : a))
      return [['Resonant frequency', vertex(s, s.indexOf(min), -1), 'kHz', p.f / 1000]]
    },
  },
  {
    ...base(SERIES), id: 'q-factor', title: 'Resonant frequency, bandwidth and Q', short: 'Half-power points',
    aim: 'Determine the resonant frequency, bandwidth and quality factor of the series LCR circuit.',
    formula: 'BW = f₂ − f₁     Q = f₀ / BW',
    principle: 'The bandwidth is the range between the frequencies where the response falls to 1/√2 of its peak. Higher total resistance makes the peak wider. The generator’s 600 Ω output adds to the circuit resistance.',
    steps: ['Patch the series circuit.', 'Collect the resonance curve.', 'Find f₁ and f₂ at the 0.707 level.', 'Calculate BW and Q. Try the other resistor and compare.'],
    analyse: (r, v) => {
      const p = expected(v); if (!p) return [['Status', 'Complete the circuit', '']]
      const b = bwFrom(r), fk = p.f / 1000, bwk = p.bw ? p.bw / 1000 : null
      return [['f₀', b.top.f, 'kHz', fk], ['Bandwidth', b.bw ?? '—', 'kHz', bwk ?? undefined], ['Q factor', b.bw ? b.top.f / b.bw : '—', '', bwk ? fk / bwk : undefined]]
    },
  },
]
