import { useRef, useState } from 'react'
import { Svg, Seven } from '../lib/parts'
import { fit, jitter, wobble, curve } from '../lib/math'

/* A working replica of the Network Theorems Trainer front panel. Every socket belongs to one
   resistive network that is solved by nodal analysis, so the meters read what is actually wired. */

const VB = '90 90 1620 930'
const SANS = { fontFamily: 'Figtree, Arial, sans-serif' }
const NAVY = '#1F3A6B', INK = '#1B2A44'

/* ---- sockets, in the coordinates of the reference picture ---- */
const POS = {
  p5: [200, 315], p12: [290, 315], gnd: [380, 315], ccsP: [220, 418], ccsN: [290, 418],
  dvmP: [830, 410], dvmN: [890, 410], amP: [1250, 410], amN: [1310, 410],
  'th.A': [553, 550], 'th.B': [553, 655],
  'sp.p12': [693, 550], 'sp.p5': [1107, 550], 'sp.t': [900, 563], 'sp.m': [900, 600], 'sp.b': [900, 655],
  'no.P': [1580, 550], 'no.N': [1580, 655],
  'mp.P': [470, 785], 'mp.N': [470, 890],
  'rc.1': [713, 785], 'rc.1p': [713, 890], 'rc.2': [1087, 785], 'rc.2p': [1087, 890],
  'te.A': [1301, 836], 'te.B': [1413, 773], 'te.C': [1525, 836], 'te.D': [1413, 899],
}
const SOCKETS = Object.keys(POS)
const BLACK = new Set(['gnd', 'ccsN', 'dvmN', 'amN', 'th.B', 'sp.b', 'no.N', 'mp.N', 'rc.1p', 'rc.2p'])
const YELLOW = new Set(['te.A', 'te.B', 'te.C', 'te.D'])

const DVM_R = [{ full: 0.1999, m: 1000, d: 1, unit: 'mV', l: '200mV' }, { full: 1.999, m: 1, d: 3, unit: 'V', l: '2V' }, { full: 19.99, m: 1, d: 2, unit: 'V', l: '20V' }]
const DAM_R = [{ full: 199.9e-6, m: 1e6, d: 1, unit: 'µA', l: '200µA' }, { full: 1.999e-3, m: 1e3, d: 3, unit: 'mA', l: '2mA' }, { full: 19.99e-3, m: 1e3, d: 2, unit: 'mA', l: '20mA' }, { full: 199.9e-3, m: 1e3, d: 1, unit: 'mA', l: '200mA' }]
const bestRange = (list, x) => { const i = list.findIndex((r) => Math.abs(x) <= r.full); return i < 0 ? list.length - 1 : i }

const LOADS = [100, 220, 470, 1000, 2200, 3300, 4700, 6800, 10000]
const TH_LOADS = [0, ...LOADS] // 0 means disconnected
const NO_LOADS = [0, ...LOADS] // 0 means a direct short
const loadText = (r, zero) => (r === 0 ? zero : r >= 1000 ? `${+(r / 1000).toFixed(1)} kΩ` : `${r} Ω`)

/* ---- network ---- */
const RS = 0.01, R_AM = 0.1, R_VM = 1e7, GMIN = 1e-9
function elements(v) {
  const k = v.on ? 1 : 0
  return [
    ['V', 'p5', 'gnd', 5 * k], ['V', 'p12', 'gnd', 12 * k], ['I', 'ccsN', 'ccsP', 3.2e-3 * k],
    /* superposition: a switched-off source is replaced by a short */
    ['V', 'sp.p12', 'sp.b', 12 * k * (v.s1 ? 1 : 0), 'V1'], ['V', 'sp.p5', 'sp.b', 5 * k * (v.s2 ? 1 : 0), 'V2'],
    ['R', 'sp.p12', 'sp.t', 1000, 'sp1'], ['R', 'sp.p5', 'sp.t', 2200, 'sp2'], ['R', 'sp.m', 'sp.b', 1000, 'sp3'],
    /* Thevenin */
    ['V', 'th.v', 'th.B', 12 * k], ['R', 'th.v', 'th.n', 1000, 'th1'], ['R', 'th.n', 'th.B', 1000, 'th2'], ['R', 'th.n', 'th.A', 470, 'th3'],
    ...(v.RLt ? [['R', 'th.A', 'th.B', v.RLt, 'thL']] : []),
    /* Norton */
    ['I', 'no.N', 'no.t', 3.2e-3 * k], ['R', 'no.t', 'no.N', 1000, 'no1'], ['R', 'no.t', 'no.n', 1000, 'no2'], ['R', 'no.n', 'no.N', 2200, 'no3'], ['R', 'no.n', 'no.P', Math.max(v.RLn, RS), 'noL'],
    /* maximum power transfer */
    ['V', 'mp.v', 'mp.N', 12 * k], ['R', 'mp.v', 'mp.P', 1000, 'mpS'], ['R', 'mp.P', 'mp.N', Math.max(v.RLm, 0.1), 'mpL'],
    /* reciprocity */
    ['R', 'rc.1', 'rc.a', 1000, 'rc1'], ['R', 'rc.a', 'rc.1p', 2200, 'rc2'], ['R', 'rc.a', 'rc.2', 1000, 'rc3'], ['R', 'rc.2', 'rc.1p', 1000, 'rc4'], ['W', 'rc.1p', 'rc.2p'],
    /* Tellegen bridge */
    ['R', 'te.A', 'te.B', 1000, 'R1'], ['R', 'te.B', 'te.C', 2200, 'R2'], ['R', 'te.A', 'te.D', 2200, 'R3'], ['R', 'te.D', 'te.C', 1000, 'R4'], ['R', 'te.B', 'te.D', 1000, 'R5'],
    /* meters */
    ['R', 'dvmP', 'dvmN', R_VM, 'dvm'], ['R', 'amP', 'amN', R_AM, 'dam'],
  ]
}
const TE_R = { R1: 1000, R2: 2200, R3: 2200, R4: 1000, R5: 1000 }

