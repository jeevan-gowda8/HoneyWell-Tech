import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { michelsonNa, michelsonGlass } from './optics'
import { createStudio, face, quant } from './studio3d'

/* The Michelson interferometer as a working 3D model on a lab jack. Metres. Light runs along +x
   from the lamp to M2; the beam splitter sends the other arm along -z to M1 and returns it along
   +z to the telescope. */

const TOP = 0.12, HB = 0.195 // platform surface and beam height
const LAMP_X = -0.214, M2_X = 0.135, M1_Z = -0.085, SCOPE_Z = 0.045
const FIELD = 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const TAU = Math.PI * 2
const TILT_OK = 0.12

/* What is seen through the telescope. */
function paintFringes(cv, d, doublet, tx, ty, lamp) {
  const g = cv.getContext('2d'), im = g.createImageData(FIELD, FIELD)
  for (let j = 0; j < FIELD; j++) for (let i = 0; i < FIELD; i++) {
    const u = (i + 0.5) / FIELD - 0.5, w = (j + 0.5) / FIELD - 0.5
    const off = 40 * tx * u + 40 * ty * w - 30 * (u * u + w * w)
    const ph = (l) => TAU * ((2 * d * 1000) / l + off)
    const I = !lamp ? 0 : doublet ? 0.5 + 0.25 * (Math.cos(ph(589.0)) + Math.cos(ph(589.6))) : 0.5 + 0.48 * Math.cos(ph(589.3))
    const p = (j * FIELD + i) * 4
    im.data[p] = 255 * I; im.data[p + 1] = 196 * I; im.data[p + 2] = 40 * I; im.data[p + 3] = 255
  }
  g.putImageData(im, 0, 0)
}

function drawDrum(g, w) {
  const c = w / 2
  g.fillStyle = '#D6DAE0'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill()
  g.strokeStyle = '#26282D'; g.fillStyle = '#26282D'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 26px Arial'
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * TAU, big = i % 10 === 0
    g.lineWidth = big ? 3.5 : 1.4
    const q = c * (big ? 0.86 : 0.92)
    g.beginPath(); g.moveTo(c + c * 0.985 * Math.cos(a), c + c * 0.985 * Math.sin(a)); g.lineTo(c + q * Math.cos(a), c + q * Math.sin(a)); g.stroke()
    if (big) g.fillText(String(i), c + c * 0.76 * Math.cos(a), c + c * 0.76 * Math.sin(a))
  }
}
function drawLampLabel(g, w, h) {
  g.clearRect(0, 0, w, h)
  g.fillStyle = '#FFC95C'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Na LAMP', w / 2, h / 2)
}

const VIEWS = {
  whole: { p: [-0.26, 0.66, 0.86], t: [-0.02, 0.14, 0] },
  sheet: { p: [0.14, 0.36, 0.3], t: [0, 0.18, -0.05] },
  optics: { p: [-0.06, 0.42, 0.4], t: [0.02, 0.19, -0.01] },
  drive: { p: [0.16, 0.34, 0.26], t: [0.08, 0.2, -0.1] },
  fine: { p: [0.34, 0.32, 0.24], t: [0.24, 0.215, -0.06] },
  scope: { p: [-0.2, 0.3, 0.42], t: [0, 0.195, 0.09] },
}

