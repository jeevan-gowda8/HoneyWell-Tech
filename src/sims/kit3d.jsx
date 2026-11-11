import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createStudio, face, quant } from './studio3d'

/* Shared parts for the 3D kits: scene set-up, instrument units, knobs, sockets, pointer handling
   and the React stage that hosts a scene. Metres. */

export { THREE, face, quant }
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
export const rad = (d) => (d * Math.PI) / 180
export const TAU = Math.PI * 2

const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] }
const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '-': 'g', ' ': '' }
export function drawSeg(g, w, h, text, unit = '') {
  g.fillStyle = '#250606'; g.fillRect(0, 0, w, h)
  if (unit) { g.fillStyle = '#FF6B5E'; g.font = `bold ${h * 0.2}px Arial`; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillText(unit, w - h * 0.1, h * 0.88) }
  if (text === null) return
  const s = h * 0.3, step = s * 1.75, n = text.replace('.', '').length, top = h * 0.18
  let x = w - h * (unit ? 0.62 : 0.14) - n * step + step - s
  g.lineCap = 'round'; g.lineWidth = s * 0.2
  ;[...text].forEach((ch) => {
    if (ch === '.') { g.fillStyle = '#FF3B30'; g.beginPath(); g.arc(x - s * 0.42, top + s * 2, s * 0.13, 0, 7); g.fill(); return }
    Object.entries(SEG).forEach(([k, p]) => { g.strokeStyle = (DIG[ch] ?? '').includes(k) ? '#FF3B30' : '#3A0E0E'; g.beginPath(); g.moveTo(x + p[0] * s, top + p[1] * s); g.lineTo(x + p[2] * s, top + p[3] * s); g.stroke() })
    x += step
  })
}
export const silk = (text, size, col) => (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `bold ${size}px Arial`; const room = (w * 0.96) / Math.max(1, g.measureText(text).width); g.font = `bold ${Math.min(size, size * room)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2) }
export const glowDot = (g, w) => { const q = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.4, 'rgba(255,255,255,.45)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.clearRect(0, 0, w, w); g.fillStyle = q; g.fillRect(0, 0, w, w) }

function drawWood(g, w, h, base, tint) { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${i % 2 ? tint[0] : tint[1]},${0.08 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const y = (i * 37) % h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 12, w, y + 5); g.stroke() } }

export function kitScene(host, opts) {
  const { background = 0xdfe3e7, exposure = 1, env = 0.6, shadow = { left: -1.3, right: 1.3, top: 1.2, bottom: -1.1, far: 7 }, floor = {}, views, zoom = [0.14, 3.4], azimuth = 1.3 } = opts
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background, exposure, env, shadow })
  const stdM = (color, roughness = 0.45, metalness = 0.25) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const M = { black: stdM(0x17181c, 0.42), dark: stdM(0x2a2e35, 0.5, 0.35), chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }), brass: new THREE.MeshStandardMaterial({ color: 0xd9ad52, metalness: 0.85, roughness: 0.32 }), steel: new THREE.MeshStandardMaterial({ color: 0xbfc4cc, metalness: 0.85, roughness: 0.36 }), glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0f7, transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), hit: new THREE.MeshBasicMaterial({ visible: false }) }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 28) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const plain = (m) => { m.castShadow = false; return m }
  const hit = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const tubeG = (pts, r = 0.0036, n = 90) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, 8)
  const tube = (pts, col, r = 0.0036) => add(tubeG(pts, r), typeof col === 'number' ? stdM(col, 0.55, 0) : col, 0, 0, 0)
  const label = (w, h, text, size, col, x, y, z, parent = scene, flat = false) => { const f = face(Math.round(w * 4000), Math.round(h * 4000), silk(text, size, col)); f.set(1); const m = plain(add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), x, y, z, parent)); if (flat) m.rotation.x = -Math.PI / 2; return m }

  if (floor.flat !== undefined) plain(add(box(5.4, 0.04, 3.2), stdM(floor.flat, 0.72, 0.05), 0, -0.02, 0))
  else {
    const w = face(1024, 512, (g, a, b) => drawWood(g, a, b, floor.base || '#A9794F', floor.tint || ['70,40,18', '205,160,115'])); w.set(1); w.tex.wrapS = w.tex.wrapT = THREE.RepeatWrapping; w.tex.repeat.set(2, 1)
    plain(add(box(5.4, 0.04, 3.2), new THREE.MeshStandardMaterial({ map: w.tex, roughness: 0.62 }), 0, -0.02, 0))
  }
  plain(add(new THREE.PlaneGeometry(9, 3.4), stdM(floor.wall ?? background, 0.95, 0), 0, 1.4, -1.5))

  const draw = () => renderer.render(scene, camera)
  const applyView = (n) => { const w = views[n]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = zoom[0]; orbit.maxDistance = zoom[1]; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -azimuth; orbit.maxAzimuthAngle = azimuth
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), el = renderer.domElement, hitP = V(0, 0, 0)
  const cast = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(scene.children, true) }
  const castTo = (e, plane) => { cast(e); return ray.ray.intersectPlane(plane, hitP) }

  /* an instrument box whose front panel is drawn in the coordinates of the reference picture */
  function unit({ x, z, ry = 0, w, h, d, body, lid, art, pw, x0 = 0, y0 = 0, W, H, artW = 2400, y = 0, slope }) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = ry; scene.add(group)
    if (slope === undefined) add(box(w, h, d), typeof body === 'number' ? stdM(body, 0.45, 0.25) : body, 0, h / 2, 0, group)
    if (lid !== undefined) add(box(w * 0.94, 0.008, d * 0.88), stdM(lid, 0.45, 0.25), 0, h + 0.004, 0, group)
    const panel = new THREE.Group(); if (slope === undefined) panel.position.set(0, h / 2, d / 2 + 0.0008); else { panel.rotation.x = -slope; panel.translateZ(0.001) } group.add(panel)
    const ph = (pw * H) / W, K = pw / W
    const f = face(artW, Math.round((artW * H) / W), art); f.set(1); f.tex.anisotropy = 12
    panel.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.85 })))
    const P = (a, b) => [((a - x0) / W - 0.5) * pw, (0.5 - (b - y0) / H) * ph]
    const world = (a, b, zz = 0.008) => { scene.updateMatrixWorld(true); return panel.localToWorld(V(...P(a, b), zz)) }
    const disp = (a, b, dw, dh, paint, cw = 640) => { const fd = face(cw, Math.round((cw * dh) / dw), paint), [u, v] = P(a + dw / 2, b + dh / 2), m = new THREE.Mesh(new THREE.PlaneGeometry(dw * K, dh * K), new THREE.MeshBasicMaterial({ map: fd.tex, toneMapped: false })); m.position.set(u, v, 0.0006); panel.add(m); return fd }
    const knob = (a, b, name, r = 0.018) => { const [u, v] = P(a, b), g = new THREE.Group(); g.position.set(u, v, 0); panel.add(g); alongZ(add(cyl(r * 1.26, 0.002, 32), M.chrome, 0, 0, 0.001, g)); alongZ(add(cyl(r, 0.016, 30), M.black, 0, 0, 0.009, g)); add(box(0.0024, r * 0.82, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.55, 0.0175, g); if (name) alongZ(hit(cyl(r * 1.7, 0.04, 12), 0, 0, 0.012, name, g)); return g }
    const sock = (a, b, c, name, r = 0.0105) => { const [u, v] = P(a, b); alongZ(add(cyl(r, 0.004, 22), M.chrome, u, v, 0.002, panel)); alongZ(add(cyl(r * 0.68, 0.006, 18), stdM(c, 0.4), u, v, 0.004, panel)); if (name) hit(new THREE.SphereGeometry(r * 1.8, 10, 8), u, v, 0.012, name, panel); return world(a, b) }
    const rocker = (a, b, name) => { const [u, v] = P(a, b); add(box(0.034, 0.024, 0.003), M.black, u, v, 0.0015, panel); const m = add(box(0.016, 0.02, 0.005), stdM(0xd92b20, 0.35), u - 0.008, v, 0.004, panel); hit(box(0.06, 0.05, 0.03), u, v, 0.01, name, panel); return (on) => { m.position.x = u + (on ? -0.008 : 0.008) } }
    const led = (a, b, r = 0.0048) => { const [u, v] = P(a, b), m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: 0x333333, toneMapped: false })); m.position.set(u, v, 0.001); panel.add(m); return m }
    const key = (a, b, kw, kh, text, col, id, fg = '#FFF') => {
      const [u, v] = P(a, b), g = new THREE.Group(); g.position.set(u, v, 0); panel.add(g)
      const mat = stdM(col, 0.45, 0.15); add(box(kw * K, kh * K, 0.006), mat, 0, 0, 0.003, g)
      const fk = face(Math.round(kw * 5), Math.round(kh * 5), (c, cw, ch) => { c.clearRect(0, 0, cw, ch); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `bold ${Math.min(ch * 0.46, (cw * 0.88) / (text.length * 0.62))}px Arial`; c.fillText(text, cw / 2, ch / 2) }); fk.set(1)
      plain(add(new THREE.PlaneGeometry(kw * K, kh * K), new THREE.MeshBasicMaterial({ map: fk.tex, transparent: true }), 0, 0, 0.0065, g))
      hit(box(kw * K, kh * K * 1.1, 0.02), 0, 0, 0.01, id, g); return { g, mat }
    }
    return { group, panel, P, world, disp, knob, sock, rocker, led, key, K }
  }

  /* pointer: grab(d, e) returns a drag description, or nothing for a click */
  let listeners = null
  function listen({ grab, drag, up, cursor = () => 'pointer', ignore = () => false }) {
    const pick = (e) => cast(e).find((h) => h.object.userData.d && !ignore(h.object.userData.d))
    let s = null
    const onDown = (e) => { const d = pick(e)?.object.userData.d; if (!d) return; orbit.enabled = false; el.setPointerCapture(e.pointerId); s = grab(d, e) || { none: true }; s.x = e.clientX; s.y = e.clientY; s.d = s.d ?? d }
    const onMove = (e) => { if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = d ? cursor(d) : 'move'; return } if (s.none) return; const mv = ((e.clientX - s.x) - (e.clientY - s.y)) * (e.shiftKey ? 0.1 : 1); if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 4) s.moved = true; drag?.(s, e, mv) }
    const onUp = (e) => { if (s) up?.(s, e); s = null; orbit.enabled = true }
    const cap = { capture: true }
    el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)
    listeners = () => { el.removeEventListener('pointerdown', onDown, cap); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp) }
  }
  const dispose = () => {
    ro.disconnect(); orbit.dispose(); listeners?.()
    scene.traverse((q) => { q.geometry?.dispose(); const m = q.material; if (m) { m.map?.dispose(); m.dispose() } })
    release(); renderer.dispose(); el.remove()
  }
  /* wraps a scene's update so local changes can repaint straight away */
  let last = null
  const loop = (fn) => { const run = (...a) => { last = a; fn(...a); draw() }; run.redo = () => { if (last) run(...last) }; return run }
  const finish = (update, first = 'whole') => { applyView(first); size(); return { update, dispose, applyView } }
  return { renderer, scene, camera, orbit, stdM, M, add, cyl, box, alongX, alongZ, plain, hit, V, tubeG, tube, label, draw, unit, listen, castTo, cast, loop, finish, el }
}

export function stage3D(exp, build, { labels, hint, overlay }) {
  const Flat = exp.Stage
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({}), tr = useRef(null)
    const [failed, setFailed] = useState(false), [cur, setCur] = useState(labels[0][0])
    api.current.set = set
    useEffect(() => {
      try { sim.current = build(host.current, { set: (k, x) => api.current.set(k, x) }) } catch (err) { console.error(err); setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => { sim.current?.update(v, o, t, tr.current) })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{labels.map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => { sim.current?.applyView(k); setCur(k) }}>{l}</button>)}</div>
          {overlay && <div className={`trace-view xy ${overlay.cls || ''}${cur === labels[0][0] ? '' : ' small'}`}><canvas ref={tr} width={overlay.w} height={overlay.h} aria-label={overlay.alt} role="img" /><span>{overlay.caption}</span></div>}
        </div>
        <p className="stage3d-hint">{hint}</p>
      </div>
    )
  }
}