function solve(v) {
  const els = elements(v)
  const names = new Set(SOCKETS); els.forEach((e) => { names.add(e[1]); names.add(e[2]) })
  const par = {}; names.forEach((n) => { par[n] = n })
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a] } return a }
  v.cords.forEach(([a, b]) => { par[find(a)] = find(b) })
  els.filter((e) => e[0] === 'W').forEach((e) => { par[find(e[1])] = find(e[2]) })
  const roots = [...new Set([...names].map(find))]
  const idx = new Map(roots.map((r, i) => [r, i])), n = roots.length
  const A = Array.from({ length: n }, () => new Float64Array(n + 1))
  for (let i = 0; i < n; i++) A[i][i] = GMIN
  const stamp = (a, b, g) => { const i = idx.get(find(a)), j = idx.get(find(b)); if (i === j) return; A[i][i] += g; A[j][j] += g; A[i][j] -= g; A[j][i] -= g }
  const inject = (a, b, c) => { A[idx.get(find(a))][n] -= c; A[idx.get(find(b))][n] += c } // current c flows a -> b through the source
  els.forEach(([t, a, b, x]) => {
    if (t === 'R') stamp(a, b, 1 / x)
    if (t === 'V') { stamp(a, b, 1 / RS); inject(b, a, x / RS) }
    if (t === 'I') inject(a, b, x)
  })
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    for (let r = 0; r < n; r++) {
      if (r === c || !A[r][c]) continue
      const m = A[r][c] / A[c][c]
      for (let k = c; k <= n; k++) A[r][k] -= m * A[c][k]
    }
  }
  const node = {}
  roots.forEach((r, i) => { node[r] = 0; void i })
  /* column pivoting is not used, so row c still solves unknown c */
  roots.forEach((r, i) => { node[r] = A[i][n] / A[i][i] })
  const volt = (s) => node[find(s)]
  const cur = {}
  els.forEach((e) => { if (e[0] === 'R') cur[e[4]] = (volt(e[1]) - volt(e[2])) / e[3] })
  return { volt, cur, same: (a, b) => find(a) === find(b) }
}

const cache = new Map()
function compute(v) {
  const key = JSON.stringify([v.cords, v.on, v.s1, v.s2, v.RLt, v.RLn, v.RLm])
  let s = cache.get(key)
  if (!s) { s = solve(v); if (cache.size > 400) cache.clear(); cache.set(key, s) }
  const wired = (id) => v.cords.some((c) => c.includes(id))
  const Vm = wired('dvmP') && wired('dvmN') ? s.volt('dvmP') - s.volt('dvmN') : 0
  const Im = wired('amP') && wired('amN') ? s.cur.dam : 0
  const vr = DVM_R[v.vr], ir = DAM_R[v.ir]
  const fuse = v.on && (s.same('p5', 'gnd') || s.same('p12', 'gnd') || s.same('p5', 'p12'))
  return { s, fuse, Vm, Im, vOver: Math.abs(Vm) > vr.full, iOver: Math.abs(Im) > ir.full, vWired: wired('dvmP') && wired('dvmN'), iWired: wired('amP') && wired('amN') }
}
const across = (s, a, b, p, n) => (s.same(p, a) && s.same(n, b) ? 1 : s.same(p, b) && s.same(n, a) ? -1 : 0)

/* ---- static drawing ---- */
const Txt = ({ x, y, s = 12, a = 'middle', w = 500, c = INK, children, ...p }) => <text x={x} y={y} fontSize={s} textAnchor={a} fontWeight={w} fill={c} style={SANS} {...p}>{children}</text>
const wire = { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }
const ZigH = ({ x, y }) => <path {...wire} d={`M${x - 24},${y} l4,-9 8,18 8,-18 8,18 8,-18 8,18 4,-9`} />
const ZigV = ({ x, y }) => <path {...wire} d={`M${x},${y - 24} l-9,4 18,8 -18,8 18,8 -18,8 9,4`} />
const Batt = ({ x, y }) => <path {...wire} d={`M${x - 14},${y - 5} h28 M${x - 7},${y + 5} h14`} strokeWidth={3} />
const Lab = ({ x, y, t, v, a = 'middle' }) => <g><Txt x={x} y={y} a={a}>{t}</Txt>{v && <Txt x={x} y={y + 40} s={11} a={a}>{v}</Txt>}</g>
const Block = ({ x, y, w, h, t }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="6" fill="#EEF1F6" stroke={NAVY} strokeWidth="2" />
    <path d={`M${x},${y + 28} v-22 a6,6 0 0 1 6,-6 h${w - 12} a6,6 0 0 1 6,6 v22 z`} fill={NAVY} />
    <Txt x={x + w / 2} y={y + 19} s={13.5} w={700} c="#fff" letterSpacing=".04em">{t}</Txt>
  </g>
)
const Screw = ({ x, y }) => (
  <g><circle cx={x} cy={y} r="6" fill="url(#g-silver)" stroke="#555" /><line x1={x - 4} y1={y + 2} x2={x + 4} y2={y - 2} stroke="#444" strokeWidth="1.5" /></g>
)
const Socket = ({ id }) => {
  const [x, y] = POS[id]
  const fill = YELLOW.has(id) ? '#E8C53A' : BLACK.has(id) ? '#1A1B1F' : '#D92D20'
  return <g><circle cx={x} cy={y} r="13" fill="url(#g-silver)" stroke="#555C68" /><circle cx={x} cy={y} r="9.5" fill={fill} stroke="#000" strokeOpacity=".45" /><circle cx={x} cy={y} r="3.8" fill="#0A0B0D" /></g>
}
const TeR = ({ x1, y1, x2, y2, l, lx, ly }) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return <g><line x1={x1} y1={y1} x2={x2} y2={y2} {...wire} /><rect x={mx - 21} y={my - 7} width="42" height="14" fill="#EEF1F6" stroke={INK} strokeWidth="2" transform={`rotate(${a} ${mx} ${my})`} /><Txt x={lx} y={ly} s={11}>{l}</Txt></g>
}

