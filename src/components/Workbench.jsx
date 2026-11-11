import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Graph } from './Graph'
import { fmt } from '../lib/math'
import { Icon } from './Icon'
import Micro from './Micro'
import { Rich } from './Rich'

export const initial = (exp) => ({ ...Object.fromEntries(exp.controls.filter((c) => c.type !== 'action').map((c) => [c.k, c.init])), ...(exp.state ? exp.state() : {}) })

/** True while the element is on screen, so hidden simulations do no work. */
export function useOnScreen() {
  const ref = useRef(null)
  const [seen, setSeen] = useState(true)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting))
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return [ref, seen]
}

/** Clock in simulated seconds, redrawn at 30 frames a second. */
export function useClock(active, speed = 1) {
  const [t, setT] = useState(0)
  const r = useRef({ t: 0, last: 0 })
  useEffect(() => {
    if (!active) return undefined
    let id
    r.current.last = performance.now()
    const loop = (now) => {
      id = requestAnimationFrame(loop)
      if (now - r.current.last < 30) return
      r.current.t += Math.min(0.05, (now - r.current.last) / 1000) * speed
      r.current.last = now
      setT(r.current.t)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active, speed])
  return [t, r]
}

/* Everything that must move every frame lives here so the rest of the page stays still. */
function Live({ exp, v, set, running, speed, clockRef, seed }) {
  const [box, seen] = useOnScreen()
  const [t, r] = useClock(running && seen, speed)
  useEffect(() => { clockRef.current = r.current }, [clockRef, r])
  useEffect(() => { r.current.t = 0 }, [seed, r])
  const time = running ? t : r.current.t
  const o = exp.out(v, time)
  const reads = exp.read ? exp.read(v, o) : []
  const Stage = exp.Stage
  return (
    <>
      <div ref={box} className={'stage' + (running ? '' : ' paused')}><Stage v={v} o={o} t={time} set={set} /></div>
      {reads.length > 0 && (
        <div className="reads">
          {reads.map(([label, val, unit]) => (
            <div className="read" key={label}>
              <span><Rich s={label} /></span>
              <b>{val}{unit && <small> {unit}</small>}</b>
            </div>
          ))}
        </div>
      )}
      {exp.micro && <Micro cfg={exp.micro(v, o, time)} running={running} speed={speed} />}
    </>
  )
}

const Field = memo(function Field({ c, value, set }) {
  if (c.type === 'action') return <button type="button" className="ctl-action" onClick={() => c.run(set)}>{c.label}</button>
  if (c.type === 'toggle')
    return (
      <button type="button" className={'ctl-toggle' + (value ? ' on' : '')} aria-pressed={!!value} onClick={() => set(c.k, !value)}>
        <span><Rich s={c.label} /></span><i />
      </button>
    )
  if (c.type === 'select' && c.options.length === 1) return null
  if (c.type === 'select')
    return (
      <div className="ctl">
        <label><span><Rich s={c.label} /></span></label>
        {c.options.length <= 4 && c.options.every((o) => String(o[1]).length < 11) ? (
          <div className="seg" role="group" aria-label={c.label}>
            {c.options.map(([val, l]) => (
              <button type="button" key={val} className={val === value ? 'on' : ''} onClick={() => set(c.k, val)}>{l}</button>
            ))}
          </div>
        ) : (
          <select value={value} onChange={(e) => {
            const raw = c.options.find((o) => String(o[0]) === e.target.value)
            set(c.k, raw[0])
          }}>
            {c.options.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
          </select>
        )}
      </div>
    )
  const pct = ((c.log ? Math.log(value / c.min) / Math.log(c.max / c.min) : (value - c.min) / (c.max - c.min)) * 100).toFixed(1)
  const onRange = (e) => {
    const u = +e.target.value
    set(c.k, c.log ? +(c.min * Math.pow(c.max / c.min, u)).toPrecision(4) : u)
  }
  const dig = c.step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(c.step)))
  return (
    <div className="ctl">
      <label htmlFor={c.k}><span><Rich s={c.label} /></span><output>{c.log ? +value.toPrecision(4) : (+value).toFixed(dig)}{c.unit && <small> {c.unit}</small>}</output></label>
      <input id={c.k} type="range" style={{ '--p': pct + '%' }}
        min={c.log ? 0 : c.min} max={c.log ? 1 : c.max} step={c.log ? 0.002 : c.step}
        value={c.log ? Math.log(value / c.min) / Math.log(c.max / c.min) : value} onChange={onRange} />
    </div>
  )
})