function createScene(host, ctl, api, glass) {
  const { renderer, scene, camera, orbit, release } = createStudio(host, { background: 0xeceef1, exposure: 1, env: 0.6, shadow: { left: -0.7, right: 0.7, top: 0.7, bottom: -0.7, far: 6 } })
  const M = {
    table: new THREE.MeshStandardMaterial({ color: 0xc4c9d0, roughness: 0.74 }),
    deck: new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.5, metalness: 0.35 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.42, metalness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.18 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x35587c, roughness: 0.4, metalness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xb8e3f4, transparent: true, opacity: 0.5, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xe8f1f6, metalness: 1, roughness: 0.06 }),
    diffuser: new THREE.MeshStandardMaterial({ color: 0xf0f1ee, roughness: 0.9, side: THREE.DoubleSide }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  }
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  const cyl = (r, h, s = 32) => new THREE.CylinderGeometry(r, r, h, s)
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c)
  const alongX = (m) => { m.rotation.z = Math.PI / 2; return m }
  const alongZ = (m) => { m.rotation.x = Math.PI / 2; return m }
  const hitOf = (geo, x, y, z, d, parent = scene) => { const m = new THREE.Mesh(geo, M.hit); m.position.set(x, y, z); m.userData.d = d; parent.add(m); return m }
  const post = (x, z, top) => add(cyl(0.006, top - TOP, 18), M.chrome, x, (top + TOP) / 2, z)

  add(box(3.4, 0.04, 2.4), M.table, 0, -0.02, 0).castShadow = false
  add(new THREE.PlaneGeometry(6, 3), new THREE.MeshStandardMaterial({ color: 0xeceef1, roughness: 0.95 }), 0, 1.3, -1.1).castShadow = false

  /* lab jack */
  add(box(0.33, 0.016, 0.24), M.deck, 0.02, 0.008, 0)
  const bar = (x1, y1, x2, y2, z) => {
    const a = new THREE.Vector3(x1, y1, z), b = new THREE.Vector3(x2, y2, z), m = add(cyl(0.004, a.distanceTo(b), 12), M.chrome, (x1 + x2) / 2, (y1 + y2) / 2, z)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  }
  ;[0.1, -0.1].forEach((z) => { bar(-0.12, 0.018, 0.15, 0.088, z); bar(-0.12, 0.088, 0.15, 0.018, z) })
  alongX(add(cyl(0.0055, 0.34, 18), M.chrome, 0.015, 0.053, 0.125))
  add(new THREE.SphereGeometry(0.011, 20, 14), M.black, -0.16, 0.053, 0.125)

  /* platform */
  add(box(0.32, 0.03, 0.22), M.deck, 0, TOP - 0.015, 0)
  ;[[-0.145, -0.095], [0.145, -0.095], [-0.145, 0.095], [0.145, 0.095]].forEach(([x, z]) => add(cyl(0.009, 0.045, 18), M.black, x, TOP + 0.0225, z))

  /* sodium lamp */
  add(cyl(0.056, HB + 0.09, 48), M.lamp, -0.272, (HB + 0.09) / 2, -0.02)
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffc95c, toneMapped: false })
  add(box(0.004, 0.05, 0.03), windowMat, LAMP_X - 0.002, HB, 0).castShadow = false
  const glowFace = face(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,190,70,.75)'); r.addColorStop(0.35, 'rgba(255,170,50,.25)'); r.addColorStop(1, 'rgba(255,160,40,0)'); g.clearRect(0, 0, w, w); g.fillStyle = r; g.fillRect(0, 0, w, w) }); glowFace.set(1)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFace.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(0.16); glow.position.set(LAMP_X + 0.004, HB, 0.004); scene.add(glow)
  hitOf(cyl(0.062, HB + 0.1, 12), -0.272, (HB + 0.09) / 2, -0.02, 'lamp')
  const label = face(320, 80, drawLampLabel); label.set(1)
  const lab = add(new THREE.PlaneGeometry(0.08, 0.02), new THREE.MeshBasicMaterial({ map: label.tex, transparent: true }), -0.272, 0.09, 0.037); lab.castShadow = false

  /* beam expander and ground glass */
  post(-0.125, 0, HB)
  alongX(add(cyl(0.013, 0.05, 28), M.chrome, -0.125, HB, 0))
  alongX(add(cyl(0.008, 0.016, 20), M.black, -0.094, HB, 0))
  add(box(0.012, 0.03, 0.04), M.black, -0.075, TOP + 0.015, 0)
  add(box(0.002, 0.085, 0.06), M.diffuser, -0.075, HB - 0.003, 0).castShadow = false

  /* beam splitter and compensator, both at 45 degrees */
  const plate = (x) => {
    add(box(0.052, HB - TOP - 0.022, 0.03), M.black, x, (TOP + HB - 0.022) / 2, 0).rotation.y = Math.PI / 4
    add(box(0.05, 0.039, 0.007), M.glass, x, HB, 0).rotation.y = Math.PI / 4
  }
  plate(0); plate(0.06)

  /* fixed mirror M2 on a tilting mount */
  add(box(0.05, 0.016, 0.07), M.black, M2_X + 0.012, TOP + 0.008, 0)
  add(box(0.01, HB - TOP + 0.05, 0.07), M.black, M2_X + 0.012, (TOP + HB + 0.05) / 2, 0)
  const m2 = new THREE.Group(); m2.position.set(M2_X, HB, 0); scene.add(m2)
  alongX(add(cyl(0.015, 0.004, 40), M.mirror, 0, 0, 0, m2))
  const screws = {}
  ;[['tx', 0, 0.03], ['ty', 0.033, -0.015]].forEach(([k, dy, dz]) => {
    const g = new THREE.Group(); g.position.set(M2_X + 0.024, HB + dy, dz); scene.add(g)
    alongX(add(cyl(0.006, 0.022, 14), M.chrome, 0, 0, 0, g)); alongX(add(cyl(0.008, 0.008, 16), M.black, 0.012, 0, 0, g))
    hitOf(new THREE.SphereGeometry(0.018, 10, 8), 0.008, 0, 0, k, g)
    screws[k] = g
  })

  /* moving mirror M1, coarse drum at the back */
  add(box(0.1, 0.018, 0.05), M.black, 0.01, TOP + 0.009, M1_Z - 0.012)
  add(box(0.09, HB - TOP + 0.07, 0.01), M.black, 0, (TOP + HB + 0.07) / 2, M1_Z - 0.034)
  const carriage = new THREE.Group(); carriage.position.set(0, HB, M1_Z); scene.add(carriage)
  alongZ(add(cyl(0.015, 0.004, 40), M.mirror, 0, 0, 0, carriage))
  alongZ(add(cyl(0.018, 0.012, 32), M.black, 0, 0, -0.008, carriage))
  const drumFace = face(900, 900, drawDrum); drumFace.set(1)
  const drum = new THREE.Group(); drum.position.set(0.075, HB + 0.02, M1_Z - 0.03); scene.add(drum)
  alongZ(add(cyl(0.056, 0.01, 64), M.chrome, 0, 0, -0.005, drum))
  add(new THREE.CircleGeometry(0.0555, 64), new THREE.MeshStandardMaterial({ map: drumFace.tex, roughness: 0.45, metalness: 0.3 }), 0, 0, 0.0006, drum).castShadow = false
  alongZ(add(cyl(0.011, 0.016, 24), M.black, 0, 0, 0.008, drum))
  hitOf(new THREE.CircleGeometry(0.06, 20), 0, 0, 0.018, 'coarse', drum)
  add(new THREE.ConeGeometry(0.004, 0.009, 3), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 0.075, HB + 0.02 + 0.0615, M1_Z - 0.03).rotation.z = Math.PI

  /* fine micrometer */
  add(box(0.012, HB - TOP + 0.02, 0.05), M.black, 0.165, (TOP + HB + 0.04) / 2 - 0.0, -0.06)
  alongX(add(cyl(0.0095, 0.075, 28), M.chrome, 0.21, HB + 0.02, -0.06))
  const fine = new THREE.Group(); fine.position.set(0.268, HB + 0.02, -0.06); scene.add(fine)
  alongX(add(cyl(0.0135, 0.05, 32), M.black, 0, 0, 0, fine))
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; add(box(0.044, 0.0012, 0.0012), new THREE.MeshBasicMaterial({ color: i % 3 ? 0x8a8f98 : 0xffffff }), 0, Math.cos(a) * 0.0138, Math.sin(a) * 0.0138, fine) }
  alongX(hitOf(cyl(0.024, 0.07, 12), 0, 0, 0, 'fine', fine))

  /* thin glass sheet on a rotatable stage, in the M1 arm */
  const SZ = -0.044
  const sheet = new THREE.Group(); sheet.position.set(0, 0, SZ); scene.add(sheet)
  const rotor = new THREE.Group(); sheet.add(rotor)
  if (glass) {
    const dial = face(600, 600, (g, w) => { const c = w / 2; g.fillStyle = '#D9B24C'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill(); g.strokeStyle = '#21180A'; g.fillStyle = '#21180A'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let d = -60; d <= 60; d += 2) { const a = ((d - 90) * Math.PI) / 180, big = d % 10 === 0; g.lineWidth = big ? 5 : 2; g.beginPath(); g.moveTo(c + c * 0.97 * Math.cos(a), c + c * 0.97 * Math.sin(a)); g.lineTo(c + c * (big ? 0.84 : 0.91) * Math.cos(a), c + c * (big ? 0.84 : 0.91) * Math.sin(a)); g.stroke(); if (big && d % 20 === 0) g.fillText(String(Math.abs(d)), c + c * 0.7 * Math.cos(a), c + c * 0.7 * Math.sin(a)) } }); dial.set(1)
    add(cyl(0.022, 0.03, 28), M.black, 0, TOP + 0.015, 0, sheet)
    const disc = add(new THREE.CircleGeometry(0.03, 48), new THREE.MeshStandardMaterial({ map: dial.tex, roughness: 0.4, metalness: 0.4 }), 0, TOP + 0.0306, 0, sheet); disc.rotation.x = -Math.PI / 2; disc.castShadow = false
    add(cyl(0.005, HB - TOP - 0.05), M.chrome, 0, (TOP + HB + 0.002) / 2, 0, rotor)
    add(box(0.06, 0.006, 0.01), M.black, 0, HB - 0.034, 0, rotor)
    add(box(0.05, 0.064, 0.0025), M.glass, 0, HB, 0, rotor).castShadow = false
    add(new THREE.ConeGeometry(0.003, 0.008, 3), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 0, TOP + 0.032, 0.029, rotor).rotation.x = Math.PI / 2
    hitOf(box(0.07, 0.1, 0.05), 0, HB - 0.015, 0, 'sheet', rotor)
  }

  /* telescope */
  post(0, 0.085, HB)
  alongZ(add(cyl(0.0125, 0.09, 28), M.black, 0, HB, SCOPE_Z + 0.045))
  alongZ(add(cyl(0.014, 0.012, 28), M.chrome, 0, HB, SCOPE_Z + 0.002))
  alongZ(add(cyl(0.009, 0.03, 24), M.chrome, 0, HB, SCOPE_Z + 0.103))
  alongZ(add(cyl(0.0075, 0.002, 24), new THREE.MeshStandardMaterial({ color: 0x1c3a5a, roughness: 0.12, metalness: 0.5 }), 0, HB, SCOPE_Z + 0.119))

  /* light */
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff9f1a, transparent: true, opacity: 0.85, depthWrite: false })
  const makeBeam = () => { const m = new THREE.Mesh(cyl(0.0016, 1, 8), beamMat); scene.add(m); return m }
  const beams = [makeBeam(), makeBeam(), makeBeam(), makeBeam()]
  const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3()
  const setBeam = (m, a, b) => {
    const len = a.distanceTo(b)
    m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, len, 1)
    m.quaternion.setFromUnitVectors(UP, tmp.copy(b).sub(a).normalize())
  }
  const beadMat = new THREE.MeshBasicMaterial({ color: 0xfff0c2, transparent: true, opacity: 0.9, depthWrite: false })
  const beadGeo = new THREE.SphereGeometry(0.0024, 10, 8)
  const beads = Array.from({ length: 70 }, () => { const m = new THREE.Mesh(beadGeo, beadMat); m.visible = false; scene.add(m); return m })
  const P0 = new THREE.Vector3(LAMP_X, HB, 0), C = new THREE.Vector3(0, HB, 0), P2 = new THREE.Vector3(M2_X, HB, 0), P3 = new THREE.Vector3(0, HB, SCOPE_Z), P1 = new THREE.Vector3(0, HB, M1_Z)

  function draw() { renderer.render(scene, camera) }
  const applyView = (name) => { const w = VIEWS[name]; camera.position.set(...w.p); orbit.target.set(...w.t); orbit.update(); draw() }
  orbit.enablePan = false; orbit.minDistance = 0.14; orbit.maxDistance = 1.8; orbit.maxPolarAngle = Math.PI / 2 - 0.04; orbit.minAzimuthAngle = -1.4; orbit.maxAzimuthAngle = 1.4
  orbit.addEventListener('change', draw)
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw() }
  const ro = new ResizeObserver(size); ro.observe(host)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const el = renderer.domElement
  const pick = (e) => {
    const r = el.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.intersectObjects(scene.children, true).find((h) => h.object.userData.d)
  }
  const S = { v: null, drag: null }
  const onDown = (e) => {
    const d = pick(e)?.object.userData.d
    if (!d || (glass && (d === 'coarse' || d === 'fine'))) return
    orbit.enabled = false
    el.setPointerCapture(e.pointerId)
    if (d === 'lamp') { api.set('lamp', !S.v.lamp); S.drag = { none: true }; return }
    if (d === 'sheet') { S.drag = { d, x: e.clientX, y: e.clientY, val: S.v.ang, ins: S.v.ins }; return }
    S.drag = { d, x: e.clientX, y: e.clientY, val: d === 'coarse' || d === 'fine' ? S.v.d : S.v[d] }
  }
  const onMove = (e) => {
    const s = S.drag
    if (!s) { const d = pick(e)?.object.userData.d; el.style.cursor = !d ? 'move' : d === 'lamp' ? 'pointer' : 'grab'; return }
    if (s.none) return
    const mv = (e.clientX - s.x) - (e.clientY - s.y)
    if (s.d === 'sheet') { if (Math.abs(mv) > 3) s.moved = true; if (S.v.ins) api.set('ang', +clamp(s.val + mv * 0.12, -15, 15).toFixed(1)); return }
    const c = ctl.find((q) => q.k === 'd'), range = c ? c.max - c.min : 1
    if (s.d === 'coarse') api.set('d', quant(c, s.val + (mv / 300) * range))
    if (s.d === 'fine') api.set('d', quant(c, s.val + (mv / 3000) * range))
    if (s.d === 'tx' || s.d === 'ty') api.set(s.d, +clamp(s.val + mv / 200, -1, 1).toFixed(3))
  }
  const onUp = () => { const s = S.drag; if (s?.d === 'sheet' && !s.moved) api.set('ins', !S.v.ins); S.drag = null; orbit.enabled = true }
  const cap = { capture: true }
  el.addEventListener('pointerdown', onDown, cap); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp)

  const c0 = ctl.find((q) => q.k === 'd')
  function update(v, o, t) {
    S.v = v
    const u = c0 ? o.d / c0.max : 0
    if (glass) { sheet.position.x = v.ins ? 0 : 0.11; rotor.rotation.y = -((v.ang || 0) * Math.PI) / 180 }
    carriage.position.z = M1_Z - u * 0.012
    P1.z = carriage.position.z
    drum.rotation.z = -u * TAU * 3
    fine.rotation.x = u * TAU * 30
    m2.rotation.z = v.ty * 0.1; m2.rotation.y = v.tx * 0.1
    screws.tx.position.x = M2_X + 0.024 + v.tx * 0.004; screws.ty.position.x = M2_X + 0.024 + v.ty * 0.004
    windowMat.color.set(v.lamp ? 0xffc95c : 0x4a3a18); glow.visible = v.lamp
    const segs = v.lamp ? [[P0, C], [C, P2], [C, P1], [C, P3]] : []
    beams.forEach((b, i) => { b.visible = !!segs[i]; if (segs[i]) setBeam(b, segs[i][0], segs[i][1]) })
    let n = 0
    segs.forEach(([a, b]) => {
      const len = a.distanceTo(b), gap = 0.024
      for (let d = (t * 0.1) % gap; d < len && n < beads.length; d += gap) { const m = beads[n++]; m.visible = true; m.position.lerpVectors(a, b, d / len) }
    })
    for (let i = n; i < beads.length; i++) beads[i].visible = false
    draw()
  }

  const dispose = () => {
    ro.disconnect(); orbit.dispose()
    el.removeEventListener('pointerdown', onDown, cap); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp)
    scene.traverse((q) => { q.geometry?.dispose(); const m = q.material; if (m) { m.map?.dispose(); m.dispose() } })
    release(); renderer.dispose(); el.remove()
  }
  applyView('whole'); size()
  return { update, dispose, applyView }
}