const STATIC = (
  <g>
    <rect x="90" y="90" width="1620" height="930" fill="#E7E8EB" />
    <rect x="90" y="984" width="1620" height="36" rx="6" fill="#142544" />
    <rect x="170" y="1016" width="60" height="14" fill="#0B0C0F" /><rect x="1570" y="1016" width="60" height="14" fill="#0B0C0F" />
    <rect x="92" y="92" width="1616" height="892" rx="16" fill={NAVY} />
    <rect x="110" y="110" width="1580" height="850" rx="6" fill="#F7F8FA" />
    {[[124, 124], [1676, 124], [124, 946], [1676, 946]].map(([x, y], i) => <Screw key={i} x={x} y={y} />)}
    <rect x="140" y="134" width="1520" height="54" rx="6" fill={NAVY} />
    <Txt x={165} y={170} s={26} a="start" w={700} c="#fff" letterSpacing=".02em">NETWORK THEOREMS TRAINER</Txt>
    <Txt x={1635} y={170} s={14.5} a="end" c="#C9D5E8">Thevenin · Norton · Superposition · Max. Power Transfer · Reciprocity · Tellegen</Txt>

    <Block x={140} y={210} w={380} h={250} t="REGULATED POWER SUPPLY" />
    <Txt x={200} y={352} s={14} w={700}>+5 V</Txt><Txt x={290} y={352} s={14} w={700}>+12 V</Txt><Txt x={380} y={352} s={14} w={700}>GND</Txt>
    <line x1="160" x2="500" y1="370" y2="370" stroke="#CDD3DD" strokeWidth="2" />
    <Txt x={160} y={395} s={12.5} a="start" w={700}>CONSTANT CURRENT SOURCE 3.2 mA</Txt>
    <Txt x={335} y={422} s={11} a="start" c="#56627A">Inbuilt regulated supply</Txt>

    <Block x={540} y={210} w={400} h={250} t="DIGITAL VOLTMETER 200 mV – 20 V" />
    <rect x="560" y="252" width="360" height="86" rx="5" fill="#0C0D10" /><rect x="568" y="260" width="344" height="70" rx="2" fill="#250606" />
    <Txt x={830} y={442} s={11}>+</Txt><Txt x={890} y={442} s={11}>COM</Txt>

    <Block x={960} y={210} w={400} h={250} t="DIGITAL AMMETER 200 µA – 200 mA" />
    <rect x="980" y="252" width="360" height="86" rx="5" fill="#0C0D10" /><rect x="988" y="260" width="344" height="70" rx="2" fill="#250606" />
    <Txt x={1250} y={442} s={11}>+</Txt><Txt x={1310} y={442} s={11}>COM</Txt>

    <Block x={1380} y={210} w={280} h={250} t="MAINS" />
    <Txt x={1520} y={334} s={13} w={700}>POWER</Txt>
    <Txt x={1500} y={374} s={11} a="start">ON</Txt>
    <circle cx="1555" cy="370" r="12" fill="#17181C" stroke="#55585F" /><circle cx="1552" cy="367" r="4" fill="#fff" opacity=".2" /><Txt x={1555} y={396} s={11}>FUSE</Txt>
    <Txt x={1520} y={422} s={11} c="#56627A">90–270 V AC, 50 Hz</Txt>

    {/* Thevenin */}
    <Block x={140} y={480} w={493} h={215} t="THEVENIN'S THEOREM" />
    <path {...wire} d="M200,598 V550 H236 M284,550 H361 M409,550 H541 M200,607 V655 H541 M320,550 V579 M320,627 V655" />
    <path {...wire} strokeDasharray="4 4" d="M565,550 H593 V579 M593,627 V655 H565" />
    <Batt x={200} y={602} /><ZigH x={260} y={550} /><ZigV x={320} y={603} /><ZigH x={385} y={550} /><ZigV x={593} y={603} />
    <Txt x={176} y={607}>V</Txt><Lab x={260} y={538} t="R1" /><Txt x={260} y={572} s={11}>1 kΩ</Txt><Txt x={340} y={598} a="start">R2</Txt><Txt x={332} y={613} s={11} a="start">1 kΩ</Txt><Txt x={385} y={538}>R3</Txt><Txt x={385} y={572} s={11}>470 Ω</Txt>
    <Txt x={553} y={534} w={700}>A</Txt><Txt x={553} y={682} w={700}>B</Txt><Txt x={612} y={600} a="middle">RL</Txt>

    {/* Superposition */}
    <Block x={653} y={480} w={494} h={215} t="SUPERPOSITION THEOREM" />
    <path {...wire} d="M723,598 V550 H793 M841,550 H959 M1007,550 H1077 V598 M723,607 V655 H1077 V607 M900,550 V563 M900,600 V613 M900,637 V655" />
    <Batt x={723} y={602} /><Batt x={1077} y={602} /><ZigH x={817} y={550} /><ZigH x={983} y={550} />
    <path {...wire} d="M900,613 l-9,4 18,6 -18,6 18,6 -9,2" />
    <Txt x={697} y={607}>V1</Txt><Txt x={1104} y={607}>V2</Txt><Txt x={693} y={532} s={10.5}>+12V</Txt><Txt x={1107} y={532} s={10.5}>+5V</Txt>
    <Txt x={817} y={538}>R1</Txt><Txt x={817} y={572} s={11}>1 kΩ</Txt><Txt x={983} y={538}>R2</Txt><Txt x={983} y={572} s={11}>2.2 kΩ</Txt><Txt x={922} y={622} a="start">R3</Txt><Txt x={922} y={637} s={11} a="start">1 kΩ</Txt>
    <Txt x={768} y={645} s={11}>S1</Txt><Txt x={1031} y={645} s={11}>S2</Txt>

    {/* Norton */}
    <Block x={1166} y={480} w={494} h={215} t="NORTON'S THEOREM" />
    <path {...wire} d="M1237,582 V550 H1343 M1391,550 H1568 M1237,624 V655 H1568 M1297,550 V579 M1297,627 V655 M1437,550 V579 M1437,627 V655" />
    <circle cx="1237" cy="603" r="21" fill="#EEF1F6" stroke={INK} strokeWidth="2" /><path {...wire} d="M1237,615 V593 M1231,599 L1237,591 L1243,599" />
    <ZigH x={1367} y={550} /><ZigV x={1297} y={603} /><ZigV x={1437} y={603} />
    <Txt x={1190} y={607}>3.2 mA</Txt><Txt x={1367} y={538}>R2</Txt><Txt x={1367} y={572} s={11}>1 kΩ</Txt><Txt x={1317} y={598} a="start">R1</Txt><Txt x={1309} y={613} s={11} a="start">1 kΩ</Txt><Txt x={1457} y={598} a="start">R3</Txt><Txt x={1449} y={613} s={11} a="start">2.2 kΩ</Txt><Txt x={1610} y={607}>I<tspan dy="3" fontSize="9">N</tspan></Txt>

    {/* Maximum power */}
    <Block x={140} y={715} w={493} h={215} t="MAXIMUM POWER TRANSFER" />
    <path {...wire} d="M210,828 V785 H266 M314,785 H458 M210,837 V890 H458 M430,785 V814 M430,862 V890" />
    <Batt x={210} y={832} /><ZigH x={290} y={785} /><ZigV x={430} y={838} /><path {...wire} d="M410,860 L450,816 M450,816 l-9,3 M450,816 l-2,9" />
    <Txt x={186} y={837}>V</Txt><Txt x={290} y={773}>Rs</Txt><Txt x={290} y={807} s={11}>1 kΩ</Txt><Txt x={442} y={833} a="start">RL</Txt><Txt x={442} y={848} s={11} a="start">0–2.2 kΩ</Txt>
    <Txt x={553} y={898} s={11}>LOAD RL</Txt>

    {/* Reciprocity */}
    <Block x={653} y={715} w={494} h={215} t="RECIPROCITY THEOREM" />
    <path {...wire} d="M725,785 H759 M807,785 H879 M927,785 H1075 M725,890 H1075 M843,785 V814 M843,862 V890 M963,785 V814 M963,862 V890" />
    <ZigH x={783} y={785} /><ZigH x={903} y={785} /><ZigV x={843} y={838} /><ZigV x={963} y={838} />
    <Txt x={713} y={769}>1</Txt><Txt x={713} y={918}>1′</Txt><Txt x={1087} y={769}>2</Txt><Txt x={1087} y={918}>2′</Txt>
    <Txt x={783} y={773}>R1</Txt><Txt x={783} y={807} s={11}>1 kΩ</Txt><Txt x={903} y={773}>R3</Txt><Txt x={903} y={807} s={11}>1 kΩ</Txt><Txt x={863} y={833} a="start">R2</Txt><Txt x={855} y={848} s={11} a="start">2.2 kΩ</Txt><Txt x={983} y={833} a="start">R4</Txt><Txt x={975} y={848} s={11} a="start">1 kΩ</Txt>

    {/* Tellegen */}
    <Block x={1166} y={715} w={494} h={215} t="TELLEGEN'S THEOREM" />
    <TeR x1={1301} y1={836} x2={1413} y2={773} l="R1" lx={1357} ly={792} /><TeR x1={1413} y1={773} x2={1525} y2={836} l="R2" lx={1469} ly={792} />
    <TeR x1={1301} y1={836} x2={1413} y2={899} l="R3" lx={1357} ly={855} /><TeR x1={1413} y1={899} x2={1525} y2={836} l="R4" lx={1469} ly={855} />
    <TeR x1={1413} y1={773} x2={1413} y2={899} l="R5" lx={1434} ly={840} />
    <Txt x={1281} y={841} w={700}>A</Txt><Txt x={1431} y={764} w={700}>B</Txt><Txt x={1545} y={841} w={700}>C</Txt><Txt x={1393} y={905} w={700}>D</Txt>
    <Txt x={1646} y={919} s={11} a="end" c="#56627A">Σ Vk·Ik = 0 for all branches</Txt>

    {SOCKETS.map((s) => <Socket key={s} id={s} />)}
  </g>
)

