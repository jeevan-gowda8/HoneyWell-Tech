import { useRef, useState } from 'react'
import { Svg } from '../lib/parts'

/* A working replica of the Full Adder and Full Subtractor Kit front panel. Sockets are
   patched with cords and every wiring is evaluated as real 74-series logic, including
   floating TTL inputs (which read high) and outputs fighting each other. */

const VB = '0 0 1100 820'
const SANS = { fontFamily: 'Figtree, Arial, sans-serif' }
const MONO = 'ui-monospace, Consolas, monospace'
const INK = '#EDEFF3'

/* ---- socket map ---- */
const inX = (i) => 662 + i * 51.8
const outX = (i) => 731 + i * 38.4
const POS = {
  'fa.A': [112, 336], 'fa.B': [112, 375], 'fa.C': [112, 461], 'fa.S': [527, 392], 'fa.Co': [537, 488],
  'fs.A': [572, 361], 'fs.B': [572, 402], 'fs.C': [587, 334], 'fs.D': [1012, 392], 'fs.Bo': [1031, 493],
  'lcd.G': [475, 254], 'lcd.C': [531, 254], 'lcd.L': [571, 254], 'lcd.V': [621, 254],
  pHi: [934, 167], pLo: [998, 167], 'p5a': [840, 167], 'g5a': [882, 167], 'p5b': [840, 230], 'g5b': [882, 230], 'p5c': [840, 262], 'g5c': [882, 262],
}
const KIND = {
  'lcd.G': 'black', 'lcd.C': 'white', 'lcd.L': 'blue', 'lcd.V': 'red',
  pHi: 'red', pLo: 'black', p5a: 'red', g5a: 'black',
}
const CLOCKS = [{ hz: 100000, l: '100KHz', x: 722 }, { hz: 1000, l: '1KHz', x: 750 }, { hz: 100, l: '100Hz', x: 778 }, { hz: 1, l: '1Hz', x: 802 }]
CLOCKS.forEach((c, i) => { POS[`clk${i}`] = [c.x, 262]; POS[`clk${i}p`] = [c.x, 230]; KIND[`clk${i}`] = 'white' })
for (let i = 0; i < 8; i++) { POS[`in${i}`] = [inX(i), 580]; KIND[`in${i}`] = 'blue'; POS[`out${i}`] = [outX(i), 114]; KIND[`out${i}`] = 'yellow' }
;['A', 'B', 'C', 'D'].forEach((b, i) => { const y = 177 - i * 31; POS[`dl.${b}`] = [136, y]; POS[`dr.${b}`] = [350, y] })
const SOCKETS = Object.keys(POS)
const INTERNAL = [
  ...CLOCKS.map((_, i) => [`clk${i}`, `clk${i}p`]),
  ['p5a', 'p5b'], ['p5b', 'p5c'], ['g5a', 'g5b'], ['g5b', 'g5c'], ['lcd.G', 'g5a'],
]
const CORD_COL = ['#D92D20', '#1570EF', '#F5B301', '#12B76A', '#EE46BC', '#F2F4F7']
const ADDER = [['in0', 'fa.A'], ['in1', 'fa.B'], ['in2', 'fa.C'], ['fa.S', 'out0'], ['fa.Co', 'out1']]
const SUBTRACTOR = [['in0', 'fs.A'], ['in1', 'fs.B'], ['in2', 'fs.C'], ['fs.D', 'out0'], ['fs.Bo', 'out1']]

/* ---- logic ---- */
const cache = new Map()
function wiring(cords) {
  const key = JSON.stringify(cords)
  if (cache.has(key)) return cache.get(key)
  const par = Object.fromEntries(SOCKETS.map((s) => [s, s]))
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a] } return a }
  ;[...INTERNAL, ...cords].forEach(([a, b]) => { par[find(a)] = find(b) })
  const net = Object.fromEntries(SOCKETS.map((s) => [s, find(s)]))
  const size = {}
  cords.forEach((c) => c.forEach((s) => { size[net[s]] = (size[net[s]] || 0) + 1 }))
  const w = { net, wired: (s) => !!size[net[s]] }
  if (cache.size > 300) cache.clear()
  cache.set(key, w)
  return w
}

