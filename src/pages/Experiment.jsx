import { Component, lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate } from '../lib/router'
import { findKit } from '../data/catalog'
import { Icon } from '../components/Icon'

const Workbench = lazy(() => import('../components/Workbench'))
const loading = <p className="loading lab-loading">Loading simulation…</p>
const failure = (
  <div className="lab-loading lab-failed">
    <p>This simulation could not load.</p>
    <button type="button" className="cta-plain" onClick={() => window.location.reload()}>Reload the page</button>
  </div>
)

class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? failure : this.props.children }
}

export default function Experiment({ kitId, expId }) {
  const kit = findKit(kitId)
  const [list, setList] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!kit) return undefined
    let live = true
    import('../data/sims').then((m) => m.loadExperiments(kit.code)).then((l) => { if (live) setList(l) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [kit])
  if (!kit) return <Navigate to="/" />
  const idx = kit.experiments.findIndex((e) => e.id === expId)
  if (idx < 0) return <Navigate to={`/kit/${kit.id}`} />
  const meta = kit.experiments[idx]
  const exp = list?.[idx]
  const prev = kit.experiments[idx - 1], next = kit.experiments[idx + 1]
  return (
    <main className="wrap lab">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">All kits</Link><span>/</span><Link to={`/kit/${kit.id}`}>{kit.name}</Link><span>/</span><b>{meta.title}</b>
      </nav>
      <header className="lab-head">
        <div>
          <div className="kit-meta"><span className="code">{kit.code}</span><span className="dom">Experiment {idx + 1} of {kit.experiments.length}</span></div>
          <h1>{meta.title}</h1>
        </div>
        <div className="lab-nav">
          {prev && <Link className="nav-btn" to={`/kit/${kit.id}/${prev.id}`} aria-label={`Previous: ${prev.title}`}><Icon n="back" s={16} />Previous</Link>}
          {next && <Link className="nav-btn" to={`/kit/${kit.id}/${next.id}`} aria-label={`Next: ${next.title}`}>Next<Icon n="arrow" s={16} /></Link>}
        </div>
      </header>
      {kit.experiments.length > 1 && (
        <div className="exp-tabs">
          {kit.experiments.map((e, i) => (
            <Link key={e.id} to={`/kit/${kit.id}/${e.id}`} className={i === idx ? 'on' : ''} aria-current={i === idx ? 'page' : undefined}><b>{i + 1}</b>{e.title}</Link>
          ))}
        </div>
      )}
      {failed ? failure : (
        <Boundary>
          <Suspense fallback={loading}>
            {exp ? <Workbench key={exp.id} exp={exp} /> : loading}
          </Suspense>
        </Boundary>
      )}
    </main>
  )
}
