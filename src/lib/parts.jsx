import { useMemo } from 'react'
import { clamp } from './math'

/* Shared drawing vocabulary for every kit: enclosures, displays, sockets, wires,
   schematic symbols and the oscilloscope. Stages are drawn on an 800 x 500 canvas. */

export const C = {
  ink: '#1B2740', ink2: '#56627A', ink3: '#8A94A6', line: '#CFD5DF', soft: '#E9ECF1', panel: '#FFFFFF', steel: '#A6B0BF',
  lcd: '#DDE7C7', lcdInk: '#2A3A1C', screen: '#FAFBF6', grid: '#DFE5D8',
  t1: '#2563EB', t2: '#D9480F', t3: '#0F9D76', t4: '#9333EA',
  silk: '#EDEFF3', silk2: '#BFC6D2', electron: '#38BDF8',
  red: '#E5484D', amber: '#F59E0B', green: '#18A058', blue: '#2563EB', copper: '#C4733A', brass: '#C9A44C', glass: '#CFE6F3',
}

export function Svg({ children, vb = '0 0 800 500', svgRef, ...rest }) {
  return (
    <svg viewBox={vb} className="stage-svg" ref={svgRef} {...rest}>
      <defs>
        <linearGradient id="g-metal" x1="0" x2="1"><stop offset="0" stopColor="#E7EAEF" /><stop offset=".5" stopColor="#FFFFFF" /><stop offset="1" stopColor="#D4D9E1" /></linearGradient>
        <linearGradient id="g-panel" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#F1F3F7" /></linearGradient>
        <linearGradient id="g-bench" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#E9E4D8" /><stop offset="1" stopColor="#DAD3C4" /></linearGradient>
        <linearGradient id="g-black" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#23262D" /><stop offset=".55" stopColor="#14161B" /><stop offset="1" stopColor="#1C1F25" /></linearGradient>
        <linearGradient id="g-blackpanel" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#1B1D22" /><stop offset=".6" stopColor="#101216" /><stop offset="1" stopColor="#191B20" /></linearGradient>
        <linearGradient id="g-sheen" x1="0" x2="1" y1="0" y2="1"><stop offset=".15" stopColor="#fff" stopOpacity="0" /><stop offset=".45" stopColor="#fff" stopOpacity=".07" /><stop offset=".62" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <radialGradient id="g-brass" cx=".35" cy=".3"><stop offset="0" stopColor="#F5DE9A" /><stop offset=".6" stopColor="#C9A44C" /><stop offset="1" stopColor="#8A6F2C" /></radialGradient>
        <linearGradient id="g-silver" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#F4F5F7" /><stop offset=".5" stopColor="#B6BCC6" /><stop offset="1" stopColor="#868E9B" /></linearGradient>
        <radialGradient id="g-glow"><stop offset="0" stopColor="#FFD27A" stopOpacity=".95" /><stop offset="1" stopColor="#FFD27A" stopOpacity="0" /></radialGradient>
        <linearGradient id="g-copper" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#E0A070" /><stop offset=".5" stopColor="#C4733A" /><stop offset="1" stopColor="#99552A" /></linearGradient>
      </defs>
      {children}
    </svg>
  )
}

/** Renders R_TH style text with a true subscript inside SVG. */
export const svgRich = (s) => {
  if (typeof s !== 'string' || !s.includes('_')) return s
  return s.split(/_([A-Za-z0-9]+)/).map((part, i) => (i % 2
    ? <tspan key={i} dy="0.28em" fontSize="74%">{part}</tspan>
    : <tspan key={i} dy={i ? '-0.21em' : 0}>{part}</tspan>))
}

export const T = ({ x, y, s = 12, a = 'start', c = C.ink, w = 500, children, ...p }) => (
  <text x={x} y={y} fontSize={s} textAnchor={a} fill={c} fontWeight={w} {...p}>{svgRich(children)}</text>
)

export const Bench = ({ y = 462 }) => (
  <g>
    <rect x="0" y={y} width="800" height={500 - y} fill="url(#g-bench)" />
    <line x1="0" x2="800" y1={y} y2={y} stroke="#C7BFAE" />
  </g>
)