/* Copper tracks that show moving charge: [path, branch current name] */
const FLOWS = [
  ['M200,550 H236 M284,550 H320', 'th1'], ['M320,550 H361 M409,550 H541', 'th3'], ['M320,579 V550', 'th2'],
  ['M723,550 H793 M841,550 H900', 'sp1'], ['M1077,550 H1007 M959,550 H900', 'sp2'], ['M900,600 V613 M900,637 V655', 'sp3'],
  ['M1297,550 H1343 M1391,550 H1437', 'no2'], ['M1437,550 H1568', 'noL'],
  ['M210,785 H266 M314,785 H430', 'mpS'], ['M430,785 V814', 'mpL'],
  ['M725,785 H759 M807,785 H843', 'rc1'], ['M843,785 H879 M927,785 H963', 'rc3'],
]

const Display = ({ x, on, value, unit, over }) => {
  if (!on) return null
  const text = over ? '1' : value
  const parts = []
  let px = x
  ;[...text].forEach((ch, i) => {
    if (ch === '.') { parts.push(<circle key={i} cx={px - 11} cy={317} r="4" fill="#FF3B30" />); return }
    parts.push(<Seven key={i} x={px} y={272} ch={ch} s={23} c="#FF3B30" />); px += 45
  })
  return <g>{parts}<text x={x + 318} y={324} textAnchor="end" fontSize="18" fontWeight="700" fill="#FF6B5E" style={SANS}>{unit}</text></g>
}

function RangeKnob({ x, y, list, value, onPick, angles, labels }) {
  const d = useRef(null)
  const a = angles[value]
  return (
    <g>
      {labels.map(([tx, ty, anchor], i) => <text key={i} x={tx} y={ty} fontSize="12" textAnchor={anchor} fill={INK} style={{ ...SANS, cursor: 'pointer' }} onClick={() => onPick(i)}>{list[i].l.replace('µA', 'µA')}</text>)}
      {angles.map((b, i) => { const r = (b * Math.PI) / 180; return <line key={i} x1={x + Math.sin(r) * 29} y1={y - Math.cos(r) * 29} x2={x + Math.sin(r) * 35} y2={y - Math.cos(r) * 35} stroke={INK} strokeWidth="1.6" /> })}
      <g style={{ cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); d.current = { x: e.clientX, v: value, moved: false } }}
        onPointerMove={(e) => { if (!d.current) return; const s = Math.round((e.clientX - d.current.x) / 28); if (s) d.current.moved = true; if (d.current.moved) onPick(Math.max(0, Math.min(list.length - 1, d.current.v + s))) }}
        onPointerUp={() => { if (d.current && !d.current.moved) onPick((value + 1) % list.length); d.current = null }}>
        <circle cx={x} cy={y} r="27" fill="url(#g-silver)" stroke="#6C7380" />
        <circle cx={x} cy={y} r="20" fill="#26282E" stroke="#0B0C0F" />
        <g transform={`rotate(${a} ${x} ${y})`}><rect x={x - 2} y={y - 19} width="4" height="15" rx="2" fill="#fff" /></g>
      </g>
    </g>
  )
}
function PotKnob({ value, onChange }) {
  const x = 553, y = 838, d = useRef(null), u = value / 2200, a = -135 + 270 * u
  return (
    <g>
      {Array.from({ length: 11 }, (_, i) => { const r = ((-135 + 27 * i) * Math.PI) / 180; return <line key={i} x1={x + Math.sin(r) * 37} y1={y - Math.cos(r) * 37} x2={x + Math.sin(r) * 44} y2={y - Math.cos(r) * 44} stroke={INK} strokeWidth="1.4" /> })}
      <g style={{ cursor: 'grab', touchAction: 'none' }} role="slider" aria-label="Load resistance" aria-valuenow={value} aria-valuemin={0} aria-valuemax={2200}
        onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); d.current = { x: e.clientX, y: e.clientY, v: value } }}
        onPointerMove={(e) => { if (!d.current) return; const n = d.current.v + ((e.clientX - d.current.x) - (e.clientY - d.current.y)) * 8; onChange(Math.max(50, Math.min(2200, Math.round(n / 50) * 50))) }}
        onPointerUp={() => { d.current = null }}>
        <circle cx={x} cy={y} r="34" fill="url(#g-silver)" stroke="#6C7380" />
        <circle cx={x} cy={y} r="26" fill="#26282E" stroke="#0B0C0F" />
        <g transform={`rotate(${a} ${x} ${y})`}><rect x={x - 2.5} y={y - 25} width="5" height="18" rx="2" fill="#fff" /></g>
      </g>
      <text x={x} y={915} fontSize="12.5" fontWeight="700" textAnchor="middle" fill={INK} style={SANS}>{value} Ω</text>
    </g>
  )
}
function Stepper({ x, y, label, value, onStep }) {
  const Arrow = ({ dx, dir }) => (
    <g style={{ cursor: 'pointer' }} onClick={() => onStep(dir)} role="button" aria-label={`${label} ${dir > 0 ? 'up' : 'down'}`}>
      <rect x={x + dx - 13} y={y - 13} width="26" height="26" rx="3" fill={NAVY} />
      <path d={dir > 0 ? `M${x + dx - 4},${y - 6} l9,6 -9,6 z` : `M${x + dx + 4},${y - 6} l-9,6 9,6 z`} fill="#fff" />
    </g>
  )
  return <g><Txt x={x} y={y - 20} s={11.5} w={700}>{label}</Txt><rect x={x - 32} y={y - 13} width="64" height="26" fill="#fff" stroke="#AEB5C1" /><Txt x={x} y={y + 5} s={13.5} w={700}>{value}</Txt><Arrow dx={-46} dir={-1} /><Arrow dx={46} dir={1} /></g>
}
const Toggle = ({ x, on, onClick, label }) => (
  <g onClick={onClick} style={{ cursor: 'pointer' }} role="switch" aria-checked={on} aria-label={label}>
    <rect x={x - 15} y={585} width="30" height="42" rx="4" fill="#DDE1E7" stroke="#8E96A3" />
    <rect x={x - 5} y={590} width="10" height="32" rx="3" fill="#8E96A3" />
    <rect x={x - 9} y={on ? 590 : 606} width="18" height="17" rx="3" fill="url(#g-silver)" stroke="#555C68" />
    <text x={x} y={581} fontSize="9.5" textAnchor="middle" fill="#56627A" style={SANS}>{on ? 'SOURCE' : 'SHORT'}</text>
  </g>
)

