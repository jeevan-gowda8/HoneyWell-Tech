import { useEffect } from 'react'
import { Link, Navigate, pub, usePath } from './lib/router'
import { findKit, kitPath } from './data/catalog'
import Landing from './pages/Landing'
import Kits from './pages/Kits'
import Kit from './pages/Kit'
import Experiment from './pages/Experiment'

function Page({ path }) {
  const [, root, key, expId] = path.split('/')
  if (root === 'kit') { const k = key && findKit(key); return <Navigate to={k ? kitPath(k, expId) : '/kits'} /> }
  if (root !== 'kits') return root ? <Navigate to="/" /> : <Landing />
  if (!key) return <Kits />
  const kit = findKit(key)
  if (!kit) return <Navigate to="/kits" />
  if (key !== kit.slug) return <Navigate to={kitPath(kit, expId)} />
  return expId ? <Experiment key={kit.id} kitId={kit.id} expId={expId} /> : <Kit key={kit.id} kitId={kit.id} />
}

export default function App() {
  const path = usePath()
  const section = path.split('/')[1] || ''
  useEffect(() => { window.scrollTo(0, 0) }, [path])
  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <Link to="/" className="brand" aria-label="Honeywell Technologies home">
            <img src={pub("logo.png")} alt="Honeywell Technologies" width="194" height="39" />
          </Link>
          <span className="top-note">Virtual Laboratory</span>
          <nav className="top-nav" aria-label="Main">
            <Link to="/" className={section === '' ? 'on' : ''} aria-current={section === '' ? 'page' : undefined}>Home</Link>
            <Link to="/kits" className={section !== '' ? 'on' : ''} aria-current={section === 'kits' ? 'page' : undefined}>Kit Simulation</Link>
          </nav>
        </div>
      </header>
      <Page path={path} />
      <footer className="foot">
        <div className="wrap foot-in">
          <img src={pub("logo-white.png")} alt="Honeywell Technologies" width="170" height="34" loading="lazy" />
          <p>Simulations are teaching models based on the kit specifications and standard physics. Readings include small simulated measurement scatter.</p>
        </div>
      </footer>
    </>
  )
}