const GATE_OUTS = ['fa.S', 'fa.Co', 'fs.D', 'fs.Bo']
function evaluate({ net }, v, t, phase, force) {
  const fixed = new Map()
  const put = (id, val, volts) => { const r = net[id]; if (!fixed.has(r)) fixed.set(r, []); fixed.get(r).push([val, volts]) }
  for (let i = 0; i < 8; i++) put(`in${i}`, !!v[`s${i}`], v[`s${i}`] ? 5 : 0)
  CLOCKS.forEach((c, i) => {
    let val = c.hz === 1 ? t % 1 < 0.5 : !!phase
    if (force && force.i === i) val = force.val
    put(`clk${i}`, val, val ? 5 : 0)
  })
  put('p5a', true, 5); put('g5a', false, 0)
  put('pHi', !!v.pH, v.pH ? 5 : 0); put('pLo', !v.pL, v.pL ? 0 : 5)
  let gate = {}
  const drivers = (r) => [...(fixed.get(r) || []), ...GATE_OUTS.filter((g) => net[g] === r && gate[g] !== undefined).map((g) => [gate[g], gate[g] ? 3.4 : 0.2])]
  const rd = (id) => { const d = drivers(net[id]); return d.length ? d.every((x) => x[0]) : null }
  const inp = (id) => rd(id) ?? true // a floating TTL input reads high
  let f = {}
  for (let pass = 0; pass < 6; pass++) {
    const A = inp('fa.A'), B = inp('fa.B'), C = inp('fa.C'), X = A !== B
    const a = inp('fs.A'), b = inp('fs.B'), c = inp('fs.C'), x = a !== b
    f = { A, B, C, X, S: X !== C, c1: A && B, c2: X && C, a, b, c, x, D: x !== c, na: !a, nx: !x, b1: !a && b, b2: !x && c }
    f.Co = f.c1 || f.c2; f.Bo = f.b1 || f.b2
    gate = { 'fa.S': f.S, 'fa.Co': f.Co, 'fs.D': f.D, 'fs.Bo': f.Bo }
  }
  const volts = (id) => { const d = drivers(net[id]); return d.length ? Math.min(...d.map((x) => x[1])) : null }
  const fault = [...new Set(Object.values(net))].some((r) => { const d = drivers(r); return d.some((x) => x[0]) && d.some((x) => !x[0]) })
  return { ...f, rd, volts, fault }
}

const SEGS7447 = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'fgcde', 'abc', 'abcdefg', 'abfgc', 'edg', 'cdg', 'bfg', 'afgd', 'fged', '']

function compute(v, t = 0) {
  const w = wiring(v.cords)
  const a = evaluate(w, v, t, 0), b = evaluate(w, v, t, 1)
  const level = (id) => {
    const p = a.rd(id), q = b.rd(id)
    return p === null ? null : p === q ? p : 'pulse'
  }
  const bcd = (side) => ['A', 'B', 'C', 'D'].reduce((n, k, i) => n + ((a.rd(`${side}.${k}`) ?? true) ? 1 << i : 0), 0)
  let clockHz = null
  if (w.wired('lcd.C')) {
    clockHz = 0
    CLOCKS.forEach((c, i) => { if (evaluate(w, v, t, 0, { i, val: false }).rd('lcd.C') !== evaluate(w, v, t, 0, { i, val: true }).rd('lcd.C')) clockHz = Math.max(clockHz, c.hz) })
  }
  const pair = (id) => { const p = a.volts(id), q = b.volts(id); return p === null ? null : (p + q) / 2 }
  return { ...a, w, level, left: bcd('dl'), right: bcd('dr'), clockHz, voltage: w.wired('lcd.V') ? pair('lcd.V') : null, logic: w.wired('lcd.L') ? level('lcd.L') : null, fault: a.fault || b.fault }
}