const LABELS = [['whole', 'Whole kit'], ['optics', 'Beam splitter'], ['drive', 'Mirror drive'], ['fine', 'Fine micrometer'], ['scope', 'Telescope']]
const GLASS_LABELS = [['whole', 'Whole kit'], ['sheet', 'Glass sheet'], ['optics', 'Beam splitter'], ['scope', 'Telescope']]

function make(exp, glass) {
  const Flat = exp.Stage
  const doublet = exp.id === 'sodium-doublet'
  return function Stage3D({ v, o, t, set }) {
    const host = useRef(null), sim = useRef(null), api = useRef({}), field = useRef(null), last = useRef('')
    const [failed, setFailed] = useState(false)
    api.current.set = set
    useEffect(() => {
      try { sim.current = createScene(host.current, exp.controls, { set: (k, x) => api.current.set(k, x) }, glass) } catch { setFailed(true) }
      return () => { sim.current?.dispose(); sim.current = null }
    }, [])
    useEffect(() => {
      sim.current?.update(v, o, t)
      const dd = glass ? (o.path * 589.3) / 2000 : o.d
      const key = `${dd.toFixed(4)}|${v.tx}|${v.ty}|${v.lamp}`
      if (field.current && key !== last.current) { last.current = key; paintFringes(field.current, dd, doublet, v.tx, v.ty, v.lamp) }
    })
    if (failed) return <Flat v={v} o={o} t={t} set={set} />
    return (
      <div>
        <div className="stage3d" ref={host}>
          <div className="view-btns">{(glass ? GLASS_LABELS : LABELS).map(([k, l]) => <button type="button" key={k} className="view-reset" onClick={() => sim.current?.applyView(k)}>{l}</button>)}</div>
          <div className="scope-view">
            <canvas ref={field} width={FIELD} height={FIELD} aria-label="Fringes seen through the telescope" role="img" />
            <span>Through the telescope</span>
            <b>{glass ? `Sheet ${v.ins ? `${(v.ang || 0).toFixed(1)}°` : 'removed'}` : `M₁ ${(o.d / 1000).toFixed(4)} mm`}</b>
          </div>
        </div>
        <p className="stage3d-hint">{glass ? 'Click the glass sheet to put it in or take it out of the M₁ arm, and drag it to turn its stage and watch the fringes move. Set it back to 0° to record. The sheet thickness is in the controls. Click the lamp to switch it, and the screws behind M2 tilt it.' : 'Drag the large drum for coarse movement or the black micrometer thimble for fine movement, and watch the fringes. Click the lamp to switch it. The screws behind M2 tilt it. Drag the background to look around.'}</p>
      </div>
    )
  }
}