const cordPath = ([x1, y1], [x2, y2]) => { const d = Math.hypot(x2 - x1, y2 - y1), sag = 22 + d * 0.1; return `M${x1},${y1} C${x1},${y1 + sag} ${x2},${y2 + sag} ${x2},${y2}` }

function Stage({ v, o, t, set }) {
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [hover, setHover] = useState(null)
  const pt = (e) => { const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svgRef.current.getScreenCTM().inverse()); return [q.x, q.y] }
  const near = (p, from) => { let best = null, bd = 24; SOCKETS.forEach((s) => { const d = Math.hypot(POS[s][0] - p[0], POS[s][1] - p[1]); if (s !== from && d < bd) { bd = d; best = s } }); return best }
  const move = (e) => { if (!drag) return; const p = pt(e); setHover(near(p, drag.from)); setDrag((d) => (d ? { ...d, to: p } : d)) }
  const up = (e) => {
    if (!drag) return
    const p = pt(e), h = near(p, drag.from)
    if (!h && Math.hypot(p[0] - POS[drag.from][0], p[1] - POS[drag.from][1]) < 12) {
      const last = [...v.cords].reverse().find((c) => c.includes(drag.from))
      if (last) set('cords', v.cords.filter((c) => c !== last))
    }
    if (h && !v.cords.some((c) => c.includes(h) && c.includes(drag.from))) set('cords', [...v.cords, [drag.from, h]])
    setDrag(null); setHover(null)
  }
  const step = (key, list, dir) => { const i = list.indexOf(v[key]); set(key, list[Math.max(0, Math.min(list.length - 1, i + dir))]) }
  const vr = DVM_R[v.vr], ir = DAM_R[v.ir]
  const shown = (x, r) => (x * r.m).toFixed(r.d)
  const led = (x, y, on, c) => <g>{on && <circle cx={x} cy={y} r="15" fill={c} opacity=".3" />}<circle cx={x} cy={y} r="7" fill={on ? c : '#9AA0AA'} /></g>
  return (
    <Svg vb={VB} svgRef={svgRef} onPointerMove={move} onPointerUp={up}>
      {STATIC}
      {v.on && FLOWS.map(([d, name], i) => {
        const I = o.s.cur[name] || 0
        return Math.abs(I) > 2e-6 && <path key={i} d={d} fill="none" stroke="#2F7DF6" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="0 16" strokeDashoffset={(I > 0 ? -1 : 1) * t * Math.min(60, 12 + Math.abs(I) * 6000)} pointerEvents="none" />
      })}

      {led(200, 270, v.on && !o.fuse, '#2FD16B')}{led(290, 270, v.on && !o.fuse, '#2FD16B')}{led(380, 270, false, '#2FD16B')}
      {led(1485, 370, v.on, '#FF3B30')}
      {o.fuse && <g><circle cx="1555" cy="370" r="20" fill="#FF3B30" opacity=".35" /><circle cx="1555" cy="370" r="10" fill="#FF3B30" /></g>}
      <Display x={592} on={v.on} value={shown(o.Vm, vr)} unit={vr.unit} over={o.vOver} />
      <Display x={1012} on={v.on} value={shown(o.Im, ir)} unit={ir.unit} over={o.iOver} />
      <RangeKnob x={630} y={410} list={DVM_R} value={v.vr} onPick={(i) => set('vr', i)} angles={[-90, 0, 90]} labels={[[596, 406, 'end'], [630, 362, 'middle'], [671, 406, 'start']]} />
      <RangeKnob x={1050} y={410} list={DAM_R} value={v.ir} onPick={(i) => set('ir', i)} angles={[-90, -28, 28, 90]} labels={[[1016, 406, 'end'], [1026, 368, 'middle'], [1073, 368, 'middle'], [1085, 406, 'start']]} />

      <g onClick={() => set('on', !v.on)} style={{ cursor: 'pointer' }} role="switch" aria-checked={v.on} aria-label="Mains power">
        <rect x="1480" y="260" width="80" height="56" rx="6" fill="#17181C" />
        <rect x={v.on ? 1488 : 1522} y="267" width="38" height="42" rx="3" fill={v.on ? '#D92D20' : '#7A1B14'} />
        <text x="1507" y="295" fontSize="14" textAnchor="middle" fill="#fff" opacity={v.on ? 1 : 0} style={SANS}>I</text>
        <text x={v.on ? 1540 : 1507} y="295" fontSize="14" textAnchor="middle" fill="#ddd" style={SANS}>O</text>
      </g>

      <Toggle x={768} on={v.s1} label="Switch S1" onClick={() => set('s1', !v.s1)} />
      <Toggle x={1031} on={v.s2} label="Switch S2" onClick={() => set('s2', !v.s2)} />
      <Stepper x={444} y={632} label="LOAD RL" value={loadText(v.RLt, 'OPEN')} onStep={(d) => step('RLt', TH_LOADS, d)} />
      <Stepper x={1520} y={629} label="LOAD RL" value={loadText(v.RLn, 'SHORT')} onStep={(d) => step('RLn', NO_LOADS, d)} />
      <PotKnob value={v.RLm} onChange={(x) => set('RLm', x)} />

      {v.cords.map((c) => {
        const a = POS[c[0]], b = POS[c[1]], d = cordPath(a, b), col = BLACK.has(c[0]) || BLACK.has(c[1]) ? '#17181C' : '#D92D20'
        const live = v.on && (c.includes('amP') || c.includes('amN')) && Math.abs(o.Im) > 2e-6
        return (
          <g key={c.join()} className="cord" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); set('cords', v.cords.filter((x) => x !== c)) }}>
            <path d={d} fill="none" stroke="transparent" strokeWidth="18" />
            <path d={d} fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="8" transform="translate(2,5)" />
            <path d={d} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round" />
            {live && <path d={d} fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" strokeDasharray="0 16" strokeDashoffset={-t * 30} />}
            {[a, b].map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r="10.5" fill={col} stroke="#000" strokeOpacity=".45" />)}
          </g>
        )
      })}
      {SOCKETS.map((s) => (
        <circle key={s} cx={POS[s][0]} cy={POS[s][1]} r="17" fill={hover === s || drag?.from === s ? 'rgba(79,195,255,.45)' : 'transparent'} style={{ cursor: 'crosshair', touchAction: 'none' }}
          onPointerEnter={() => { if (!drag) setHover(s) }} onPointerLeave={() => { if (!drag) setHover(null) }}
          onPointerDown={(e) => { e.stopPropagation(); svgRef.current.setPointerCapture?.(e.pointerId); setDrag({ from: s, to: pt(e) }) }} />
      ))}
      {drag && <path d={cordPath(POS[drag.from], drag.to)} fill="none" stroke="#4FC3FF" strokeWidth="7" strokeLinecap="round" pointerEvents="none" />}
    </Svg>
  )
}