/* ---- panel drawing ---- */
const Silk = ({ x, y, s = 13, a = 'middle', w = 700, children, ...p }) => <text x={x} y={y} fontSize={s} textAnchor={a} fontWeight={w} fill={INK} style={SANS} {...p}>{children}</text>
const line = { fill: 'none', stroke: INK, strokeWidth: 1.7, strokeLinejoin: 'round', strokeLinecap: 'round' }
const Block = ({ x, y, w, h }) => <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth="1.6" />
const Screw = ({ x, y, r = 8 }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="url(#g-silver)" stroke="#2A2D33" />
    <path d={`M${x - r * 0.6},${y} h${r * 1.2} M${x},${y - r * 0.6} v${r * 1.2}`} stroke="#33373F" strokeWidth="1.6" />
  </g>
)
const Dip = ({ x, y, w = 74 }) => (
  <g>
    {Array.from({ length: 7 }, (_, i) => <g key={i} fill="#C9CED6"><rect x={x + 7 + i * ((w - 18) / 6)} y={y - 5} width="4" height="5" /><rect x={x + 7 + i * ((w - 18) / 6)} y={y + 30} width="4" height="5" /></g>)}
    <rect x={x} y={y} width={w} height={30} rx="2" fill="#17191E" stroke="#3C4048" />
    <path d={`M${x},${y + 10} a5,5 0 0 1 0,10`} fill="#050608" />
  </g>
)
const NUM = { fontSize: 9.5, fill: INK, style: SANS, textAnchor: 'middle' }
const And = ({ x, y, l, p = ['1', '2', '3'] }) => (
  <g transform={`translate(${x},${y})`}>
    <path {...line} d="M-26,-20 H0 A20,20 0 0 1 0,20 H-26 Z" />
    <text x={-5} y={4} {...NUM} fontWeight="700">{l}</text>
    <text x={-32} y={-13} {...NUM}>{p[0]}</text><text x={-32} y={27} {...NUM}>{p[1]}</text><text x={28} y={-6} {...NUM}>{p[2]}</text>
  </g>
)
const Or = ({ x, y, l, xor, p = ['1', '2', '3'] }) => (
  <g transform={`translate(${x},${y})`}>
    <path {...line} d="M-26,-20 H-6 Q16,-20 30,0 Q16,20 -6,20 H-26 Q-14,0 -26,-20 Z" />
    {xor && <path {...line} d="M-33,-20 Q-21,0 -33,20" />}
    <text x={-2} y={4} {...NUM} fontWeight="700">{l}</text>
    <text x={-36} y={-13} {...NUM}>{p[0]}</text><text x={-36} y={27} {...NUM}>{p[1]}</text><text x={32} y={-6} {...NUM}>{p[2]}</text>
  </g>
)
const Not = ({ x, y, p = ['1', '2'] }) => (
  <g transform={`translate(${x},${y})`}>
    <path {...line} d="M-24,-15 L14,0 L-24,15 Z" /><circle cx="19" cy="0" r="5" {...line} />
    <text x={-30} y={-6} {...NUM}>{p[0]}</text><text x={30} y={-6} {...NUM}>{p[1]}</text>
    <text x={-8} y={-19} {...NUM} fontWeight="700">7404</text>
  </g>
)
const Junction = ({ x, y }) => <circle cx={x} cy={y} r="3.2" fill={INK} />

/* Printed tracks: [signal, path]. Charge is shown moving along any track that is high. */
const FA_TRACKS = [
  ['A', 'M112,336 H150 V349 H174'], ['A', 'M150,349 V411 H174'],
  ['B', 'M112,375 H158 V369 H174'], ['B', 'M158,369 V431 H174'],
  ['X', 'M230,359 H290 V402 H324'], ['X', 'M290,402 V478 H318'],
  ['C', 'M112,461 H305 V422 H324'], ['C', 'M305,461 V498 H318'],
  ['c1', 'M226,421 H255 V524 H420 V498 H455'], ['c2', 'M370,488 H430 V478 H455'],
  ['S', 'M380,412 H527 V392'], ['Co', 'M511,488 H537'],
]
const FS_TRACKS = [
  ['a', 'M572,361 H610 V355 H636'], ['a', 'M610,361 V515 H657'],
  ['b', 'M572,402 H622 V375 H636'], ['b', 'M622,402 V495 H724'],
  ['x', 'M692,365 H735 V355 H843'], ['x', 'M735,365 V436 H757'],
  ['c', 'M587,334 H825 V375 H843'], ['c', 'M825,375 V437 H836'],
  ['na', 'M705,515 H724'], ['nx', 'M805,436 H820 V417 H836'],
  ['b1', 'M776,505 H925 V503 H943'], ['b2', 'M888,427 H925 V483 H943'],
  ['D', 'M899,365 H1012 V392'], ['Bo', 'M999,493 H1031'],
]

const Resistors = ({ x, y }) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <line x1={x} x2={x + 32} y1={y + i * 11} y2={y + i * 11} stroke="#C9CED6" strokeWidth="1.2" />
        <rect x={x + 6} y={y - 3.5 + i * 11} width="20" height="7" rx="3" fill="#3F7FCE" />
        <rect x={x + 10} y={y - 3.5 + i * 11} width="2" height="7" fill="#8A3B12" /><rect x={x + 15} y={y - 3.5 + i * 11} width="2" height="7" fill="#111" /><rect x={x + 20} y={y - 3.5 + i * 11} width="2" height="7" fill="#C9A44C" />
      </g>
    ))}
  </g>
)

const COLOUR = { blue: '#1F5FD6', yellow: '#F4C20D', red: '#D92D20', black: '#17181C', white: '#ECEEF1' }
const Socket = ({ id }) => {
  const [x, y] = POS[id], k = KIND[id]
  if (!k) return <g><circle cx={x} cy={y} r={6.8} fill="url(#g-silver)" stroke="#111" /><circle cx={x} cy={y} r={2.8} fill="#08090B" /></g>
  return (
    <g>
      <circle cx={x} cy={y} r={13} fill="url(#g-silver)" stroke="#111" />
      <circle cx={x} cy={y} r={10.4} fill={COLOUR[k]} stroke="#000" strokeOpacity=".5" />
      <circle cx={x} cy={y} r={4.4} fill="#0A0B0D" />
    </g>
  )
}