export const michelson3D = michelsonNa.map((e) => ({
  ...e,
  wide: true,
  state: () => ({ lamp: true, tx: 0, ty: 0 }),
  sample: (v, o) => {
    if (!v.lamp) return { error: 'The sodium lamp is off. Click it to switch it on.' }
    if (Math.abs(v.tx) > TILT_OK || Math.abs(v.ty) > TILT_OK) return { error: 'The fringes are not circular. Use the screws behind M2 to centre them.' }
    return e.sample(v, o)
  },
  Stage: make(e),
}))

const MU = 1.515
export const michelsonGlass3D = michelsonGlass.map((e) => {
  if (e.id !== 'thin-glass-ri') return { ...michelson3D.find((q) => q.id === e.id) }
  return {
    ...e,
    wide: true,
    state: () => ({ lamp: true, tx: 0, ty: 0, ang: 0 }),
    out: (v, t) => {
      const o = e.out(v, t), a = ((v.ang || 0) * Math.PI) / 180
      const extra = v.ins ? (2 * v.t * 1000 * (Math.sqrt(MU * MU - Math.sin(a) ** 2) - Math.cos(a) - (MU - 1))) / 589.3 : 0
      return { ...o, path: o.path + extra }
    },
    sample: (v, o) => {
      if (!v.lamp) return { error: 'The sodium lamp is off. Click it to switch it on.' }
      if (Math.abs(v.tx) > TILT_OK || Math.abs(v.ty) > TILT_OK) return { error: 'The fringes are not circular. Use the screws behind M2 to centre them.' }
      if (Math.abs(v.ang) > 0.5) return { error: 'Turn the sheet back to 0° on its stage before recording.' }
      return e.sample(v, o)
    },
    Stage: make(e, true),
  }
})
