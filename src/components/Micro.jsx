import { useEffect, useRef } from 'react'
import { useOnScreen } from './Workbench'

/* Particle-level view of what happens inside a kit. Each scene is drawn on an
   800 x 210 canvas and keeps its own particles between frames. */

const W = 800, H = 210, TAU = Math.PI * 2
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a))
const arr = (n, f) => Array.from({ length: n }, (_, i) => f(i))
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const COL = { e: '#2F7DF6', ion: '#CF9468', hole: '#E5484D', photon: '#F59E0B', ink: '#1B2740', dim: '#8A94A6', line: '#D5DBE5', green: '#0F9D76', violet: '#9333EA' }

const dot = (g, x, y, r, c, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1 }
const glow = (g, x, y, r, c, a = 0.25) => { dot(g, x, y, r * 2.4, c, a); dot(g, x, y, r, c) }
const txt = (g, s, x, y, c = COL.dim, size = 12, align = 'left') => { g.fillStyle = c; g.font = `600 ${size}px ui-monospace, Consolas, monospace`; g.textAlign = align; g.fillText(s, x, y) }
const ln = (g, x1, y1, x2, y2, c = COL.line, w = 1.5) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke() }
const arrow = (g, x1, y1, x2, y2, c = COL.ink, w = 2) => {
  ln(g, x1, y1, x2, y2, c, w)
  const a = Math.atan2(y2 - y1, x2 - x1), s = 8
  g.fillStyle = c; g.beginPath(); g.moveTo(x2, y2)
  g.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)); g.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)); g.fill()
}
const charge = (g, x, y, r, c, sign) => { dot(g, x, y, r, c); ln(g, x - r * 0.5, y, x + r * 0.5, y, '#fff', 1.5); if (sign > 0) ln(g, x, y - r * 0.5, x, y + r * 0.5, '#fff', 1.5) }

function latticeElectrons(g, S, p, dt, T, box, n = 70, key = 'e') {
  const [X, Y, BW, BH] = box
  if (!S[key]) S[key] = arr(n, () => ({ x: rnd(BW), y: rnd(BH), vx: rnd(-60, 60), vy: rnd(-60, 60) }))
  const temp = p.temp ?? 0.3
  const cols = Math.floor(BW / 46), rows = Math.floor(BH / 46)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = X + 23 + c * 46, y = Y + 23 + r * 46
    charge(g, x + Math.sin(T * 41 + c * 2.1 + r * 3.3) * (1 + temp * 7), y + Math.cos(T * 37 + c * 1.7 + r * 2.3) * (1 + temp * 7), 11, COL.ion, 1)
  }
  S[key].forEach((e) => {
    if (Math.random() < dt * (3 + temp * 8)) { e.vx = rnd(-70, 70); e.vy = rnd(-70, 70) }
    e.x += (e.vx + p.i * 210) * dt; e.y += e.vy * dt
    if (e.x < 0) e.x += BW; if (e.x > BW) e.x -= BW
    if (e.y < 0 || e.y > BH) { e.vy *= -1; e.y = clamp(e.y, 0, BH) }
    glow(g, X + e.x, Y + e.y, 3.2, COL.e)
  })
}