const Breadboard = () => {
  const strip = (x, y, w, h) => <rect x={x} y={y} width={w} height={h} fill="url(#bb-holes)" />
  return (
    <g>
      <defs><pattern id="bb-holes" width="9.6" height="9.6" patternUnits="userSpaceOnUse"><rect x="3" y="3" width="3.6" height="3.6" fill="#55585F" /></pattern></defs>
      <rect x="16" y="571" width="609" height="206" rx="4" fill="#F4F2EB" stroke="#BDB9AD" />
      {[[584, 603], [745, 764]].map(([a, b], i) => <g key={i}><line x1="30" x2="612" y1={a} y2={a} stroke="#D92D20" strokeWidth="1.6" /><line x1="30" x2="612" y1={b} y2={b} stroke="#1F5FD6" strokeWidth="1.6" />{strip(36, a + 2, 570, 16)}</g>)}
      {strip(36, 615, 576, 48)}{strip(36, 683, 576, 48)}
      <rect x="16" y="665" width="609" height="16" fill="#E6E3D9" />
      {[1, 10, 20, 30, 40, 50, 60].map((n) => <text key={n} x={32 + (n - 1) * 9.6} y="613" fontSize="7" fill="#777" textAnchor="middle" style={SANS}>{n}</text>)}
    </g>
  )
}

