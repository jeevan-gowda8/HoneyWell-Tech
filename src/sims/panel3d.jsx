import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { THREE, kitScene } from './kit3d'

/* Patch-panel trainers in 3D: the live, wireable front panel sits in a real instrument case on
   the bench, so cords, knobs and switches keep working while the case can be viewed in 3D. */

const PX = 1100

function build(host, face, cfg) {
  const pw = cfg.pw, ph = (pw * cfg.vh) / cfg.vw, D = 0.16
  const front = { p: [0, 0.2 + ph * 0.52, ph * 1.75 + 0.42], t: [0, 0.2 + ph * 0.47, 0] }
  const views = { front, left: { p: [-0.62, 0.2 + ph * 0.55, ph * 1.28 + 0.3], t: front.t }, right: { p: [0.62, 0.2 + ph * 0.55, ph * 1.28 + 0.3], t: front.t }, close: { p: [0, 0.2 + ph * 0.5, ph * 0.95 + 0.2], t: front.t } }
  const K = kitScene(host, { background: 0xeceef1, floor: { base: '#B98A5C', wall: 0xeceef1 }, views, zoom: [0.3, 3], azimuth: 0.62 })
  const { add, box, cyl, alongX, M, stdM, scene, camera, orbit, renderer } = K
  orbit.minPolarAngle = 0.95; orbit.maxPolarAngle = 1.72
  const y0 = 0.2 + ph / 2
  /* stand and case */
  add(box(pw + 0.12, 0.04, D + 0.26), stdM(0x3a3f47, 0.5, 0.3), 0, 0.02, 0)
  add(box(pw + 0.06, ph + 0.06, D), stdM(cfg.body ?? 0x2b3038, 0.45, 0.35), 0, y0, -D / 2 + 0.002)
  add(box(pw + 0.08, 0.02, D + 0.02), stdM(0x1c1f24, 0.5, 0.3), 0, y0 + ph / 2 + 0.035, -D / 2)
  ;[-1, 1].forEach((s) => {
    add(box(0.03, ph * 0.6, 0.03), M.black, s * (pw / 2 + 0.05), y0, -0.02)
    add(new THREE.TorusGeometry(0.05, 0.009, 10, 24, Math.PI), M.chrome, s * (pw / 2 + 0.06), y0 + ph / 2 + 0.04, -D / 2).rotation.y = Math.PI / 2
    add(box(0.05, 0.16, 0.12), stdM(0x3a3f47, 0.5, 0.3), s * (pw / 2 - 0.02), 0.12, 0.02).rotation.x = -0.35
  })
  ;[[-0.3, 0.18], [0.3, 0.18]].forEach(([x, z]) => alongX(add(cyl(0.007, 0.16, 14), M.chrome, x, 0.05, z)))
  /* a tray of spare patch cords in front */
  const cols = [0xd42b24, 0x15161a, 0xe8c53a, 0x1f62c4, 0x2e9e43]
  cols.forEach((c, i) => K.tube([new THREE.Vector3(-0.3 + i * 0.13, 0.042, 0.17), new THREE.Vector3(-0.27 + i * 0.13, 0.06, 0.22), new THREE.Vector3(-0.22 + i * 0.13, 0.042, 0.27)], c, 0.004))
  /* CSS layer for the live panel */
  const css = new CSS3DRenderer(); css.domElement.className = 'panel3d-layer'; host.appendChild(css.domElement)
  const cssScene = new THREE.Scene()
  face.style.width = `${PX}px`
  const obj = new CSS3DObject(face); obj.position.set(0, y0, 0.0035); obj.scale.setScalar(pw / PX); cssScene.add(obj)
  const draw = () => { renderer.render(scene, camera); css.render(cssScene, camera) }
  orbit.addEventListener('change', draw)
  const resize = () => { css.setSize(host.clientWidth, host.clientHeight); draw() }
  const ro = new ResizeObserver(resize); ro.observe(host)
  K.listen({ grab: () => undefined })
  const api = K.finish(() => draw(), 'front')
  const applyView = (n) => { api.applyView(n); draw() }
  return { update: draw, applyView, dispose: () => { ro.disconnect(); css.domElement.remove(); api.dispose() } }
}

const LABELS = [['front', 'Front'], ['left', 'Left'], ['right', 'Right'], ['close', 'Close up']]
export function panel3D(exp, cfg) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null)
    const [face] = useState(() => { const d = document.createElement('div'); d.className = 'panel3d-face'; return d })
    const [failed, setFailed] = useState(false)
    useEffect(() => {
      try { sim.current = build(host.current, face, cfg) } catch (err) { console.error(err); setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [face])
    useEffect(() => { sim.current?.update() })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{LABELS.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
        </div>
        {createPortal(<Flat v={v} o={o} t={t} set={set} />, face)}
        <p className="stage3d-hint">{cfg.hint} Drag the bench or wall to turn the view, or use the view buttons.</p>
      </div>
    )
  }
}