/* ---- experiments ---- */
const act = (k, label, cords) => ({ k, type: 'action', label, run: (set) => set('cords', cords) })
const base = (cords, extra = {}) => () => ({ cords, on: true, s1: true, s2: true, vr: 2, ir: 2, RLt: 1000, RLn: 0, RLm: 1000, ...extra })
const panelOut = (fn) => (v) => { const o = compute(v); return { ...o, ...fn(v, o) } }
const noisy = (x) => wobble(x, 0.002)
const CHECK_POWER = 'Turn the mains switch on first.'
const FUSE = 'The supply is shorted and the fuse has tripped. Remove the shorting cord.'
const OVER_V = 'The voltmeter is over range. Turn its range knob up.', OVER_I = 'The ammeter is over range. Turn its range knob up.'
const noRange = (v, patch) => {
  const n = { ...v, ...patch }, o = compute(n)
  return { ...patch, vr: bestRange(DVM_R, o.Vm), ir: bestRange(DAM_R, o.Im) }
}
const meterRead = (o, v) => {
  const vr = DVM_R[v.vr], ir = DAM_R[v.ir]
  return [['Voltmeter', o.vWired && v.on ? (o.vOver ? 'Over' : (o.Vm * vr.m).toFixed(vr.d)) : '–', vr.unit], ['Ammeter', o.iWired && v.on ? (o.iOver ? 'Over' : (o.Im * ir.m).toFixed(ir.d)) : '–', ir.unit]]
}
const COMMON = { Stage, wide: true }

const SP = [['dvmP', 'sp.m'], ['dvmN', 'sp.b'], ['amP', 'sp.t'], ['amN', 'sp.m']]
const superpos = {
  ...COMMON, id: 'superposition', title: 'Superposition theorem', short: 'Each source acting alone',
  aim: 'Verify that the current in a branch equals the algebraic sum of the currents due to each source acting alone.',
  formula: 'I_both = I_V₁ alone + I_V₂ alone',
  principle: 'In a linear network each source can be considered separately with the other replaced by its internal resistance, here a short circuit made by S1 or S2.',
  steps: ['Patch the ammeter between the two centre sockets, so it is in series with R3.', 'Set S1 to SOURCE and S2 to SHORT, then record.', 'Set S1 to SHORT and S2 to SOURCE, then record.', 'Set both to SOURCE, record, and compare the sum.'],
  controls: [act('w', 'Wire this experiment', SP), act('x', 'Remove all cords', [])], state: base(SP),
  out: panelOut((v, o) => ({ I2: o.Im })),
  read: (v, o) => meterRead(o, v),
  columns: [['c', 'Sources', 0], ['I', 'I (mA)', 3]],
  sample: (v, o) => {
    if (o.fuse) return { error: FUSE }
    if (!v.on) return { error: CHECK_POWER }
    if (!across(o.s, 'sp.t', 'sp.m', 'amP', 'amN')) return { error: 'Patch the ammeter between the two centre sockets, in series with R3.' }
    if (o.iOver) return { error: OVER_I }
    return { c: `${v.s1 ? 'V₁' : ''}${v.s1 && v.s2 ? ' + ' : ''}${v.s2 ? 'V₂' : ''}` || 'None', I: noisy(o.Im * 1000), key: (v.s1 ? 1 : 0) + (v.s2 ? 2 : 0) }
  },
  sweep: { list: (v) => [{ s1: true, s2: false }, { s1: false, s2: true }, { s1: true, s2: true }].map((p) => noRange(v, p)) },
  analyse: (r) => {
    const g = (k) => r.filter((x) => x.key === k).pop()
    if (!g(1) || !g(2) || !g(3)) return [['Status', 'Record V₁ alone, V₂ alone and both', '']]
    return [['I (V₁) + I (V₂)', g(1).I + g(2).I, 'mA', g(3).I], ['I (both active)', g(3).I, 'mA']]
  },
  tip: 'Drag between sockets to patch and click a cord to remove it. S1 and S2 replace a source with a short circuit.',
}