/* Nothing here changes while the kit runs, so it is created once. */
const STATIC = (
  <g>
    <rect width="1100" height="820" fill="#E7E4DC" />
    <rect x="3" y="3" width="1094" height="814" rx="8" fill="#0B0C0F" />
    <rect x="12" y="11" width="1076" height="798" rx="4" fill="url(#g-blackpanel)" stroke="#2C2F36" />
    <rect x="12" y="11" width="1076" height="798" rx="4" fill="url(#g-sheen)" />
    <Silk x={600} y={38} s={25}>FULL ADDER &amp; FULL SUBTRACTOR KIT</Silk>
    {[[25, 800], [94, 27], [1012, 27], [587, 800], [1062, 800], [65, 358], [1058, 358]].map(([x, y], i) => <Screw key={i} x={x} y={y} r={9} />)}

    <Block x={100} y={46} w={285} h={209} />
    <Silk x={116} y={181} s={12}>A</Silk><Silk x={116} y={150} s={12}>B</Silk><Silk x={116} y={119} s={12}>C</Silk><Silk x={116} y={88} s={12}>D</Silk>
    <Silk x={370} y={181} s={12}>A</Silk><Silk x={370} y={150} s={12}>B</Silk><Silk x={370} y={119} s={12}>C</Silk><Silk x={370} y={88} s={12}>D</Silk>
    <rect x="196" y="66" width="98" height="78" rx="2" fill="#26282E" stroke="#44474F" />
    <Resistors x={160} y={84} /><Resistors x={298} y={84} />
    <Dip x={170} y={156} /><Dip x={254} y={156} />
    <Silk x={243} y={214} s={13.5}>BCD TO DECIMAL</Silk><Silk x={243} y={234} s={13.5}>7 SEGMENT DISPLAY</Silk>

    <circle cx="196" cy="273" r="20" fill="#FFB020" opacity=".22" /><circle cx="196" cy="273" r="9.5" fill="#FFC03A" stroke="#7A4E05" /><circle cx="193" cy="270" r="3" fill="#FFF3CF" />
    <Silk x={222} y={278} s={14} a="start">POWER ON</Silk>

    <Block x={388} y={46} w={312} h={248} />
    <Silk x={544} y={70} s={13.5}>16x4 LCD DISPLAY</Silk>
    <rect x="404" y="80" width="282" height="116" rx="3" fill="#0F3B2B" stroke="#0A2A1E" />
    <rect x="417" y="90" width="256" height="96" rx="2" fill="#0B0C0F" />
    <rect x="425" y="96" width="240" height="84" rx="1" fill="#D3E564" />
    {[[400, 62], [690, 62], [400, 216], [690, 216]].map(([x, y], i) => <Screw key={i} x={x} y={y} r={7.5} />)}
    <Silk x={475} y={284} s={11}>GND</Silk><Silk x={531} y={284} s={11}>CLOCK</Silk><Silk x={574} y={284} s={11}>LEVEL</Silk><Silk x={624} y={284} s={11}>VOLTAGE</Silk>

    <Block x={703} y={44} w={324} h={105} />
    {Array.from({ length: 8 }, (_, i) => <Silk key={i} x={outX(i)} y={93} s={13}>{i + 1}</Silk>)}
    <Silk x={866} y={144} s={13.5}>LOGIC OUTPUT</Silk>

    <Block x={703} y={153} w={114} h={143} />
    {CLOCKS.map((c) => <Silk key={c.hz} x={c.x + 4} y={208} s={10} a="middle" transform={`rotate(-90 ${c.x + 4} 204)`}>{c.l}</Silk>)}
    <Silk x={760} y={289} s={13}>CLOCK</Silk>

    <Block x={820} y={153} w={82} h={143} />
    <Silk x={840} y={204} s={17}>+</Silk><Silk x={882} y={204} s={17}>−</Silk>
    <Silk x={861} y={289} s={13}>+5V/1A</Silk>

    <Block x={906} y={153} w={131} h={143} />
    <Silk x={964} y={172} s={11}>HI</Silk>
    <Silk x={971} y={289} s={13}>MONO PULSER</Silk>
    <Silk x={1027} y={172} s={11}>LO</Silk>

    <Block x={69} y={297} w={481} h={249} />
    <Silk x={312} y={320} s={15}>FULL ADDER</Silk>
    <Silk x={112} y={323} s={12}>A</Silk><Silk x={94} y={380} s={12}>B</Silk><Silk x={96} y={466} s={12}>Cin</Silk>
    <Silk x={527} y={376} s={12}>SUM</Silk><Silk x={520} y={470} s={12}>CARRY</Silk><Silk x={522} y={513} s={12}>C out</Silk>
    <Dip x={132} y={486} /><Dip x={366} y={345} /><Dip x={458} y={425} />
    <Or x={200} y={359} l="7486" xor /><And x={200} y={421} l="7408" p={['1', '2', '3']} />
    <Or x={350} y={412} l="7486" xor p={['4', '5', '6']} /><And x={344} y={488} l="7408" p={['4', '5', '6']} />
    <Or x={481} y={488} l="7432" />
    {FA_TRACKS.map(([, d], i) => <path key={i} {...line} d={d} />)}
    {[[150, 349], [158, 369], [290, 402], [305, 461]].map(([x, y], i) => <Junction key={i} x={x} y={y} />)}

    <Block x={556} y={297} w={481} h={249} />
    <Silk x={800} y={320} s={15}>FULL SUBTRACTOR</Silk>
    <Silk x={572} y={348} s={12}>A</Silk><Silk x={572} y={425} s={12}>B</Silk><Silk x={612} y={324} s={12}>Bo in</Silk>
    <Silk x={1012} y={415} s={12}>DIFF</Silk><Silk x={1018} y={476} s={12}>B out</Silk>
    <Dip x={634} y={420} /><Dip x={790} y={463} /><Dip x={884} y={382} /><Dip x={890} y={311} w={70} />
    <Or x={662} y={365} l="7486" xor /><Not x={681} y={515} p={['3', '4']} /><And x={750} y={505} l="7408" />
    <Not x={781} y={436} p={['1', '2']} /><And x={862} y={427} l="7408" p={['4', '5', '6']} />
    <Or x={869} y={365} l="7486" xor p={['4', '5', '6']} /><Or x={969} y={493} l="7432" />
    {FS_TRACKS.map(([, d], i) => <path key={i} {...line} d={d} />)}
    {[[610, 361], [622, 402], [735, 355], [825, 375]].map(([x, y], i) => <Junction key={i} x={x} y={y} />)}

    <Breadboard />

    <Block x={637} y={555} w={413} h={216} />
    {Array.from({ length: 8 }, (_, i) => <Silk key={i} x={inX(i)} y={692} s={15}>{i + 1}</Silk>)}
    <Silk x={847} y={765} s={13.5}>LOGIC INPUT</Silk>

    {SOCKETS.map((s) => <Socket key={s} id={s} />)}
  </g>
)

