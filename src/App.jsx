import { useEffect } from 'react'
import { Link, usePath } from './lib/router'
import Home from './pages/Home'
import Kit from './pages/Kit'
import Experiment from './pages/Experiment'

function Page({ path }) {
  const [, root, kitId, expId] = path.split('/')
  if (root !== 'kit' || !kitId) return <Home />
  return expId ? <Experiment key={kitId} kitId={kitId} expId={expId} /> : <Kit key={kitId} kitId={kitId} />
}

export default function App() {
  const path = usePath()
  useEffect(() => { window.scrollTo(0, 0) }, [path])
  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <Link to="/" className="brand" aria-label="Honeywell Technologies home">
            <img src="./logo.png" alt="Honeywell Technologies" width="194" height="39" />
          </Link>
          <span className="top-note">Virtual Laboratory</span>
        </div>
      </header>
      <Page path={path} />
      <footer className="foot">
        <div className="wrap foot-in">
          <img src="./logo-white.png" alt="Honeywell Technologies" width="170" height="34" loading="lazy" />
          <p>Simulations are teaching models based on the kit specifications and standard physics. Readings include small simulated measurement scatter.</p>
        </div>
      </footer>
    </>
  )
}
