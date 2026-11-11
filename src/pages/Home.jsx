import { useMemo, useState } from 'react'
import { Link } from '../lib/router'
import { DOMAINS, KITS, LEVELS, TOTAL_EXPERIMENTS, thumb } from '../data/catalog'
import { Icon } from '../components/Icon'

function KitCard({ kit }) {
  const n = kit.experiments.length
  return (
    <Link to={`/kit/${kit.id}`} className="kit-card">
      <div className="kit-art"><img src={thumb(kit, kit.experiments[0])} alt="" loading="lazy" decoding="async" width="560" height="350" /></div>
      <div className="kit-body">
        <div className="kit-meta"><span className="code">{kit.code}</span><span className="dom">{kit.domain}</span></div>
        <h3>{kit.name}</h3>
        <p>{kit.blurb}</p>
        <div className="kit-foot"><span>{n} {n === 1 ? 'experiment' : 'experiments'}</span><Icon n="arrow" s={17} /></div>
      </div>
    </Link>
  )
}

const wave = (n, amp, cyc, w = 1200, h = 220) => { let d = ''; for (let i = 0; i <= n; i++) { const x = (i / n) * w, y = h / 2 - amp * Math.sin((i / n) * cyc * Math.PI * 2) * (0.8 + 0.2 * Math.cos((i / n) * Math.PI * 2 * 2)); d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}` } return d }
const W1 = wave(400, 70, 12), W2 = wave(400, 34, 6)
function HeroViz() {
  return (
    <div className="hero-viz" aria-hidden="true">
      <div className="hv-orbit" />
      <div className="hv-scope">
        <div className="hv-top"><i />LIVE SIMULATION · 3D KIT<b>CH1</b></div>
        <div className="hv-screen">
          <svg viewBox="0 0 600 220" preserveAspectRatio="none">
            {Array.from({ length: 11 }, (_, i) => <line key={'v' + i} x1={i * 60} x2={i * 60} y1="0" y2="220" stroke="#1d3c31" strokeWidth={i === 5 ? 1.6 : 1} />)}
            {Array.from({ length: 5 }, (_, i) => <line key={'h' + i} x1="0" x2="600" y1={i * 55} y2={i * 55} stroke="#1d3c31" strokeWidth={i === 2 ? 1.6 : 1} />)}
            <g className="hv-wave2"><path d={W2} fill="none" stroke="#ffc14d" strokeWidth="2.4" /></g>
            <g className="hv-wave"><path d={W1} fill="none" stroke="#62e6c2" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 4px #62e6c2)' }} /></g>
          </svg>
        </div>
        <div className="hv-knobs"><span /><span /><span /><em>1.4550 MHz</em></div>
      </div>
      <div className="hv-chip a"><span>Brewster angle</span><b>56.5°</b><small>0.3% off expected</small></div>
      <div className="hv-chip b"><span>Electron charge</span><b>1.602 × 10<sup>−19</sup> C</b><small>0.0% off expected</small></div>
      <div className="hv-chip c"><span>Sodium D line</span><b>λ 589.3 nm</b><small>Within 0.1%</small></div>
    </div>
  )
}

const FilterBtn = ({ on, onClick, label, n }) => (
  <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={onClick}><span>{label}</span><small>{n}</small></button>
)

export default function Home() {
  const [q, setQ] = useState('')
  const [dom, setDom] = useState('All')
  const [level, setLevel] = useState('All')
  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return KITS.filter((k) => (dom === 'All' || k.domain === dom) && (level === 'All' || k.level === level) &&
      (!n || `${k.name} ${k.code} ${k.domain} ${k.specTitle} ${k.experiments.map((e) => e.title).join(' ')}`.toLowerCase().includes(n)))
  }, [q, dom, level])
  const count = (key, val) => KITS.filter((k) => k[key] === val).length
  const clear = () => { setQ(''); setDom('All'); setLevel('All') }
  return (
    <main>
      <section className="hero">
        <svg className="hero-mark" viewBox="0 0 211 226" aria-hidden="true"><path d="M0,0H71V78H140V0H211V106H0Z M0,133H71V226H0Z M140,133H211V226H140Z" /></svg>
        <div className="wrap hero-in">
          <div>
            <p className="eyebrow">Honeywell Technologies Virtual Laboratory</p>
            <h1>Laboratory kits you can operate in the browser</h1>
            <p className="lede">Wire circuits, adjust instruments and record readings on working simulations of each kit, then compare your result with the expected value.</p>
            <a className="cta" href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('kits').scrollIntoView({ behavior: 'smooth' }) }}>Browse kits<Icon n="arrow" s={17} /></a>
            <dl className="stats">
              <div><dt>{KITS.length}</dt><dd>Kits</dd></div>
              <div><dt>{TOTAL_EXPERIMENTS}</dt><dd>Experiments</dd></div>
              <div><dt>{DOMAINS.length}</dt><dd>Disciplines</dd></div>
            </dl>
          </div>
          <HeroViz />
        </div>
      </section>

      <section className="catalog wrap" id="kits">
        <aside className="side" aria-label="Filter kits">
          <h2>Discipline</h2>
          <div className="side-list">
            <FilterBtn on={dom === 'All'} onClick={() => setDom('All')} label="All disciplines" n={KITS.length} />
            {DOMAINS.map((d) => <FilterBtn key={d} on={dom === d} onClick={() => setDom(d)} label={d} n={count('domain', d)} />)}
          </div>
          <h2>Level</h2>
          <div className="side-list">
            <FilterBtn on={level === 'All'} onClick={() => setLevel('All')} label="All levels" n={KITS.length} />
            {LEVELS.map((l) => <FilterBtn key={l} on={level === l} onClick={() => setLevel(l)} label={l} n={count('level', l)} />)}
          </div>
        </aside>
        <div className="results">
          <div className="results-bar">
            <label className="search">
              <Icon n="search" s={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search kits, codes or experiments" aria-label="Search kits" />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><Icon n="close" s={15} /></button>}
            </label>
            <span className="result-count" role="status">{list.length} of {KITS.length} kits</span>
          </div>
          {list.length === 0 ? (
            <div className="none">No kits match that search. <button type="button" onClick={clear}>Clear the filters</button></div>
          ) : (
            <div className="kit-grid">{list.map((k) => <KitCard key={k.id} kit={k} />)}</div>
          )}
        </div>
      </section>
    </main>
  )
}