const SEG_XY = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const Digit = ({ x, y, n }) => (
  <g strokeLinecap="round" strokeWidth="6">
    {Object.entries(SEG_XY).map(([k, p]) => {
      const lit = SEGS7447[n].includes(k)
      return <line key={k} x1={x + p[0] * 26} y1={y + p[1] * 24} x2={x + p[2] * 26} y2={y + p[3] * 24} stroke={lit ? '#FF3B30' : '#3A3C43'} />
    })}
  </g>
)
const Toggle = ({ x, on, onClick, n }) => (
  <g onClick={onClick} style={{ cursor: 'pointer' }} role="switch" aria-checked={on} aria-label={`Logic input ${n}`}>
    <rect x={x - 22} y={695} width="44" height="58" fill="transparent" />
    <polygon points={Array.from({ length: 6 }, (_, i) => `${(x + 15 * Math.cos((i * Math.PI) / 3)).toFixed(1)},${(724 + 15 * Math.sin((i * Math.PI) / 3)).toFixed(1)}`).join(' ')} fill="url(#g-silver)" stroke="#23262C" />
    <circle cx={x} cy={724} r="8" fill="#0D0F12" />
    <path d={on ? `M${x - 3.6},724 L${x - 6.4},701 A6.4,5 0 0 1 ${x + 6.4},701 L${x + 3.6},724 Z` : `M${x - 3.6},724 L${x - 6.4},747 A6.4,5 0 0 0 ${x + 6.4},747 L${x + 3.6},724 Z`} fill="url(#g-silver)" stroke="#22252B" />
  </g>
)
const PULSE_DIM = 0.55
const Lamp = ({ x, y, state, c, r = 8.5 }) => {
  const lit = state === true || state === 'pulse'
  const a = state === 'pulse' ? PULSE_DIM : 1
  return (
    <g>
      {lit && <circle cx={x} cy={y} r={r * 2.3} fill={c} opacity={0.3 * a} />}
      <circle cx={x} cy={y} r={r + 1.8} fill="#08090C" stroke="#444850" />
      <circle cx={x} cy={y} r={r} fill={lit ? c : '#3A1414'} opacity={lit ? Math.max(a, 0.6) : 1} />
      <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.3} fill="#fff" opacity={lit ? 0.8 : 0.22} />
    </g>
  )
}
const Pulser = ({ x, k, set, on, label }) => {
  const up = () => set(k, false)
  return (
    <g style={{ cursor: 'pointer', touchAction: 'none' }} role="button" aria-label={label} onPointerDown={(e) => { e.stopPropagation(); set(k, true) }} onPointerUp={up} onPointerLeave={up}>
      <rect x={x - 22} y={198} width="44" height="44" rx="4" fill="#151619" stroke="#3A3D45" />
      <rect x={x - 15} y={205 + (on ? 1.5 : 0)} width="30" height="30" rx="3" fill="#E9D79E" stroke="#8A6F2C" />
      <rect x={x - 10} y={210 + (on ? 1.5 : 0)} width="20" height="20" rx="2" fill="#F6ECC8" />
    </g>
  )
}