const TH = [['dvmP', 'th.A'], ['dvmN', 'th.B']]
const TH_VOC = 6, TH_R = 970
const lCols = [['RL', 'R_L (Ω)', 0], ['IL', 'I_L (mA)', 3], ['inv', '1/I_L (1/mA)', 4]]
const lGraph = { x: 'RL', y: 'inv', xl: 'Load resistance R_L (Ω)', yl: '1 / I_L (1/mA)', fit: true }
const thExp = {
  ...COMMON, id: 'thevenin', title: "Thevenin's theorem", short: 'V_TH and R_TH',
  aim: 'Find the Thevenin equivalent of the network at terminals A–B and verify it against load measurements.',
  formula: 'I_L = V_TH / (R_TH + R_L)',
  principle: 'Any linear two-terminal network behaves like one voltage source in series with one resistance. With the load open, the voltmeter reads V_TH directly. A plot of 1/I_L against R_L gives both values.',
  steps: ['Patch the voltmeter across A and B.', 'Set LOAD RL to OPEN and note V_TH.', 'Step through the loads and record each one. The load current is V_AB / R_L.', 'Plot 1/I_L against R_L and compare with the calculated values.'],
  controls: [act('w', 'Wire this experiment', TH), act('x', 'Remove all cords', [])], state: base(TH),
  out: panelOut((v, o) => ({ IL: v.RLt ? o.Vm / v.RLt : 0 })),
  read: (v, o) => [...meterRead(o, v), ['Load current', v.RLt && o.vWired ? ((o.Vm / v.RLt) * 1000).toFixed(3) : '–', 'mA']],
  columns: lCols,
  sample: (v, o) => {
    if (!v.on) return { error: CHECK_POWER }
    if (!across(o.s, 'th.A', 'th.B', 'dvmP', 'dvmN')) return { error: 'Patch the voltmeter across A and B.' }
    if (!v.RLt) return { error: 'Set a load with the LOAD RL arrows. OPEN gives V_TH only.' }
    if (o.vOver) return { error: OVER_V }
    const IL = jitter((Math.abs(o.Vm) / v.RLt) * 1000, 0.002)
    return { RL: v.RLt, IL, inv: 1 / IL }
  },
  sweep: { list: (v) => LOADS.map((RLt) => noRange(v, { RLt })) },
  graph: lGraph,
  analyse: (r) => { const f = fit(r, 'RL', 'inv'); return f && [['V_TH (measured)', 1 / f.m / 1000, 'V', TH_VOC], ['R_TH (measured)', f.c / f.m, 'Ω', TH_R]] },
  tip: 'The source and resistors are fixed on this kit. LOAD RL sits across A and B.',
}

const NO = [['amP', 'no.P'], ['amN', 'no.N']]
const NO_I = 1.6, NO_R = (2000 * 2200) / 4200
const nortonExp = {
  ...COMMON, id: 'norton', title: "Norton's theorem", short: 'I_N and R_N',
  aim: 'Find the Norton equivalent of the network and verify it against load measurements.',
  formula: 'I_L = I_N R_N / (R_N + R_L)',
  principle: 'The same kind of two-terminal network can be represented as a current source in parallel with one resistance. The short-circuit current gives I_N.',
  steps: ['Patch the ammeter across the output sockets.', 'Set LOAD RL to SHORT and note I_N.', 'Step through the loads and record the current.', 'Plot 1/I_L against R_L and find I_N and R_N.'],
  controls: [act('w', 'Wire this experiment', NO), act('x', 'Remove all cords', [])], state: base(NO, { ir: 1 }),
  out: panelOut((v, o) => ({ IL: o.Im })),
  read: (v, o) => meterRead(o, v),
  columns: lCols,
  sample: (v, o) => {
    if (!v.on) return { error: CHECK_POWER }
    if (!across(o.s, 'no.P', 'no.N', 'amP', 'amN')) return { error: 'Patch the ammeter across the two output sockets.' }
    if (o.iOver) return { error: OVER_I }
    const IL = jitter(Math.abs(o.Im) * 1000, 0.002)
    return { RL: v.RLn, IL, inv: 1 / IL }
  },
  sweep: { list: (v) => NO_LOADS.map((RLn) => noRange(v, { RLn })) },
  graph: lGraph,
  analyse: (r) => { const f = fit(r, 'RL', 'inv'); return f && [['I_N (measured)', 1 / f.c, 'mA', NO_I], ['R_N (measured)', f.c / f.m, 'Ω', NO_R]] },
  tip: 'LOAD RL is in series with the output sockets, so the ammeter reads the load current. SHORT gives I_N.',
}

const MP = [['dvmP', 'mp.P'], ['dvmN', 'mp.N']]
const powerAt = (R) => (144 * R * 1000) / (1000 + R) ** 2
const mptExp = {
  ...COMMON, id: 'maximum-power', title: 'Maximum power transfer', short: 'P peaks at R_L = R_TH',
  aim: 'Show that a source delivers maximum power when the load equals the source resistance.',
  formula: 'P = V² R_L / (R_s + R_L)²     maximum at R_L = R_s',
  principle: 'Too small a load gives high current but little voltage, and too large a load the reverse. Power peaks when the load matches the 1 kΩ source resistance.',
  steps: ['Patch the voltmeter across the load sockets.', 'Turn the LOAD RL knob and record the voltage.', 'Each reading gives P = V² / R_L.', 'Plot power against load and locate the peak.'],
  controls: [act('w', 'Wire this experiment', MP), act('x', 'Remove all cords', [])], state: base(MP),
  out: panelOut((v, o) => ({ IL: o.Vm / Math.max(v.RLm, 1), P: (o.Vm * o.Vm) / Math.max(v.RLm, 1) })),
  read: (v, o) => [...meterRead(o, v), ['Load power', o.vWired ? (o.P * 1000).toFixed(2) : '–', 'mW']],
  columns: [['RL', 'R_L (Ω)', 0], ['IL', 'I_L (mA)', 3], ['P', 'P (mW)', 3]],
  sample: (v, o) => {
    if (!v.on) return { error: CHECK_POWER }
    if (!across(o.s, 'mp.P', 'mp.N', 'dvmP', 'dvmN')) return { error: 'Patch the voltmeter across the two load sockets.' }
    if (o.vOver) return { error: OVER_V }
    const V = jitter(Math.abs(o.Vm), 0.0006), IL = (V / v.RLm) * 1000
    return { RL: v.RLm, IL, P: (V * V) / v.RLm * 1000 }
  },
  sweep: { list: (v) => Array.from({ length: 43 }, (_, i) => noRange(v, { RLm: 100 + i * 50 })) },
  need: 8,
  graph: { x: 'RL', y: 'P', xl: 'Load resistance R_L (Ω)', yl: 'Power (mW)', curve: () => curve(powerAt, 50, 2200), live: (v) => [v.RLm, powerAt(v.RLm)] },
  analyse: (r) => { const m = r.reduce((a, b) => (b.P > a.P ? b : a)); return [['Load at peak', m.RL, 'Ω', 1000], ['Peak power', m.P, 'mW', 36]] },
}

