import { Link, pub } from '../lib/router'
import { DOMAINS, KITS, TOTAL_EXPERIMENTS } from '../data/catalog'
import { Icon } from '../components/Icon'

/* The software's landing page. Every picture is a screenshot of the software itself. */

const FEATURES = [
  {
    k: '3D kits',
    h: 'Working 3D models of the real kits',
    p: 'Each kit is modelled on the trainer in the lab. Panels, sockets, knobs and switches sit where they do on the bench, so practice online carries straight over to the real equipment.',
    list: ['Drag to look around, or jump to a preset view', 'Turn knobs and trimmers, flip switches and press keys', 'Plug and pull patch cords between sockets'],
    shots: [[pub('land/stage.webp'), 'The AM modulation trainer board in 3D with patch cords and an oscilloscope trace', 1400, 787]],
  },
  {
    k: 'Live instruments',
    h: 'Instruments that respond as you work',
    p: 'Oscilloscopes, meters and spectrum displays update the moment a control changes. A controls column beside the kit gives precise sliders and buttons for the same settings.',
    list: ['Oscilloscope traces, meter readings and sideband spectra', 'Fine control with sliders, and a reset to the starting values', 'Pause the model or run it at ¼× or 3× speed'],
    shots: [[pub('land/lcr.webp'), 'The series and parallel LCR resonance kit with its meter and patched cords', 1400, 787], [pub('land/controls.webp'), 'The controls column with frequency, amplitude and waveform settings', 468, 999]],
    pair: 'side',
  },
  {
    k: 'Observations',
    h: 'Record readings and build the observation table',
    p: 'Press Record reading at each setting, as you would write it in the lab record, or let Auto-collect sweep the range for you. The table keeps every reading with its units.',
    list: ['Record one reading at a time, or Auto-collect a full set', 'Download the table as a CSV file for your report', 'Readings carry a small, realistic measurement scatter'],
    shots: [[pub('land/table.webp'), 'The observation table with nine recorded readings and a CSV button', 797, 707]],
  },
  {
    k: 'Analysis',
    h: 'A graph and a result checked against the expected value',
    p: 'Readings are plotted as they are recorded, with a best-fit line. The result card works out the final value and shows how far it is from the expected one.',
    list: ['Live graph with best-fit slope and R²', 'Calculated result with the percentage difference', 'Repeat with different settings and compare'],
    shots: [[pub('land/graph.webp'), 'Graph of modulation index against audio amplitude with a best-fit line', 1124, 707], [pub('land/result.webp'), 'Result card showing a slope of 0.997 against an expected 1.000', 1400, 187]],
    pair: 'stack',
  },
  {
    k: 'Theory',
    h: 'The theory sits beside the bench',
    p: 'Every experiment has its aim, principle, formula and procedure next to the kit. A particle view shows what happens inside the components, slowed down so you can watch it.',
    list: ['Aim, principle, formula and step-by-step procedure', 'Particle view of electrons, charge and fields', 'Hints on the kit tell you what to click or drag'],
    shots: [[pub('land/guide.webp'), 'The aim, principle, formula and procedure for series resonance', 1400, 363], [pub('land/micro.webp'), 'Particle view of a resistor, capacitor and inductor', 1400, 437]],
    pair: 'stack',
  },
]

const ALSO = [
  ['Fault finding', 'Communication trainers have switched faults to find by probing test points stage by stage.'],
  ['Full specification', 'Each kit page lists the complete specification and every experiment it supports.'],
  ['Nothing to install', 'Runs in a current browser on a laptop, tablet or phone, with no plug-ins or sign-in.'],
  ['UG, PG and equipment kits', 'Mechanics, optics, electrical, thermal, magnetism, modern physics, digital and communication.'],
]

const STEPS = [
  ['Open Kit Simulation', 'Browse the kits, or filter by discipline and level and search by name or code.'],
  ['Choose an experiment', 'A kit page lists its experiments and specification. Open one to load the kit.'],
  ['Operate the kit', 'Set the controls on the 3D kit or in the controls column, and watch the instruments.'],
  ['Record and analyse', 'Record readings, check the graph and result, and download the table.'],
]

