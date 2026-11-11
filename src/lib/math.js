export const PI = Math.PI, TAU = 2 * Math.PI
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
export const rad = (d) => (d * PI) / 180
export const deg = (r) => (r * 180) / PI
export const sq = (x) => x * x
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
export const lerp = (a, b, u) => a + (b - a) * u

const gauss = () => {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)
}
/** Small relative measurement scatter, the kind a real reading has. */
export const jitter = (x, pct = 0.002) => x * (1 + pct * gauss())
/** Small absolute measurement scatter. */
export const wobble = (x, abs) => x + abs * gauss()
export const snap = (x, step) => Math.round(x / step) * step

/** Least-squares straight line through rows[xk], rows[yk]. */
export function fit(rows, xk, yk) {
  const pts = rows.map((r) => [+r[xk], +r[yk]]).filter((p) => isFinite(p[0]) && isFinite(p[1]))
  const n = pts.length
  if (n < 2) return null
  const sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0)
  const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0), sxy = pts.reduce((s, p) => s + p[0] * p[1], 0)
  const d = n * sxx - sx * sx
  if (Math.abs(d) < 1e-30) return null
  const m = (n * sxy - sx * sy) / d, c = (sy - m * sx) / n
  const ybar = sy / n
  const ssr = pts.reduce((s, p) => s + sq(p[1] - m * p[0] - c), 0)
  const sst = pts.reduce((s, p) => s + sq(p[1] - ybar), 0)
  return { m, c, r2: sst > 0 ? 1 - ssr / sst : 1 }
}

export const curve = (fn, a, b, n = 160) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const x = a + ((b - a) * i) / n
    return [x, fn(x)]
  })

export const steps = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1))

/** Local maxima in rows (sorted by xk) above a floor value. */
export function peaks(rows, xk, yk, win = 2, floor = 0) {
  const s = [...rows].sort((a, b) => a[xk] - b[xk])
  const out = []
  for (let i = win; i < s.length - win; i++) {
    let top = true
    for (let j = i - win; j <= i + win; j++) if (s[j][yk] > s[i][yk]) top = false
    if (top && s[i][yk] > floor) out.push(s[i])
  }
  return out
}
export const dips = (rows, xk, yk, win = 2) =>
  peaks(rows.map((r) => ({ ...r, [yk]: -r[yk] })), xk, yk, win, -Infinity)

export const spacing = (list, k) => {
  if (list.length < 2) return null
  return (list[list.length - 1][k] - list[0][k]) / (list.length - 1)
}

export function fmt(x, d = 3) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  if (typeof x === 'string') return x
  if (!isFinite(x)) return '∞'
  const a = Math.abs(x)
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return sci(x, 3)
  return x.toFixed(d)
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
export function sci(x, d = 2) {
  if (x === 0) return '0'
  const [m, e] = x.toExponential(d).split('e')
  const n = +e
  const sup = (n < 0 ? '⁻' : '') + String(Math.abs(n)).split('').map((c) => SUP[+c]).join('')
  return `${m}×10${sup}`
}

/* Complex helpers for AC circuits, as [re, im]. */
export const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]]
export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
export const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1]
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
}
export const cabs = (a) => Math.hypot(a[0], a[1])
export const cpar = (a, b) => cdiv(cmul(a, b), cadd(a, b))

/* Definition helpers for simulator controls. */
export const num = (k, label, min, max, step, init, unit = '', extra = {}) => ({ k, label, min, max, step, init, unit, ...extra })
export const sel = (k, label, options, init = options[0][0]) => ({ k, label, type: 'select', options, init })
export const tog = (k, label, init = false) => ({ k, label, type: 'toggle', init })