function Guide({ exp }) {
  const [done, setDone] = useState({})
  return (
    <div className="guide">
      <h3>Aim</h3>
      <p><Rich s={exp.aim} /></p>
      <h3>Principle</h3>
      {exp.formula && <div className="formula"><Rich s={exp.formula} /></div>}
      <p className="muted"><Rich s={exp.principle} /></p>
      <h3>Procedure</h3>
      <ol className="steps">
        {exp.steps.map((s, i) => (
          <li key={i} className={done[i] ? 'done' : ''}>
            <button type="button" aria-pressed={!!done[i]} onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}>
              <i>{done[i] ? <Icon n="check" s={13} /> : i + 1}</i><span><Rich s={s} /></span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Analysis({ exp, rows, v }) {
  if (!exp.analyse) return null
  const need = exp.need || 3
  const res = rows.length >= need ? exp.analyse(rows, v) : null
  return (
    <section className="card analysis">
      <header><h2>Result</h2></header>
      {!res ? (
        <div className="need">
          <div className="need-bar"><i style={{ width: `${(rows.length / need) * 100}%` }} /></div>
          <p>{rows.length} of {need} readings. {exp.needHint || 'Record more readings to calculate the result.'}</p>
        </div>
      ) : (
        <div className="res-grid">
          {res.map(([label, value, unit, ref]) => {
            const err = typeof ref === 'number' && typeof value === 'number' ? (Math.abs(value - ref) / Math.abs(ref)) * 100 : null
            return (
              <div className="res" key={label}>
                <span><Rich s={label} /></span>
                <b>{typeof value === 'number' ? fmt(value, value >= 100 ? 1 : 3) : value}{unit && <small> {unit}</small>}</b>
                {err !== null && <em className={err < 5 ? 'good' : err < 15 ? 'mid' : 'bad'}>
                  Expected {fmt(ref, ref >= 100 ? 1 : 3)} · {err.toFixed(1)}% off
                </em>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function Workbench({ exp }) {
  const [v, setV] = useState(() => initial(exp))
  const [rows, setRows] = useState([])
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [seed, setSeed] = useState(0)
  const [toast, setToast] = useState(null)
  const [sweeping, setSweeping] = useState(false)
  const clock = useRef({ t: 0 })
  const vRef = useRef(v)
  vRef.current = v
  const timer = useRef(null)

  useEffect(() => () => clearInterval(timer.current), [])

  const set = useCallback((k, val) => setV((s) => {
    const next = { ...s, [k]: val }
    vRef.current = next
    return next
  }), [])

  const flash = (m) => {
    setToast(m)
    setTimeout(() => setToast(null), 2600)
  }

  const takeReading = (values) => {
    const o = exp.out(values, clock.current.t)
    const row = exp.sample(values, o)
    if (!row) return false
    if (row.error) { flash(row.error); return false }
    setRows((r) => [...r, row].slice(-(exp.maxRows || 150)))
    return true
  }

  const sweepList = useMemo(() => {
    if (!exp.sweep) return null
    if (exp.sweep.list) return exp.sweep.list
    const c = exp.controls.find((x) => x.k === exp.sweep.k)
    const n = exp.sweep.n || 9
    const a = exp.sweep.from ?? c.min, b = exp.sweep.to ?? c.max
    return Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1)
      const raw = c.log ? a * Math.pow(b / a, u) : a + (b - a) * u
      return { [c.k]: c.log ? +raw.toPrecision(4) : Math.round(raw / c.step) * c.step }
    })
  }, [exp])

  const autoCollect = () => {
    if (sweeping) { clearInterval(timer.current); setSweeping(false); return }
    let i = 0
    const list = typeof sweepList === 'function' ? sweepList(vRef.current) : sweepList
    if (!list.length) { flash('The circuit is not complete. Check the patch cords.'); return }
    setRows([])
    setSweeping(true)
    const tick = Math.max(26, Math.min(170, 2400 / list.length))
    timer.current = setInterval(() => {
      if (i >= list.length) { clearInterval(timer.current); setSweeping(false); return }
      const next = { ...vRef.current, ...list[i] }
      vRef.current = next
      setV(next)
      takeReading(next)
      i++
    }, tick)
  }

  const resetAll = () => {
    clearInterval(timer.current)
    setSweeping(false)
    setV(initial(exp))
    setRows([])
    setSeed((s) => s + 1)
  }

  const exportCsv = () => {
    const head = exp.columns.map((c) => c[1]).join(',')
    const body = rows.map((r) => exp.columns.map((c) => JSON.stringify(cell(r[c[0]], c[2]))).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([head + '\n' + body], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${exp.id}-readings.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = !!exp.columns
  return (
    <div className={'bench' + (exp.wide ? ' wide' : '')}>
      <aside className="card controls">
        <header><h2>Controls</h2><button type="button" className="ghost" onClick={resetAll}><Icon n="reset" s={14} />Reset</button></header>
        <div className="ctl-list">
          {exp.controls.map((c) => <Field key={c.k} c={c} value={v[c.k]} set={set} />)}
          {exp.controls.length === 0 && <p className="muted">Use the switches on the kit.</p>}
        </div>
        {exp.tip && <p className="tip"><Icon n="info" s={15} />{exp.tip}</p>}
        {hasData && (
          <div className="actions">
            <button type="button" className="primary" onClick={() => takeReading(vRef.current)}><Icon n="plus" s={16} />Record reading</button>
            {sweepList && <button type="button" className="secondary" onClick={autoCollect}>{sweeping ? 'Stop' : <><Icon n="bolt" s={15} />Auto-collect</>}</button>}
          </div>
        )}
      </aside>

      <section className="card stage-card">
        <div className="stage-tools">
          <button type="button" className="ghost" onClick={() => setRunning((x) => !x)}>
            <Icon n={running ? 'pause' : 'play'} s={14} />{running ? 'Pause' : 'Run'}
          </button>
          <div className="seg small" role="group" aria-label="Simulation speed">
            {[[0.25, '¼×'], [1, '1×'], [3, '3×']].map(([s, l]) => (
              <button type="button" key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{l}</button>
            ))}
          </div>
          <span className="live-tag"><i className={running ? 'pulse' : ''} />{running ? 'Live' : 'Paused'}</span>
        </div>
        <Live exp={exp} v={v} set={set} running={running} speed={speed} clockRef={clock} seed={seed} />
        {toast && <div className="toast" role="status">{toast}</div>}
      </section>

      <aside className="card guide-card"><Guide exp={exp} /></aside>

      {hasData && (
        <section className="card table-card">
          <header>
            <h2>Observations</h2>
            <div className="row-gap">
              <span className="count">{rows.length}</span>
              <button type="button" className="ghost" disabled={!rows.length} onClick={exportCsv}><Icon n="download" s={14} />CSV</button>
              <button type="button" className="ghost" disabled={!rows.length} onClick={() => setRows([])}>Clear</button>
            </div>
          </header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th>{exp.columns.map((c) => <th key={c[0]}><Rich s={c[1]} /></th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    {exp.columns.map((c) => <td key={c[0]}>{cell(r[c[0]], c[2])}</td>)}
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={exp.columns.length + 1} className="empty">No readings yet. Set the controls and press Record reading{sweepList ? ', or let Auto-collect run the series' : ''}.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {exp.graph && (
        <section className="card graph-card">
          <header><h2>{exp.graph.title || 'Graph'}</h2></header>
          <Graph cfg={exp.graph} rows={rows} v={v} />
        </section>
      )}

      <Analysis exp={exp} rows={rows} v={v} />
    </div>
  )
}

const cell = (x, d) => (typeof x === 'number' ? fmt(x, d ?? 3) : x)