const RC_A = [['p12', 'rc.1'], ['gnd', 'rc.1p'], ['amP', 'rc.2'], ['amN', 'rc.2p']]
const RC_B = [['p12', 'rc.2'], ['gnd', 'rc.2p'], ['amP', 'rc.1'], ['amN', 'rc.1p']]
const portInfo = (o) => {
  const { s } = o
  const fed = (a, b) => (s.same('p12', a) || s.same('p5', a)) && s.same('gnd', b)
  const metered = (a, b) => across(s, a, b, 'amP', 'amN') !== 0
  if (fed('rc.1', 'rc.1p') && metered('rc.2', 'rc.2p')) return 1
  if (fed('rc.2', 'rc.2p') && metered('rc.1', 'rc.1p')) return 2
  return 0
}
const reciprocity = {
  ...COMMON, id: 'reciprocity', title: 'Reciprocity theorem', short: 'Swap source and ammeter',
  aim: 'Verify that exchanging the source and the ammeter in a linear network leaves the current unchanged.',
  formula: 'I₂ (source at port 1) = I₁ (source at port 2)',
  principle: 'In a linear bilateral network the transfer resistance is the same in both directions.',
  steps: ['Patch +12 V and GND to port 1, and the ammeter across port 2.', 'Record the current.', 'Exchange the source and the ammeter.', 'Record again and compare.'],
  controls: [act('w', 'Source at port 1', RC_A), act('y', 'Source at port 2', RC_B), act('x', 'Remove all cords', [])], state: base(RC_A, { ir: 1 }),
  out: panelOut((v, o) => { const p = portInfo(o); return { port: p, I: Math.abs(o.Im) } }),
  read: (v, o) => [...meterRead(o, v), ['Source at', o.port ? `Port ${o.port}` : 'Not patched', '']],
  columns: [['c', 'Source at', 0], ['I', 'I (mA)', 3]],
  sample: (v, o) => {
    if (!v.on) return { error: CHECK_POWER }
    if (!o.port) return { error: 'Patch a supply and GND to one port, and the ammeter across the other.' }
    if (o.iOver) return { error: OVER_I }
    return { c: `Port ${o.port}`, I: noisy(Math.abs(o.Im) * 1000), sw: o.port === 2 }
  },
  sweep: { list: (v) => [noRange(v, { cords: RC_A }), noRange(v, { cords: RC_B })] },
  need: 2,
  analyse: (r) => { const a = r.filter((x) => !x.sw).pop(), b = r.filter((x) => x.sw).pop(); return a && b ? [['I with source at port 1', a.I, 'mA'], ['I with source at port 2', b.I, 'mA', a.I]] : [['Status', 'Record both positions', '']] },
}

const TE_FEED = [['p12', 'amP'], ['amN', 'te.A'], ['te.C', 'gnd']]
const TE = [...TE_FEED, ['dvmP', 'te.A'], ['dvmN', 'te.B']]
const BRANCHES = [['R1', 'te.A', 'te.B'], ['R2', 'te.B', 'te.C'], ['R3', 'te.A', 'te.D'], ['R4', 'te.D', 'te.C'], ['R5', 'te.B', 'te.D'], ['Source', 'te.A', 'te.C']]
const teBranch = (o) => { for (const [n, a, b] of BRANCHES) { const sg = across(o.s, a, b, 'dvmP', 'dvmN'); if (sg) return { n, sg } } return null }
const tellegen = {
  ...COMMON, id: 'tellegen', title: "Tellegen's theorem", short: 'Σ v·i = 0',
  aim: 'Verify that the sum of the powers over all branches of a network is zero.',
  formula: 'Σ vₖ iₖ = 0',
  principle: 'Follows directly from Kirchhoff’s laws: the power delivered by the source is exactly absorbed by the resistors.',
  steps: ['Feed the bridge from +12 V at A through the ammeter, and return C to GND.', 'Patch the voltmeter across one branch and record.', 'Move the voltmeter to every resistor and across A–C for the source.', 'Add all six powers.'],
  controls: [act('w', 'Wire this experiment', TE), act('x', 'Remove all cords', [])], state: base(TE),
  out: panelOut((v, o) => {
    const br = teBranch(o)
    if (!br) return { branch: null, vk: 0, ik: 0 }
    const vk = o.Vm * br.sg
    return { branch: br.n, vk, ik: br.n === 'Source' ? -Math.abs(o.Im) : vk / TE_R[br.n] }
  }),
  read: (v, o) => [...meterRead(o, v), ['Branch', o.branch || 'Patch the voltmeter', ''], ['v·i', o.branch ? (o.vk * o.ik * 1000).toFixed(3) : '–', 'mW']],
  columns: [['b', 'Branch', 0], ['vk', 'v (V)', 3], ['ik', 'i (mA)', 3], ['p', 'v·i (mW)', 3]],
  sample: (v, o) => {
    if (!v.on) return { error: CHECK_POWER }
    if (!o.iWired || !o.s.same('amN', 'te.A')) return { error: 'Feed the bridge at A through the ammeter first.' }
    if (!o.branch) return { error: 'Patch the voltmeter across one branch of the bridge.' }
    if (o.vOver) return { error: OVER_V }
    if (o.iOver) return { error: OVER_I }
    return { b: o.branch, vk: o.vk, ik: o.ik * 1000, p: o.vk * o.ik * 1000 }
  },
  sweep: { list: (v) => BRANCHES.map(([, a, b]) => noRange(v, { cords: [...TE_FEED, ['dvmP', a], ['dvmN', b]] })) },
  need: 6,
  analyse: (r) => {
    const set = new Map(r.map((x) => [x.b, x.p]))
    if (set.size < 6) return [['Status', 'Measure all six branches', '']]
    return [['Σ v·i', [...set.values()].reduce((a, b) => a + b, 0).toFixed(3), 'mW'], ['Power supplied', Math.abs(set.get('Source')), 'mW']]
  },
  tip: 'The current in each resistor is taken as v / R using the marked values. The source current comes from the ammeter.',
}

export const networkPanelKit = [superpos, thExp, nortonExp, mptExp, reciprocity, tellegen]