const scenes = {
  conductor(g, S, p, dt, T) {
    latticeElectrons(g, S, p, dt, T, [0, 0, W, H], 110)
    if (Math.abs(p.i) > 0.03) arrow(g, 400 - 60 * Math.sign(p.i), H - 14, 400 + 60 * Math.sign(p.i), H - 14, COL.e, 2.5)
  },

  rlc(g, S, p, dt, T) {
    const cw = 250
    txt(g, 'RESISTOR', 12, 16); txt(g, 'CAPACITOR', 280, 16); txt(g, 'INDUCTOR', 545, 16)
    g.save(); g.beginPath(); g.rect(8, 24, cw, H - 32); g.clip()
    latticeElectrons(g, S, { i: p.iR, temp: 0.45 }, dt, T, [8, 24, cw, H - 32], 34, 'r')
    g.restore()
    ln(g, 268, 22, 268, H - 6); ln(g, 534, 22, 534, H - 6)
    /* capacitor: charge piles up on the plates, reversing each half-cycle */
    const xa = 350, xb = 450, q = p.q
    g.fillStyle = '#C9CFDA'; g.fillRect(xa - 6, 30, 12, H - 44); g.fillRect(xb - 6, 30, 12, H - 44)
    const n = Math.round(Math.abs(q) * 9)
    for (let k = 0; k < n; k++) {
      const y = 40 + (k * (H - 64)) / 8
      charge(g, xa - 16, y, 7, q > 0 ? COL.hole : COL.e, q > 0 ? 1 : -1)
      charge(g, xb + 16, y, 7, q > 0 ? COL.e : COL.hole, q > 0 ? -1 : 1)
    }
    for (let k = 0; k < 5; k++) if (Math.abs(q) > 0.08) {
      const y = 50 + k * 28, d = Math.sign(q)
      g.globalAlpha = Math.abs(q); arrow(g, 400 - 26 * d, y, 400 + 26 * d, y, COL.violet, 1.6); g.globalAlpha = 1
    }
    /* inductor: magnetic field rings grow and collapse with the current */
    const cx = 665, cy = 112, i = p.iL
    for (let k = 1; k <= 4; k++) {
      const r = k * 22
      g.globalAlpha = clamp(Math.abs(i) * 1.1 - (k - 1) * 0.16, 0, 1); g.strokeStyle = COL.green; g.lineWidth = 2
      g.beginPath(); g.ellipse(cx, cy, r, r * 0.8, 0, 0, TAU); g.stroke(); g.globalAlpha = 1
    }
    S.a = (S.a || 0) + i * dt * 5
    for (let k = 0; k < 10; k++) {
      const a = S.a + (k / 10) * TAU
      glow(g, cx + Math.cos(a) * 30, cy + Math.sin(a) * 20, 3, COL.e)
    }
    dot(g, cx, cy, 11, '#7A849A')
    /* energy bars */
    g.fillStyle = COL.violet; g.fillRect(286, H - 8, 230 * p.uC, 5)
    g.fillStyle = COL.green; g.fillRect(552, H - 8, 230 * p.uL, 5)
  },

  gas(g, S, p, dt) {
    if (!S.m) S.m = arr(130, () => ({ x: rnd(W), y: rnd(H), vx: rnd(-90, 90), vy: rnd(-90, 90) }))
    S.m.forEach((a) => {
      a.x += a.vx * dt; a.y += a.vy * dt
      if (a.x < 0 || a.x > W) { a.vx *= -1; a.x = clamp(a.x, 0, W) }
      if (a.y < 0 || a.y > H) { a.vy *= -1; a.y = clamp(a.y, 0, H) }
      p.objs.forEach((o) => {
        const ox = o.x * W, oy = o.y * H, dx = a.x - ox, dy = a.y - oy, d = Math.hypot(dx, dy)
        if (d < o.r + 3) {
          const nx = dx / d, ny = dy / d, v = a.vx * nx + a.vy * ny
          a.vx += (-2 * v + (o.vx || 0) * nx * 1.6) * nx; a.vy += (-2 * v + (o.vx || 0) * nx * 1.6) * ny
          a.vx = clamp(a.vx, -220, 220); a.vy = clamp(a.vy, -220, 220)
          a.x = ox + nx * (o.r + 4); a.y = oy + ny * (o.r + 4); a.hit = 1
        }
      })
      a.hit = Math.max(0, (a.hit || 0) - dt * 3)
      dot(g, a.x, a.y, 2.8, a.hit > 0 ? COL.photon : '#9DB1CC')
    })
    p.objs.forEach((o) => {
      const gr = g.createRadialGradient(o.x * W - o.r * 0.3, o.y * H - o.r * 0.3, 2, o.x * W, o.y * H, o.r)
      gr.addColorStop(0, '#E7AE83'); gr.addColorStop(1, '#99552A')
      g.fillStyle = gr; g.beginPath(); g.arc(o.x * W, o.y * H, o.r, 0, TAU); g.fill()
    })
  },

  hall(g, S, p, dt) {
    const [x0, y0, bw, bh] = [90, 34, 620, 142]
    g.fillStyle = '#DDF3EA'; g.fillRect(x0, y0, bw, bh); g.strokeStyle = '#7FC7AE'; g.strokeRect(x0, y0, bw, bh)
    if (!S.h) S.h = arr(46, () => ({ x: rnd(bw), y: rnd(bh) }))
    const B = p.B, I = p.I, act = p.active ?? 1
    S.h.forEach((c) => {
      c.x += 200 * I * dt * act
      c.y += (-(B * 90 * I) + rnd(-26, 26)) * dt
      if (c.x > bw) { c.x -= bw; c.y = rnd(bh) }
      c.y = clamp(c.y, 3, bh - 3)
      charge(g, x0 + c.x, y0 + c.y, 7, COL.hole, 1)
    })
    const n = Math.round(Math.abs(B * I) * 16), top = B >= 0 ? COL.hole : COL.e, bot = B >= 0 ? COL.e : COL.hole
    for (let k = 0; k < n; k++) {
      const x = x0 + 18 + (k * (bw - 36)) / 15
      charge(g, x, y0 - 12, 6, top, B >= 0 ? 1 : -1); charge(g, x, y0 + bh + 12, 6, bot, B >= 0 ? -1 : 1)
    }
    for (let k = 0; k < 6; k++) { dot(g, 28, 40 + k * 26, 3, Math.abs(B) > 0.02 ? COL.ink : COL.line); dot(g, 54, 40 + k * 26, 3, Math.abs(B) > 0.02 ? COL.ink : COL.line) }
    txt(g, 'B', 36, 28, COL.ink, 13)
    arrow(g, 730, 105, 788, 105, COL.hole, 2.5); txt(g, 'I', 754, 96, COL.hole, 13)
  },

  spins(g, S, p, dt, T) {
    const cols = 26, rows = 6
    if (!S.s) S.s = arr(cols * rows, () => ({ th: rnd(-1, 1), o: rnd(TAU), a: rnd(TAU) }))
    S.s.forEach((s, i) => {
      const c = i % cols, r = Math.floor(i / cols)
      const x = 22 + c * 29.5, y = 22 + r * 33.5
      const up = p.domains ? p.m > s.th * (p.width ?? 0.6) : p.m > 0
      const strength = p.domains ? 1 : Math.abs(p.m)
      const target = (up ? -Math.PI / 2 : Math.PI / 2)
      const random = s.o + T * 3 * (s.a > 3 ? 1 : -1)
      const mix = clamp(strength * (1 - p.disorder), 0, 1)
      const dx = Math.cos(target) * mix + Math.cos(random) * (1 - mix), dy = Math.sin(target) * mix + Math.sin(random) * (1 - mix)
      const ang = Math.atan2(dy, dx) + Math.sin(T * 12 + s.a) * p.disorder * 0.5
      s.cur = s.cur === undefined ? ang : s.cur + Math.atan2(Math.sin(ang - s.cur), Math.cos(ang - s.cur)) * clamp(dt * 12, 0, 1)
      const u = Math.cos(s.cur) * 12, v = Math.sin(s.cur) * 12
      arrow(g, x - u, y - v, x + u, y + v, mix > 0.5 ? (up ? COL.hole : COL.e) : COL.dim, 2)
    })
  },

  franck(g, S, p, dt) {
    if (!S.a) { S.a = arr(34, () => ({ x: rnd(90, 690), y: rnd(10, H - 10), f: 0 })); S.e = [] }
    if (Math.random() < dt * 34) S.e.push({ x: 30, y: rnd(20, H - 20), E: 0, vy: rnd(-12, 12), hit: 0 })
    const F = p.V / 680
    ln(g, 28, 8, 28, H - 8, COL.hole, 4); ln(g, 720, 8, 720, H - 8, COL.dim, 3)
    S.a.forEach((a) => { a.f = Math.max(0, a.f - dt * 2.4); if (a.f > 0) dot(g, a.x, a.y, 16 + a.f * 8, '#FF8A3C', a.f * 0.55); dot(g, a.x, a.y, 9, a.f > 0 ? '#FF8A3C' : '#C8D2E2') })
    S.e = S.e.filter((e) => {
      const sp = 130 + Math.sqrt(Math.max(0, e.E)) * 60
      e.x += sp * dt; e.y += e.vy * dt; e.E += F * sp * dt
      if (e.E >= p.Ex) S.a.forEach((a) => { if (Math.hypot(a.x - e.x, a.y - e.y) < 15 && e.E >= p.Ex) { e.E -= p.Ex; a.f = 1; e.hit = 1 } })
      e.hit = Math.max(0, e.hit - dt * 4)
      glow(g, e.x, e.y, 3, e.hit > 0 ? COL.hole : COL.e)
      return e.x < 720 && e.y > 0 && e.y < H
    })
    txt(g, 'Filament', 36, 16, COL.hole); txt(g, 'Anode', 712, 16, COL.dim, 12, 'right')
  },

  beam(g, S, p, dt) {
    if (!S.e) S.e = []
    if (Math.random() < dt * 60) S.e.push({ x: 40, j: rnd(-4, 4) })
    g.fillStyle = '#C9CFDA'; g.fillRect(230, 50, 150, 8); g.fillRect(230, H - 58, 150, 8)
    if (p.E > 0.02) for (let k = 0; k < 6; k++) arrow(g, 250 + k * 22, 62, 250 + k * 22, H - 66, 'rgba(147,51,234,.4)', 1.4)
    if (p.B > 0.02) { for (let k = 0; k < 18; k++) dot(g, 250 + (k % 6) * 22, 72 + Math.floor(k / 6) * 34, 2.4, COL.green) }
    ln(g, 760, 10, 760, H - 10, COL.dim, 4)
    const yAt = (x) => { if (x < 230) return 0; const u = (x - 230) / 530; return p.net * 70 * (u < 0.28 ? (u / 0.28) ** 2 * 0.28 : u) }
    S.e = S.e.filter((e) => { e.x += 500 * dt; glow(g, e.x, H / 2 - yAt(e.x) + e.j, 2.8, COL.e); return e.x < 758 })
    glow(g, 760, H / 2 - p.net * 70, 7, COL.green)
    txt(g, 'Electron gun', 16, H / 2 - 16); dot(g, 34, H / 2, 8, '#55607A')
  },

  millikan(g, S, p, dt, T) {
    if (!S.m) S.m = arr(80, () => ({ x: rnd(W), y: rnd(30, H - 30), vx: rnd(-90, 90), vy: rnd(-90, 90) }))
    g.fillStyle = '#C9A44C'; g.fillRect(0, 0, W, 12); g.fillRect(0, H - 12, W, 12)
    const on = p.field > 0.01
    for (let k = 0; k < 20; k++) { txt(g, on ? '+' : '', 20 + k * 40, 10, '#fff', 12); txt(g, on ? '−' : '', 20 + k * 40, H - 2, '#fff', 12) }
    const cx = 400, cy = H / 2 + clamp(p.v * 44, -44, 44) * Math.sin(T * 1.6 + 1) * 0 + clamp(p.v * 34, -40, 40), r = 36
    S.m.forEach((a) => {
      a.x += a.vx * dt; a.y += a.vy * dt
      if (a.x < 0 || a.x > W) a.vx *= -1
      if (a.y < 16 || a.y > H - 16) a.vy *= -1
      const d = Math.hypot(a.x - cx, a.y - cy)
      if (d < r + 3) { a.vx = (a.x - cx) * 3; a.vy = (a.y - cy) * 3 }
      dot(g, a.x, a.y, 2.5, '#9DB1CC')
    })
    const gr = g.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, r)
    gr.addColorStop(0, '#FBE7BD'); gr.addColorStop(1, '#D9A33B')
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill()
    for (let k = 0; k < p.n; k++) { const a = (k / p.n) * TAU + T * 0.5; charge(g, cx + Math.cos(a) * 20, cy + Math.sin(a) * 18, 7, COL.e, -1) }
    arrow(g, cx + 62, cy, cx + 62, cy + 46, COL.ink, 2.5); txt(g, 'mg', cx + 72, cy + 34, COL.ink, 13)
    if (on) { const f = clamp(p.field, 0, 1.3) * 46; arrow(g, cx - 62, cy, cx - 62, cy - f, COL.violet, 2.5); txt(g, 'qE', cx - 100, cy - f + 12, COL.violet, 13) }
  },

  reflect(g, S, p, dt, T) {
    const cx = 400, cy = 130, a = p.th
    if (!S.f) S.f = []
    if (Math.random() < dt * 26) S.f.push({ u: 0, kind: 0, pass: Math.random() < p.R ? 1 : 0 })
    g.fillStyle = '#CFE6F3'; g.fillRect(170, cy, 460, 80)
    for (let c = 0; c < 15; c++) for (let r = 0; r < 2; r++) {
      const x = 192 + c * 30, y = cy + 22 + r * 36, sw = Math.sin(T * 14 + c) * 7
      ln(g, x - (p.phiP ? sw : 0), y - (p.phiP ? 0 : sw), x + (p.phiP ? sw : 0), y + (p.phiP ? 0 : sw), COL.e, 2); dot(g, x, y, 3.4, COL.ion)
    }
    const inX = cx - Math.sin(a) * 200, inY = cy - Math.cos(a) * 200, outX = cx + Math.sin(a) * 200, outY = inY
    const rr = Math.asin(Math.sin(a) / p.n), trX = cx + Math.tan(rr) * 80, trY = cy + 80
    S.f = S.f.filter((q) => {
      q.u += dt * 1.4
      let x, y
      if (q.u < 1) { x = inX + (cx - inX) * q.u; y = inY + (cy - inY) * q.u }
      else if (q.pass) { const v = q.u - 1; x = cx + (outX - cx) * v; y = cy + (outY - cy) * v }
      else { const v = (q.u - 1) * 1.6; x = cx + (trX - cx) * v; y = cy + (trY - cy) * v }
      glow(g, x, y, 4, COL.hole)
      return q.u < 2
    })
    txt(g, 'Reflected', outX + 12, Math.max(outY, 16) + 10, COL.ink); txt(g, 'Incident', inX - 12, Math.max(inY, 16) + 10, COL.ink, 12, 'right')
  },

  polarize(g, S, p, dt) {
    if (!S.f) S.f = []
    if (Math.random() < dt * 22) S.f.push({ x: 0, ok: Math.random() < p.T })
    S.f = S.f.filter((q) => {
      q.x += dt * 240
      if (q.x > 400 && !q.ok) return false
      const axis = q.x > 400 ? p.a : 0, s = Math.sin(q.x * 0.09) * 26
      ln(g, q.x - Math.sin(axis) * s, H / 2 - Math.cos(axis) * s, q.x + Math.sin(axis) * s, H / 2 + Math.cos(axis) * s, COL.hole, 2.5)
      glow(g, q.x, H / 2, 4, COL.hole)
      return q.x < W
    })
    g.strokeStyle = COL.ink; g.lineWidth = 4; g.beginPath(); g.ellipse(400, H / 2, 24, 84, 0, 0, TAU); g.stroke()
    for (let k = -3; k <= 3; k++) { const d = k * 10; ln(g, 400 + d * Math.cos(p.a) * 0.3 - Math.sin(p.a) * 60 * 0.3, H / 2 + d * Math.sin(p.a) - Math.cos(p.a) * 60, 400 + d * Math.cos(p.a) * 0.3 + Math.sin(p.a) * 60 * 0.3, H / 2 + d * Math.sin(p.a) + Math.cos(p.a) * 60, COL.dim, 1.2) }
  },

  interfere(g, S, p, dt, T) {
    const mix = 520, top = 42, bot = H - 42, c2 = p.color || COL.photon
    const sine = (y, ph, x1, x2, amp, col) => { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); for (let x = x1; x <= x2; x += 3) { const yy = y + Math.sin(x * 0.06 - T * 7 + ph) * amp; x === x1 ? g.moveTo(x, yy) : g.lineTo(x, yy) } g.stroke() }
    sine(top, 0, 40, mix, 18, c2); sine(bot, p.phase, 40, mix, 18, COL.t2 || '#D9480F')
    const amp = Math.abs(Math.cos(p.phase / 2)) * (p.vis ?? 1)
    sine(H / 2, p.phase / 2, mix, W - 70, amp * 42 + 0.5, COL.green)
    ln(g, mix, top + 28, mix, bot - 28, COL.line, 2)
    if (!S.f) S.f = []
    if (Math.random() < dt * 26) S.f.push({ x: 40, up: Math.random() < 0.5 })
    S.f = S.f.filter((q) => {
      q.x += 280 * dt
      const y = q.up ? top : bot
      if (q.x < mix) glow(g, q.x, y + (Math.sin(q.x * 0.06 - T * 7) * 18), 4, c2)
      else if (Math.random() < amp + 0.05) glow(g, q.x, H / 2, 4.5, COL.green)
      return q.x < W - 70
    })
    dot(g, W - 40, H / 2, 10 + amp * 22, c2, 0.25 + amp * 0.75)
    txt(g, 'Path 1', 40, 16, COL.ink); txt(g, 'Path 2', 40, H - 6, COL.ink); txt(g, amp > 0.7 ? 'Bright: in step' : amp < 0.25 ? 'Dark: out of step' : 'Partial', W - 12, 16, COL.ink, 12, 'right')
  },

  levels(g, S, p, dt) {
    const x1 = 60, x2 = 360, up = 50, low = 170, sp = p.B * 20
    ln(g, x1, low, x2, low, COL.ink, 3)
    const lv = [up - sp, up, up + sp]
    lv.forEach((y, i) => ln(g, x1 + (p.B > 0.01 || i === 1 ? 0 : 0), y, x2, y, p.B > 0.01 || i === 1 ? COL.ink : 'transparent', 3))
    txt(g, 'Excited', x1, up - 22 - sp, COL.dim); txt(g, 'Ground', x1, low + 18, COL.dim)
    if (!S.f) S.f = []
    if (Math.random() < dt * 9) { const k = Math.floor(rnd(3)); if (p.show.includes(k)) S.f.push({ k, u: 0, x: rnd(110, 320) }) }
    const cols = [COL.t1 || '#2563EB', '#22A06B', '#E5484D']
    S.f = S.f.filter((q) => {
      q.u += dt * 1.1
      if (q.u < 0.5) { const y = lv[q.k] + (low - lv[q.k]) * (q.u / 0.5); glow(g, q.x, y, 5, COL.e) }
      else { const x = q.x + (q.u - 0.5) * 760, y = 110 + (q.k - 1) * 38; glow(g, x, y, 5, cols[q.k]) }
      return q.u < 1.5
    })
    txt(g, 'Photons out', 640, 28, COL.ink)
  },

  dipoles(g, S, p, dt, T) {
    const cols = 22, rows = 5
    if (!S.d) S.d = arr(cols * rows, () => ({ o: rnd(TAU), s: rnd(2, 5) }))
    g.fillStyle = '#C9CFDA'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 8, W, 8)
    S.d.forEach((d, i) => {
      const c = i % cols, r = Math.floor(i / cols), x = 26 + c * 35.6, y = 30 + r * 38
      if (p.fill !== undefined && c / cols > p.fill) { dot(g, x, y, 3, '#D4DBE6'); return }
      const random = d.o + T * d.s * 0.3
      const target = Math.PI / 2, mix = clamp(p.E, 0, 0.92)
      const ang = Math.atan2(Math.sin(target) * mix + Math.sin(random) * (1 - mix), Math.cos(target) * mix + Math.cos(random) * (1 - mix))
      const u = Math.cos(ang) * 9, v = Math.sin(ang) * 9
      charge(g, x - u, y - v, 7, COL.e, -1); charge(g, x + u, y + v, 7, COL.hole, 1)
    })
  },

  sound(g, S, p, dt, T) {
    const cols = 76, rows = 9
    for (let c = 0; c < cols; c++) {
      const x0 = 8 + c * 10.4, k = TAU / p.lambda
      const dx = p.standing ? Math.sin(k * x0) * Math.cos(T * 5) * 24 * p.amp : Math.sin(k * x0 - T * 5) * 14 * p.amp
      for (let r = 0; r < rows; r++) dot(g, x0 + dx + Math.sin(c * 7 + r * 11) * 1.5, 12 + r * 23, 3, '#5B8DEF', 0.85)
    }
    if (p.standing) ln(g, p.reflector, 0, p.reflector, H, COL.hole, 4)
  },

  heat(g, S, p, dt, T) {
    const cols = 34, rows = 7
    const temp = (c) => {
      const u = c / (cols - 1)
      if (p.wave) return clamp(0.45 + Math.exp(-u * p.decay) * Math.sin(u * p.k * TAU - T * p.w) * 0.55, 0, 1)
      return p.hot + (p.cold - p.hot) * u
    }
    for (let c = 0; c < cols; c++) {
      const h = temp(c)
      for (let r = 0; r < rows; r++) {
        const x = 16 + c * 23, y = 16 + r * 30
        dot(g, x + Math.sin(T * 40 + c * 3 + r * 2) * (1 + h * 7), y + Math.cos(T * 37 + c * 2 + r * 4) * (1 + h * 7), 7.5, `rgb(${Math.round(90 + 165 * h)},${Math.round(130 - 30 * h)},${Math.round(225 - 180 * h)})`)
      }
    }
    if (p.carriers) {
      if (!S.c) S.c = arr(42, () => ({ x: rnd(W), y: rnd(H) }))
      S.c.forEach((e) => {
        e.x += (p.carriers * 120 + rnd(-60, 60)) * dt; e.y += rnd(-60, 60) * dt
        if (e.x > W) e.x -= W; if (e.x < 0) e.x += W; e.y = clamp(e.y, 4, H - 4)
        glow(g, e.x, e.y, 3.2, '#FFFFFF', 0.4); dot(g, e.x, e.y, 2.4, COL.ink)
      })
    }
  },

  surface(g, S, p, dt, T) {
    const wl = 330, wr = 470, base = 150
    g.fillStyle = '#E4ECF5'; g.fillRect(wl - 10, 0, 10, H); g.fillRect(wr, 0, 10, H)
    const level = base - p.rise
    for (let i = 0; i < 7; i++) {
      for (let r = 0; r < 12; r++) {
        const y = H - 8 - r * 19, x = wl + 12 + i * 19.4
        const edge = i === 0 || i === 6 ? 7 : Math.abs(i - 3) * 2
        if (y < level + (6 - edge) * 1) continue
        const top = y < level + 20
        dot(g, x + Math.sin(T * 30 + i * 2 + r) * 1.6, y + Math.cos(T * 28 + r * 3 + i) * 1.6, 8, top ? '#2F7DF6' : '#7EB6F2')
      }
    }
    for (let i = 0; i < 4; i++) {
      const y = level + 8 + i * 26
      arrow(g, wl + 44, y, wl + 16, y - 10, COL.hole, 1.6); arrow(g, wr - 44, y, wr - 16, y - 10, COL.hole, 1.6)
    }
    txt(g, 'Walls pull the surface molecules up', 16, 24, COL.ink); txt(g, `Rise ${p.label}`, 16, 44, COL.dim)
  },

  contact(g, S, p, dt, T) {
    const gap = clamp(p.gap, 0, 1) * 66
    const row = (y, col) => { for (let c = 0; c < 44; c++) dot(g, 10 + c * 18 + Math.sin(T * 30 + c) * 1.1, y + Math.cos(T * 32 + c * 2) * 1.1, 8, col) }
    row(H - 18, '#C4CCD8'); row(H - 36, '#C4CCD8')
    row(H - 54 - gap - 18, p.touch ? COL.green : '#C9A44C'); row(H - 54 - gap - 36, p.touch ? COL.green : '#C9A44C'); row(H - 54 - gap - 54, p.touch ? COL.green : '#C9A44C')
    txt(g, p.touch ? 'Contact' : 'Tip above the surface', 14, 22, COL.ink)
  },

  fibre(g, S, p, dt, T) {
    const top = 60, bot = 150, bend = p.bend || 0
    const dy = (x) => Math.sin((x / W) * Math.PI) * bend * 26
    g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = top - 30 + dy(x); x ? g.lineTo(x, y) : g.moveTo(x, y) } for (let x = W; x >= 0; x -= 8) g.lineTo(x, bot + 30 + dy(x)); g.closePath(); g.fillStyle = '#DCE3EE'; g.fill()
    g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = top + dy(x); x ? g.lineTo(x, y) : g.moveTo(x, y) } for (let x = W; x >= 0; x -= 8) g.lineTo(x, bot + dy(x)); g.closePath(); g.fillStyle = '#F4F8FE'; g.fill()
    if (!S.f) S.f = []
    if (Math.random() < dt * 60 * p.on) S.f.push({ x: 0, y: 105, vy: rnd(-180, 180), out: false })
    S.f = S.f.filter((f) => {
      f.x += 400 * dt; f.y += f.vy * dt
      if (!f.out) {
        if (f.y < top || f.y > bot) {
          if (Math.abs(f.vy) * (1 + bend * 1.6) > 300 || Math.random() < bend * 0.045) f.out = true
          else f.vy *= -1
          f.y = clamp(f.y, top, bot)
        }
      }
      glow(g, f.x, f.y + dy(f.x), 3.8, p.color, f.out ? 0.1 : 0.3)
      return f.x < W && f.y > -60 && f.y < H + 60
    })
    txt(g, 'Cladding n = 1.406', 12, 22, COL.dim); txt(g, 'Core n = 1.492', 12, 110, COL.ink)
    void T
  },

  junction(g, S, p, dt) {
    g.fillStyle = '#E6EEFB'; g.fillRect(0, 40, 370, H - 40); g.fillStyle = '#FBE7E7'; g.fillRect(430, 40, 370, H - 40); g.fillStyle = '#F3F1E9'; g.fillRect(370, 40, 60, H - 40)
    txt(g, 'n-type: electrons', 14, 60, COL.e); txt(g, 'p-type: holes', 786, 60, COL.hole, 12, 'right')
    if (!S.a) { S.a = arr(30, () => ({ x: rnd(0, 360), y: rnd(64, H - 8) })); S.b = arr(30, () => ({ x: rnd(440, 800), y: rnd(64, H - 8) })); S.f = [] }
    const d = p.i
    const step = (q, dir, min, max) => { q.x += (d * 150 * dir + rnd(-34, 34)) * dt; q.y = clamp(q.y + rnd(-34, 34) * dt, 64, H - 8); if (q.x < min) q.x = max; if (q.x > max) q.x = min }
    S.a.forEach((e) => { step(e, 1, 0, 398); if (d > 0.04 && e.x > 392 && Math.random() < 0.4) { if (p.mode === 'led') S.f.push({ x: 400, y: e.y }); e.x = 0 } charge(g, e.x, e.y, 6.5, COL.e, -1) })
    S.b.forEach((h) => { step(h, -1, 402, 800); if (d > 0.04 && h.x < 408) h.x = 800; charge(g, h.x, h.y, 6.5, COL.hole, 1) })
    if (p.mode === 'detect' && Math.random() < dt * 22 * p.i) S.f.push({ x: rnd(300, 500), y: 0, down: true })
    S.f = S.f.filter((f) => { f.y += (f.down ? 240 : -240) * dt; glow(g, f.x, f.y, 4.5, p.color); return f.down ? f.y < H / 2 + 20 : f.y > 0 })
  },

  logic(g, S, p, dt) {
    const n = p.bits.length, gap = (H - 20) / n
    if (!S.q) S.q = []
    S.next = (S.next || 0) - dt
    if (S.next <= 0) { S.next = 0.22; p.bits.forEach((b, i) => S.q.push({ x: 60, i, b })) }
    p.bits.forEach((b, i) => {
      const y = 10 + gap * (i + 0.5)
      ln(g, 60, y, W - 60, y, COL.line, 3)
      txt(g, p.names?.[i] ?? `D${i}`, 8, y + 4, COL.ink, 12); dot(g, W - 34, y, 11, b ? '#E5484D' : '#E4E8EF')
    })
    S.q = S.q.filter((q) => {
      q.x += 280 * dt
      const y = 10 + gap * (q.i + 0.5)
      if (q.b) { for (let k = 0; k < 6; k++) glow(g, q.x + k * 5, y + Math.sin(k * 2 + q.x * 0.2) * 5, 2.4, COL.e); } else dot(g, q.x + 12, y, 2.4, '#C5CDDA')
      return q.x < W - 60
    })
  },
}

