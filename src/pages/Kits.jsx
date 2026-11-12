import { useMemo, useState } from 'react'
import { Link } from '../lib/router'
import { DOMAINS, KITS, LEVELS, TOTAL_EXPERIMENTS, kitPath, thumb } from '../data/catalog'
import { Icon } from '../components/Icon'

function KitCard({ kit }) {
  const n = kit.experiments.length
  return (
    <Link to={kitPath(kit)} className="kit-card">
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

const FilterBtn = ({ on, onClick, label, n }) => (
  <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={onClick}><span>{label}</span><small>{n}</small></button>
)

export default function Kits() {
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
      <section className="kits-head">
        <div className="wrap kits-head-in">
          <div>
            <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>Kit Simulation</b></nav>
            <h1>Kit Simulation</h1>
            <p className="lede">Choose a kit to see its experiments and specification, then open an experiment to operate the kit in 3D.</p>
          </div>
          <dl className="stats">
            <div><dt>{KITS.length}</dt><dd>Kits</dd></div>
            <div><dt>{TOTAL_EXPERIMENTS}</dt><dd>Experiments</dd></div>
            <div><dt>{DOMAINS.length}</dt><dd>Disciplines</dd></div>
          </dl>
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