const hzText = (f) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`)
const cordPath = ([x1, y1], [x2, y2]) => {
  const d = Math.hypot(x2 - x1, y2 - y1), sag = 14 + d * 0.08
  return `M${x1},${y1} C${x1},${y1 + sag} ${x2},${y2 + sag} ${x2},${y2}`
}

function Stage({ v, o, t, set }) {
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [hover, setHover] = useState(null)
  const pt = (e) => {
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svgRef.current.getScreenCTM().inverse())
    return [q.x, q.y]
  }
  const near = (p, from) => {
    let best = null, bd = 22
    SOCKETS.forEach((s) => { const d = Math.hypot(POS[s][0] - p[0], POS[s][1] - p[1]); if (s !== from && d < bd) { bd = d; best = s } })
    return best
  }
  const move = (e) => {
    if (!drag) return
    const p = pt(e)
    setHover(near(p, drag.from))
    setDrag((d) => (d ? { ...d, to: p } : d))
  }
  const up = (e) => {
    if (!drag) return
    const p = pt(e), h = near(p, drag.from)
    if (!h && Math.hypot(p[0] - POS[drag.from][0], p[1] - POS[drag.from][1]) < 12) {
      const last = [...v.cords].reverse().find((c) => c.includes(drag.from))
      if (last) set('cords', v.cords.filter((c) => c !== last))
    }
    if (h && !v.cords.some((c) => c.includes(h) && c.includes(drag.from))) set('cords', [...v.cords, [drag.from, h]])
    setDrag(null); setHover(null)
  }
  const dots = (d, on, key) => on && <path key={key} d={d} fill="none" stroke="#5CC8FF" strokeWidth="4" strokeLinecap="round" strokeDasharray="0 15" strokeDashoffset={-t * 40} pointerEvents="none" />
  const lv = o.logic === null ? '----' : o.logic === 'pulse' ? 'PULSE' : o.logic === undefined ? '----' : o.logic ? 'HIGH' : 'LOW'
  const lines = [
    `VOLTAGE: ${o.voltage === null ? '----' : `${o.voltage.toFixed(2)} V`}`,
    `LEVEL  : ${lv}`,
    `CLOCK  : ${o.clockHz === null ? '----' : o.clockHz ? hzText(o.clockHz) : 'NO CLOCK'}`,
    o.fault ? '! OUTPUT CONFLICT' : '',
  ]
  return (
    <Svg vb={VB} svgRef={svgRef} onPointerMove={move} onPointerUp={up}>
      {STATIC}
      {FA_TRACKS.map(([s, d], i) => dots(d, o[s], `f${i}`))}
      {FS_TRACKS.map(([s, d], i) => dots(d, o[s], `s${i}`))}

      <Digit x={208} y={76} n={o.left} /><Digit x={256} y={76} n={o.right} />
      {lines.map((l, i) => <text key={i} x="434" y={115 + i * 19.5} fontSize="16" fontWeight="600" fontFamily={MONO} fill={i === 3 ? '#7A1B0C' : '#26360A'} letterSpacing="2.6">{l}</text>)}

      {Array.from({ length: 8 }, (_, i) => <Lamp key={i} x={outX(i)} y={68} state={o.level(`out${i}`)} c="#FF3B30" />)}
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <Lamp x={inX(i)} y={645} state={!!v[`s${i}`]} c="#39E36B" />
          <Toggle x={inX(i)} n={i + 1} on={!!v[`s${i}`]} onClick={() => set(`s${i}`, !v[`s${i}`])} />
        </g>
      ))}
      <Pulser x={937} k="pH" set={set} on={v.pH} label="Mono pulser high" />
      <Pulser x={1000} k="pL" set={set} on={v.pL} label="Mono pulser low" />

      {v.cords.map((c, i) => {
        const a = POS[c[0]], b = POS[c[1]], d = cordPath(a, b), col = CORD_COL[i % CORD_COL.length], s = o.level(c[0])
        return (
          <g key={`${c[0]}${c[1]}`} className="cord" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); set('cords', v.cords.filter((x) => x !== c)) }}>
            <path d={d} fill="none" stroke="transparent" strokeWidth="16" />
            <path d={d} fill="none" stroke="#000" strokeOpacity=".3" strokeWidth="7" transform="translate(2,4)" />
            <path d={d} fill="none" stroke={col} strokeWidth="5.6" strokeLinecap="round" />
            <path d={d} fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.4" />
            {s === true && <path d={d} fill="none" stroke="#0B2A52" strokeWidth="3" strokeLinecap="round" strokeDasharray="0 14" strokeDashoffset={-t * 40} />}
            {[a, b].map((p, k) => <g key={k}><circle cx={p[0]} cy={p[1]} r={KIND[c[k]] ? 9.5 : 7.5} fill={col} stroke="#000" strokeOpacity=".45" /><circle cx={p[0]} cy={p[1]} r={3.4} fill="#fff" fillOpacity=".55" /></g>)}
          </g>
        )
      })}
      {SOCKETS.map((s) => (
        <circle key={s} className="socket" cx={POS[s][0]} cy={POS[s][1]} r={KIND[s] ? 18 : 14} fill={hover === s || drag?.from === s ? 'rgba(79,195,255,.42)' : 'transparent'} style={{ cursor: 'crosshair', touchAction: 'none' }}
          onPointerEnter={() => { if (!drag) setHover(s) }} onPointerLeave={() => { if (!drag) setHover(null) }}
          onPointerDown={(e) => { e.stopPropagation(); svgRef.current.setPointerCapture?.(e.pointerId); setDrag({ from: s, to: pt(e) }) }} />
      ))}

      {drag && <path d={cordPath(POS[drag.from], drag.to)} fill="none" stroke="#4FC3FF" strokeWidth="5.6" strokeLinecap="round" pointerEvents="none" />}
    </Svg>
  )
}

/* ---- experiments ---- */
const act = (k, label, cords) => ({ k, type: 'action', label, run: (set) => set('cords', cords) })
const controls = [act('wa', 'Wire full adder', ADDER), act('ws', 'Wire full subtractor', SUBTRACTOR), act('wc', 'Remove all cords', [])]
const switches = (cords) => ({ cords, s0: true, s1: false, s2: true, s3: false, s4: false, s5: false, s6: false, s7: false, pH: false, pL: false })
const logicCols = (a, b) => [['A', 'A', 0], ['B', 'B', 0], ['C', a, 0], ['S', b[0], 0], ['Co', b[1], 0]]
const logicAnal = (check) => (r) => {
  const seen = new Set(r.map((x) => `${x.A}${x.B}${x.C}`))
  const good = r.filter(check).length
  return [['Input states covered', `${seen.size} of 8`, ''], ['Rows matching the truth table', `${good} of ${r.length}`, '']]
}
const shown = (w, id) => { for (let i = 0; i < 8; i++) if (w.net[`out${i}`] === w.net[id]) return true; return w.net['lcd.L'] === w.net[id] }
const switchFor = (w, id) => { for (let i = 0; i < 8; i++) if (w.net[`in${i}`] === w.net[id]) return i; return -1 }

function kitExperiment({ id, title, short, aim, formula, principle, preset, ins, outs, names, values, check, colA, colB }) {
  return {
    id, title, short, aim, formula, principle,
    steps: [`Patch Logic Input 1, 2 and 3 to ${names.slice(0, 3).join(', ')}, or press the wire button.`, `Patch ${names[3]} and ${names[4]} to two Logic Output sockets.`, 'Flip the input switches and watch the red output LEDs.', 'Record all eight rows of the truth table.'],
    controls,
    state: () => switches(preset),
    out: compute,
    Stage,
    read: (v, o) => {
      const [S, C] = values(o)
      return [[names[3], o.w.wired(outs[0]) ? +S : '–', ''], [names[4], o.w.wired(outs[1]) ? +C : '–', '']]
    },
    columns: logicCols(colA, colB),
    sample: (v, o) => {
      if (ins.some((s) => o.rd(s) === null)) return { error: `Patch ${names.slice(0, 3).join(', ')} to the Logic Input sockets first.` }
      if (outs.some((s) => !shown(o.w, s))) return { error: `Patch ${names[3]} and ${names[4]} to Logic Output sockets to read them.` }
      if (o.fault) return { error: 'Two outputs are driving the same socket. Remove the conflicting cord.' }
      const [A, B, C2, S, Co] = [...ins.map((s) => o.rd(s)), ...values(o)]
      return { A: +A, B: +B, C: +C2, S: +S, Co: +Co }
    },
    sweep: {
      list: (v) => {
        const w = wiring(v.cords), keys = ins.map((s) => switchFor(w, s))
        if (keys.some((k) => k < 0) || new Set(keys).size < 3 || outs.some((s) => !shown(w, s))) return []
        return Array.from({ length: 8 }, (_, n) => Object.fromEntries(keys.map((k, j) => [`s${k}`, !!((n >> (2 - j)) & 1)])))
      },
    },
    need: 8,
    needHint: 'Fill in all eight rows of the truth table.',
    tip: 'Click a switch to flip it. Drag between sockets to patch and click a cord to remove it. An unconnected gate input reads as logic 1, as on real 74-series chips.',
    analyse: logicAnal(check),
    micro: (v, o) => {
      const [S, C] = values(o), inV = ins.map((s) => o.rd(s) ?? true)
      return { scene: 'logic', bits: [...inV, S, C].map((b) => (b ? 1 : 0)), names, title: 'Charge on the signal lines', note: 'Logic 1 is a packet of charge on the track. Logic 0 leaves the track empty.' }
    },
  }
}

export const adderPanelKit = [
  kitExperiment({
    id: 'full-adder', title: 'Full adder', short: 'Sum and carry', preset: ADDER,
    aim: 'Patch the full adder on the kit and verify its truth table.',
    formula: 'S = A ⊕ B ⊕ Cᵢₙ     Cₒᵤₜ = AB + (A ⊕ B)Cᵢₙ',
    principle: 'A full adder combines two bits with a carry-in using two XOR gates (7486), two AND gates (7408) and an OR gate (7432).',
    ins: ['fa.A', 'fa.B', 'fa.C'], outs: ['fa.S', 'fa.Co'], names: ['A', 'B', 'Cin', 'SUM', 'CARRY'], colA: 'Cᵢₙ', colB: ['Sum', 'Cₒᵤₜ'],
    values: (o) => [o.S, o.Co],
    check: (x) => x.S === (x.A ^ x.B ^ x.C) && x.Co === ((x.A + x.B + x.C) >= 2 ? 1 : 0),
  }),
  kitExperiment({
    id: 'full-subtractor', title: 'Full subtractor', short: 'Difference and borrow', preset: SUBTRACTOR,
    aim: 'Patch the full subtractor on the kit and verify its truth table.',
    formula: 'D = A ⊕ B ⊕ Bᵢₙ     Bₒᵤₜ = A′B + (A ⊕ B)′Bᵢₙ',
    principle: 'A full subtractor computes A − B − Bᵢₙ. The difference uses the same XOR path as the adder, while the borrow logic uses inverted signals from the 7404.',
    ins: ['fs.A', 'fs.B', 'fs.C'], outs: ['fs.D', 'fs.Bo'], names: ['A', 'B', 'Bo in', 'DIFF', 'B out'], colA: 'Bᵢₙ', colB: ['Diff', 'Bₒᵤₜ'],
    values: (o) => [o.D, o.Bo],
    check: (x) => x.S === (x.A ^ x.B ^ x.C) && x.Co === (x.A - x.B - x.C < 0 ? 1 : 0),
  }),
]