export default function Micro({ cfg, running, speed }) {
  const ref = useRef(null)
  const [box, seen] = useOnScreen()
  const live = useRef({ cfg, running, speed, seen })
  live.current = { cfg, running, speed, seen }
  const scene = cfg?.scene

  useEffect(() => {
    if (!scene || !scenes[scene]) return undefined
    const c = ref.current, g = c.getContext('2d')
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    c.width = W * dpr; c.height = H * dpr
    g.scale(dpr, dpr)
    const S = {}
    let id, last = performance.now(), T = 0
    const loop = (now) => {
      id = requestAnimationFrame(loop)
      const l = live.current
      if (!l.seen || now - last < 30) return
      const dt = l.running ? (Math.min(0.05, (now - last) / 1000) * l.speed) : 0
      last = now; T += dt
      g.clearRect(0, 0, W, H)
      g.fillStyle = '#F8FAFD'; g.fillRect(0, 0, W, H)
      if (l.cfg) scenes[scene](g, S, l.cfg, dt, T)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [scene])

  if (!scene || !scenes[scene]) return null
  return (
    <div className="micro" ref={box}>
      <div className="micro-head"><b>{cfg.title}</b><span>{cfg.note}</span></div>
      <canvas ref={ref} width={W} height={H} role="img" aria-label={`${cfg.title}. ${cfg.note}`} />
    </div>
  )
}