/** Instrument enclosure. Black anodised by default; `light` for an apparatus backdrop. */
export const Panel = ({ x, y, w, h, t, r = 10, sub, light }) => (
  <g>
    <rect x={x + 1} y={y + 3} width={w} height={h} rx={r} fill="#1B2740" opacity={light ? '.07' : '.22'} />
    <rect x={x} y={y} width={w} height={h} rx={r} fill={light ? 'url(#g-panel)' : 'url(#g-black)'} stroke={light ? C.line : '#050608'} />
    {t && <T x={x + 12} y={y + 18} s={10.5} w={700} c={light ? C.ink2 : C.silk} letterSpacing=".06em">{t}</T>}
    {sub && <T x={x + w - 12} y={y + 18} s={9.5} a="end" c={light ? C.ink3 : C.silk2}>{sub}</T>}
  </g>
)

export const Lcd = ({ x, y, w, h = 44, value, unit, label, s = 22 }) => (
  <g>
    {label && <T x={x + 2} y={y - 5} s={9.5} c={C.silk2} w={600}>{label}</T>}
    <rect x={x} y={y} width={w} height={h} rx={5} fill={C.lcd} stroke="#B9C5A0" />
    <T x={x + w - (unit ? 40 : 8)} y={y + h / 2 + s * 0.36} s={s} a="end" c={C.lcdInk} w={600}>{value}</T>
    {unit && <T x={x + w - 36} y={y + h / 2 + 5} s={11} c={C.lcdInk}>{unit}</T>}
  </g>
)

export const LcdText = ({ x, y, w, h, lines = [], s = 13 }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={5} fill={C.lcd} stroke="#B9C5A0" />
    {lines.map((l, i) => <T key={i} x={x + 10} y={y + 8 + (i + 1) * (s + 5) - 4} s={s} c={C.lcdInk} w={600}>{l}</T>)}
  </g>
)

export const Led = ({ x, y, on, c = C.red, r = 6, l, lc = C.silk2 }) => (
  <g>
    {on && <circle cx={x} cy={y} r={r * 2.4} fill={c} opacity=".22" />}
    <circle cx={x} cy={y} r={r} fill={on ? c : '#3A3E47'} stroke={on ? c : '#5A606C'} />
    {l && <T x={x} y={y + r + 13} s={10} a="middle" c={lc}>{l}</T>}
  </g>
)

export const Jack = ({ x, y, c = C.brass, l }) => (
  <g>
    <circle cx={x} cy={y} r={8} fill="url(#g-brass)" stroke={c} strokeWidth={1.2} />
    <circle cx={x} cy={y} r={3.2} fill="#1A1408" />
    {l && <T x={x} y={y + 21} s={9.5} a="middle" c={C.silk2}>{l}</T>}
  </g>
)

export const Knob = ({ x, y, r = 18, val = 0.5, l, lc = C.silk2 }) => {
  const a = (-135 + 270 * clamp(val, 0, 1)) * (Math.PI / 180)
  return (
    <g>
      <circle cx={x} cy={y} r={r + 4} fill="none" stroke={C.soft} strokeWidth={3} />
      <circle cx={x} cy={y} r={r} fill="url(#g-metal)" stroke={C.steel} />
      <line x1={x + Math.sin(a) * r * 0.3} y1={y - Math.cos(a) * r * 0.3} x2={x + Math.sin(a) * r * 0.9} y2={y - Math.cos(a) * r * 0.9} stroke={C.t2} strokeWidth={3} strokeLinecap="round" />
      {l && <T x={x} y={y + r + 18} s={10} a="middle" c={lc}>{l}</T>}
    </g>
  )
}

/** Conductor. When `on`, moving dashes show the direction of current. */
export const Wire = ({ d, on, t = 0, c = C.ink2, w = 2, rate = 34 }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={c} strokeWidth={w} />
    {on && <path d={d} stroke={C.electron} strokeWidth={w + 3} strokeDasharray="0 15" strokeDashoffset={-t * rate} />}
  </g>
)

export const Arrow = ({ x1, y1, x2, y2, c = C.ink, w = 2 }) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 8
  return (
    <g stroke={c} fill={c}>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(a) * 4} y2={y2 - Math.sin(a) * 4} strokeWidth={w} />
      <path d={`M${x2},${y2} L${x2 - s * Math.cos(a - 0.45)},${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)},${y2 - s * Math.sin(a + 0.45)} Z`} stroke="none" />
    </g>
  )
}

export const Ray = ({ x1, y1, x2, y2, c = C.red, o = 1, w = 3 }) => (
  <g opacity={o}>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w + 5} opacity=".16" strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w} strokeLinecap="round" />
    <line className="photon" x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFF8DC" strokeWidth={w + 1.6} strokeLinecap="round" strokeDasharray="0 20" />
  </g>
)