function Shot({ s }) {
  const [src, alt, w, h] = s
  return <img src={src} alt={alt} width={w} height={h} loading="lazy" decoding="async" />
}

export default function Landing() {
  const toFeatures = (e) => { e.preventDefault(); document.getElementById('features').scrollIntoView({ behavior: 'smooth' }) }
  const count = (d) => KITS.filter((k) => k.domain === d).length
  return (
    <main className="lp">
      <section className="hero">
        <img className="hero-bg" src={pub('hero-lab.webp')} srcSet={`${pub('hero-lab-960.webp')} 960w, ${pub('hero-lab.webp')} 1376w`} sizes="100vw" alt="" width="1376" height="768" fetchPriority="high" />
        <div className="wrap hero-in">
          <div className="hero-copy">
            <p className="eyebrow">Honeywell Technologies · Virtual Laboratory</p>
            <h1>Laboratory kits you can operate in the browser</h1>
            <p className="lede">Wire circuits, adjust instruments and record readings on working 3D models of each kit, then compare your result with the expected value.</p>
            <div className="hero-actions">
              <Link to="/kits" className="cta">Kit Simulation<Icon n="arrow" s={17} /></Link>
              <a className="cta cta-alt" href="#features" onClick={toFeatures}>See the features</a>
            </div>
          </div>
          <dl className="stats">
            <div><dt>{KITS.length}</dt><dd>Kits</dd></div>
            <div><dt>{TOTAL_EXPERIMENTS}</dt><dd>Experiments</dd></div>
            <div><dt>{DOMAINS.length}</dt><dd>Disciplines</dd></div>
          </dl>
        </div>
      </section>

      <section className="wrap lp-intro" id="features">
        <p className="eyebrow">What the software does</p>
        <h2>Everything a lab session needs, on one page</h2>
        <p className="lede">Each experiment opens a workbench: the kit in 3D, its controls, the instruments, an observation table, a graph and the theory, laid out the way you work at a real bench.</p>
      </section>

      {FEATURES.map((f, i) => (
        <section key={f.k} className={`wrap lp-feat${i % 2 ? ' flip' : ''}`}>
          <div className="lp-text">
            <span className="lp-no">{String(i + 1).padStart(2, '0')} · {f.k}</span>
            <h3>{f.h}</h3>
            <p>{f.p}</p>
            <ul>{f.list.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className={`lp-shots${f.pair ? ` ${f.pair}` : ''}`}>
            {f.shots.map((s) => <figure key={s[0]} className="lp-shot"><Shot s={s} /></figure>)}
          </div>
        </section>
      ))}

      <section className="lp-band">
        <div className="wrap">
          <h2>Also in every kit</h2>
          <div className="lp-also">
            {ALSO.map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="wrap lp-how">
        <p className="eyebrow">How it works</p>
        <h2>From the kit list to a result in four steps</h2>
        <ol className="lp-steps">
          {STEPS.map(([t, d], i) => <li key={t}><span>{i + 1}</span><h3>{t}</h3><p>{d}</p></li>)}
        </ol>
      </section>

      <section className="wrap lp-domains">
        <h2>Disciplines</h2>
        <ul>{DOMAINS.map((d) => <li key={d}><Link to="/kits">{d}<small>{count(d)} {count(d) === 1 ? 'kit' : 'kits'}</small></Link></li>)}</ul>
      </section>

      <section className="lp-end">
        <div className="wrap lp-end-in">
          <div>
            <h2>Start with any kit</h2>
            <p>{KITS.length} kits and {TOTAL_EXPERIMENTS} experiments, ready to open.</p>
          </div>
          <Link to="/kits" className="cta">Kit Simulation<Icon n="arrow" s={17} /></Link>
        </div>
      </section>
    </main>
  )
}
