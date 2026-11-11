import { useEffect, useState } from 'react'
import { Link, Navigate } from '../lib/router'
import { findKit, thumb } from '../data/catalog'
import { Rich } from '../components/Rich'
import { Icon } from '../components/Icon'

function ExpCard({ kit, exp, i }) {
  return (
    <Link to={`/kit/${kit.id}/${exp.id}`} className="exp-card">
      <div className="exp-art"><img src={thumb(kit, exp)} alt="" loading="lazy" decoding="async" width="560" height="350" /></div>
      <div className="exp-body">
        <span className="exp-no">Experiment {i + 1}</span>
        <h3>{exp.title}</h3>
        <p><Rich s={exp.short} /></p>
        <span className="go">Open simulation <Icon n="arrow" s={15} /></span>
      </div>
    </Link>
  )
}

const Spec = ({ s }) => {
  const m = s.match(/^([^:]{2,44}):\s*(.+)$/)
  if (m) return <li className="kv"><span>{m[1]}</span><b>{m[2]}</b></li>
  return <li>{s}</li>
}

export default function Kit({ kitId }) {
  const kit = findKit(kitId)
  const [groups, setGroups] = useState(null)
  useEffect(() => {
    if (!kit) return undefined
    let live = true
    import('../data/specs.json').then((m) => { if (live) setGroups(m.default.find((s) => s.code === kit.code).groups) })
    return () => { live = false }
  }, [kit])
  if (!kit) return <Navigate to="/" />
  return (
    <main className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">All kits</Link><span>/</span><b>{kit.name}</b></nav>
      <header className="kit-head">
        <div>
          <div className="kit-meta"><span className="code">{kit.code}</span><span className="dom">{kit.domain} · {kit.level}</span></div>
          <h1>{kit.name}</h1>
          <p className="lede">{kit.blurb}</p>
          <p className="fulltitle">{kit.specTitle}</p>
        </div>
        <div className="kit-head-art"><img src={thumb(kit, kit.experiments[0])} alt={`${kit.name} kit`} width="560" height="350" /></div>
      </header>

      <section>
        <h2 className="sec">Experiments <small>{kit.experiments.length}</small></h2>
        <div className="exp-grid">{kit.experiments.map((e, i) => <ExpCard key={e.id} kit={kit} exp={e} i={i} />)}</div>
      </section>

      <section>
        <h2 className="sec">Specification</h2>
        {groups ? (
          <div className="spec-cols">
            {groups.map((g, i) => (
              <div className="spec" key={g.title + i}>
                <h3>{g.title}</h3>
                <ul>{g.items.map((s, j) => <Spec s={s} key={j} />)}</ul>
              </div>
            ))}
          </div>
        ) : <p className="loading">Loading specification…</p>}
      </section>
    </main>
  )
}