/** Oscilloscope. Each trace is a function of u in [0,1] returning -1..1, or xy mode. */
export function Scope({ x, y, w, h, tr = [], xy, n = 220, title = 'OSCILLOSCOPE', sub }) {
  const pad = 10, iw = w - pad * 2, ih = h - 38, top = y + 26, cy = top + ih / 2, left = x + pad
  const ln = []
  for (let i = 0; i <= 10; i++) ln.push(<line key={'v' + i} x1={left + (iw * i) / 10} x2={left + (iw * i) / 10} y1={top} y2={top + ih} stroke={i === 5 ? '#C4CDB9' : C.grid} />)
  for (let i = 0; i <= 8; i++) ln.push(<line key={'h' + i} x1={left} x2={left + iw} y1={top + (ih * i) / 8} y2={top + (ih * i) / 8} stroke={i === 4 ? '#C4CDB9' : C.grid} />)
  const path = (f) => {
    let d = ''
    for (let i = 0; i <= n; i++) {
      const u = i / n
      d += `${i ? 'L' : 'M'}${(left + u * iw).toFixed(1)},${(cy - clamp(f(u), -1.05, 1.05) * (ih / 2) * 0.92).toFixed(1)}`
    }
    return d
  }
  let xyPath = ''
  if (xy) {
    const m = xy.n || 500
    for (let i = 0; i <= m; i++) {
      const [px, py] = xy.f(i / m)
      xyPath += `${i ? 'L' : 'M'}${(left + iw / 2 + clamp(px, -1.05, 1.05) * (iw / 2) * 0.9).toFixed(1)},${(cy - clamp(py, -1.05, 1.05) * (ih / 2) * 0.9).toFixed(1)}`
    }
  }
  const labelled = tr.filter((q) => q.l)
  return (
    <g>
      <Panel x={x} y={y} w={w} h={h} t={title} sub={labelled.length ? undefined : sub} />
      <rect x={left} y={top} width={iw} height={ih} fill={C.screen} stroke="#C4CDB9" />
      {ln}
      {tr.map((t, i) => <path key={i} d={path(t.f)} fill="none" stroke={t.c || [C.t1, C.t2, C.t3, C.t4][i]} strokeWidth={2} strokeLinejoin="round" />)}
      {xy && <path d={xyPath} fill="none" stroke={xy.c || C.t1} strokeWidth={2} strokeLinejoin="round" />}
      {labelled.map((t, i) => (
        <g key={'l' + i} transform={`translate(${x + w - 12 - (labelled.length - i) * 76},${y + 15})`}>
          <line x1="0" x2="12" y1="-3" y2="-3" stroke={t.c || [C.t1, C.t2, C.t3, C.t4][tr.indexOf(t)]} strokeWidth={2.5} />
          <T x={16} y={0} s={9.5} c={C.silk2}>{t.l}</T>
        </g>
      ))}
    </g>
  )
}

/** A toggle switch that sits on the kit and can be clicked directly. */
export const Sw = ({ x, y, on, onClick, l }) => (
  <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
    <rect x={x - 14} y={y - 24} width={28} height={48} fill="transparent" />
    <rect x={x - 11} y={y - 21} width={22} height={42} rx={6} fill={on ? '#FFE9DF' : '#EEF0F4'} stroke={on ? C.t2 : C.steel} />
    <rect x={x - 8} y={on ? y - 18 : y + 2} width={16} height={16} rx={4} fill={on ? C.t2 : '#fff'} stroke={on ? C.t2 : C.steel} />
    {l && <T x={x} y={y + 37} s={11} a="middle" w={600} c={C.ink2}>{l}</T>}
  </g>
)

const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const GMAP = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', A: 'abcefg', b: 'fgedc', C: 'afed', d: 'bgedc', E: 'afged', F: 'afge', '-': 'g', ' ': '' }
export const Seven = ({ x, y, ch, s = 20, c = C.red }) => (
  <g strokeLinecap="round" strokeWidth={s * 0.2}>
    {Object.entries(SEG).map(([k, p]) => (
      <line key={k} x1={x + p[0] * s} y1={y + p[1] * s} x2={x + p[2] * s} y2={y + p[3] * s} stroke={(GMAP[ch] || '').includes(k) ? c : '#2C2F37'} />
    ))}
  </g>
)

