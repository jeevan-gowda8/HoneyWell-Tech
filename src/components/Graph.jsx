import { memo, useRef, useState } from 'react'
import { fit, fmt } from '../lib/math'
import { svgRich } from '../lib/parts'

const W = 620, H = 340, M = { l: 62, r: 18, t: 16, b: 48 }

function nice(lo, hi, n = 5) {
  const span = hi - lo || Math.abs(hi) || 1
  const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step
  const t = []
  for (let v = a; v <= b + step * 0.5; v += step) t.push(+v.toPrecision(10))
  return { a, b, t }
}
const tick = (v) => {
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1e4 || a < 1e-2) return v.toExponential(0).replace('e+', 'e')
  return +v.toPrecision(4) + ''
}
const ok = (p) => isFinite(p[0]) && isFinite(p[1])

/** Single-chart plot: recorded readings as dots, optional model curve, fit line and live marker. */
export const Graph = memo(function Graph({ cfg, rows, v }) {
  const [hover, setHover] = useState(null)
  const svg = useRef(null)
  const pts = rows.map((r) => [r[cfg.x], r[cfg.y]]).filter(ok)
  const model = cfg.curve ? cfg.curve(v) : null
  const live = cfg.live ? cfg.live(v) : null
  const all = [...pts, ...(model || []), ...(live ? [live] : [])].filter(ok)
  const empty = all.length === 0
  let xs = all.map((p) => p[0]), ys = all.map((p) => p[1])
  if (cfg.zero !== false) { xs = xs.concat(0); ys = ys.concat(0) }
  const log = cfg.logx
  if (log) xs = xs.filter((x) => x > 0)
  let X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys)
  if (empty) { X0 = log ? 1 : 0; X1 = log ? 10 : 1; Y0 = 0; Y1 = 1 }
  const ny = nice(Y0, Y1)
  const nx = log ? null : nice(X0, X1)
  const xa = log ? Math.floor(Math.log10(X0)) : nx.a, xb = log ? Math.ceil(Math.log10(X1)) : nx.b
  const px = (x) => M.l + (((log ? Math.log10(x) : x) - xa) / (xb - xa || 1)) * (W - M.l - M.r)
  const py = (y) => H - M.b - ((y - ny.a) / (ny.b - ny.a || 1)) * (H - M.t - M.b)
  const xt = log ? Array.from({ length: xb - xa + 1 }, (_, i) => Math.pow(10, xa + i)) : nx.t
  const path = (a) => {
    let d = '', pen = false
    a.forEach((p) => {
      if (!ok(p) || (log && p[0] <= 0)) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`
      pen = true
    })
    return d
  }
  const f = cfg.fit && pts.length >= 2 ? fit(rows, cfg.x, cfg.y) : null
  const fx = pts.length ? [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))] : [0, 1]

  const onMove = (e) => {
    if (!pts.length) return
    const b = svg.current.getBoundingClientRect()
    const mx = ((e.clientX - b.left) / b.width) * W, my = ((e.clientY - b.top) / b.height) * H
    let best = null, bd = 1600
    pts.forEach((p) => {
      const d = (px(p[0]) - mx) ** 2 + (py(p[1]) - my) ** 2
      if (d < bd) { bd = d; best = p }
    })
    setHover(best)
  }

  return (
    <div className="graph">
      <div className="graph-legend">
        {pts.length > 0 && <span><i className="k-dot" />Readings</span>}
        {f && <span><i className="k-line" />Best fit</span>}
        {model && <span><i className="k-model" />{cfg.modelLabel || 'Kit response'}</span>}
        {live && <span><i className="k-live" />Now</span>}
        {f && <em>slope {fmt(f.m, 4)} · R² {f.r2.toFixed(4)}</em>}
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="graph-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`${cfg.yl} against ${cfg.xl}`}>
        {ny.t.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={py(t)} y2={py(t)} stroke="#ECEEF2" />
            <text x={M.l - 8} y={py(t) + 4} textAnchor="end" className="g-tick">{tick(t)}</text>
          </g>
        ))}
        {xt.map((t) => <text key={t} x={px(t)} y={H - M.b + 18} textAnchor="middle" className="g-tick">{tick(t)}</text>)}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="#B7BFCC" />
        <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle" className="g-axis">{svgRich(cfg.xl)}</text>
        <text transform={`translate(15,${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" className="g-axis">{svgRich(cfg.yl)}</text>
        {model && <path d={path(model)} fill="none" stroke="#9AA6BA" strokeWidth={2} strokeLinejoin="round" />}
        {f && <line x1={px(fx[0])} x2={px(fx[1])} y1={py(f.m * fx[0] + f.c)} y2={py(f.m * fx[1] + f.c)} stroke="#D9480F" strokeWidth={2} />}
        {pts.map((p, i) => <circle key={i} cx={px(p[0])} cy={py(p[1])} r={5} fill="#2563EB" stroke="#fff" strokeWidth={2} />)}
        {live && ok(live) && (!log || live[0] > 0) && (
          <g><circle cx={px(live[0])} cy={py(live[1])} r={11} fill="#D9480F" opacity=".16" /><circle cx={px(live[0])} cy={py(live[1])} r={5} fill="#D9480F" stroke="#fff" strokeWidth={2} /></g>
        )}
        {hover && (
          <g transform={`translate(${Math.min(px(hover[0]) + 10, W - 150)},${Math.max(py(hover[1]) - 42, 8)})`}>
            <rect width="138" height="28" rx="6" fill="#16233F" />
            <text x="10" y="18" className="g-tip">{fmt(hover[0], 3)} , {fmt(hover[1], 3)}</text>
          </g>
        )}
      </svg>
      {empty && <div className="graph-empty">Record a reading to start the plot</div>}
    </div>
  )
})