/* Schematic symbols. Centre at x,y; horizontal unless rot given. */
const Sym = ({ x, y, rot = 0, children }) => <g transform={`translate(${x},${y}) rotate(${rot})`} fill="none" stroke={C.ink} strokeWidth={2} strokeLinejoin="round">{children}</g>
const Lab = ({ x, y, l, v }) => (
  <g>
    {l && <T x={x} y={y} s={12} a="middle" w={700}>{l}</T>}
    {v && <T x={x} y={y + 14} s={11} a="middle" c={C.ink2}>{v}</T>}
  </g>
)
export const Res = ({ x, y, rot, l, v, lx = 0, ly = -30 }) => (
  <g>
    <Sym x={x} y={y} rot={rot}><path d="M-30,0 H-20 l4,-9 8,18 8,-18 8,18 8,-18 4,9 H30" /></Sym>
    <Lab x={x + lx} y={y + ly} l={l} v={v} />
  </g>
)
export const Cap = ({ x, y, rot, l, v, lx = 0, ly = -30 }) => (
  <g>
    <Sym x={x} y={y} rot={rot}><path d="M-30,0 H-5 M-5,-14 V14 M5,-14 V14 M5,0 H30" /></Sym>
    <Lab x={x + lx} y={y + ly} l={l} v={v} />
  </g>
)
export const Ind = ({ x, y, rot, l, v, lx = 0, ly = -30 }) => (
  <g>
    <Sym x={x} y={y} rot={rot}><path d="M-30,0 H-21 a7,7 0 0 1 14,0 a7,7 0 0 1 14,0 a7,7 0 0 1 14,0 H30" /></Sym>
    <Lab x={x + lx} y={y + ly} l={l} v={v} />
  </g>
)
export const Src = ({ x, y, rot, l, v, ac, lx = 44, ly = -2 }) => (
  <g>
    <Sym x={x} y={y} rot={rot}>
      <path d="M-30,0 H-16 M16,0 H30" />
      <circle r="16" fill="#fff" />
      {ac ? <path d="M-9,0 c3,-11 6,-11 9,0 s6,11 9,0" /> : <path d="M9,-5 V5 M4,0 H14 M-13,0 H-5" />}
    </Sym>
    <Lab x={x + lx} y={y + ly} l={l} v={v} />
  </g>
)
export const Mtr = ({ x, y, l, v, lx = 0, ly = -24 }) => (
  <g>
    <circle cx={x} cy={y} r={16} fill="#fff" stroke={C.t1} strokeWidth={2} />
    <T x={x} y={y + 5} s={14} a="middle" w={700} c={C.t1}>{l}</T>
    {v && <T x={x + lx} y={y + ly} s={11.5} a="middle" w={700}>{v}</T>}
  </g>
)
export const Gnd = ({ x, y }) => <path d={`M${x},${y} v8 M${x - 11},${y + 8} h22 M${x - 7},${y + 13} h14 M${x - 3},${y + 18} h6`} stroke={C.ink} strokeWidth={2} fill="none" />
export const Dot = ({ x, y }) => <circle cx={x} cy={y} r={3.5} fill={C.ink} />

export const Dim = ({ x1, y1, x2, y2, l, c = C.ink2, off = 14 }) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, vert = x1 === x2
  return (
    <g stroke={c} strokeWidth={1}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <circle cx={x1} cy={y1} r={2} fill={c} /><circle cx={x2} cy={y2} r={2} fill={c} />
      <T x={mx + (vert ? 8 : 0)} y={my + (vert ? 4 : 8 - off)} s={11} a={vert ? 'start' : 'middle'} c={c} stroke="none">{l}</T>
    </g>
  )
}

/** Procedurally generated bitmap, used for interference and ring patterns. */
export function usePixels(w, h, fn, deps) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d'), im = g.createImageData(w, h)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const [r, gg, b] = fn((i + 0.5) / w, (j + 0.5) / h), p = (j * w + i) * 4
        im.data[p] = r; im.data[p + 1] = gg; im.data[p + 2] = b; im.data[p + 3] = 255
      }
    g.putImageData(im, 0, 0)
    return c.toDataURL()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Circular field of view (eyepiece). */
export const Eyepiece = ({ cx, cy, r, href, children, id, label }) => (
  <g>
    <clipPath id={id}><circle cx={cx} cy={cy} r={r} /></clipPath>
    <circle cx={cx} cy={cy} r={r + 9} fill="#2B3650" />
    <circle cx={cx} cy={cy} r={r + 3} fill="#4B5875" />
    <g clipPath={`url(#${id})`}>
      {href && <image href={href} x={cx - r} y={cy - r} width={r * 2} height={r * 2} preserveAspectRatio="none" />}
      {children}
    </g>
    {label && <T x={cx} y={cy + r + 28} s={11} a="middle" w={600} c={C.ink2}>{label}</T>}
  </g>
)
