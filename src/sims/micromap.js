import { clamp, TAU } from '../lib/math'

/* Connects each kit to a particle-level scene. Each function receives the
   control values, the computed outputs and the simulation time. */

export const conductor = (i, temp = 0.3, title = 'Electrons in the conductor', note = 'Electrons drift between the vibrating copper ions. The drift speed follows the current.') => ({ scene: 'conductor', i: clamp(i, -1.2, 1.2), temp, title, note })
const logic = (bits, names, note = 'Logic 1 is a packet of charge on the track. Logic 0 leaves the track empty.') => ({ scene: 'logic', bits: bits.map((b) => (b ? 1 : 0)), names, title: 'Charge on the signal lines', note })
const air = (objs, note = 'Air molecules strike the moving body, which is what gradually damps its motion.') => ({ scene: 'gas', objs, title: 'Air around the moving body', note })
const interfere = (phase, vis = 1, note = 'Light from the two paths meets at the eyepiece. In step it brightens, out of step it cancels.') => ({ scene: 'interfere', phase, vis, title: 'Photons from the two paths', note })
const ac = (t, a = 1) => a * Math.sin(t * 3.4)
const mag = (m, disorder, domains = true, note = 'Each arrow is a group of atomic spins. Regions flip into line as the field grows.') => ({ scene: 'spins', m, disorder, domains, title: 'Magnetic moments in the material', note })
const fibre = (on, bend, color, note = 'Light bounces along the core by total internal reflection.') => ({ scene: 'fibre', on, bend, color, title: 'Photons in the fibre', note })

const mech = {
  'simple-pendulum': (v, o, t) => { const c = Math.cos((TAU * t) / o.T); return air([{ x: 0.5 + 0.3 * c, y: 0.5, r: 24, vx: -Math.sin((TAU * t) / o.T) * 200 }]) },
  'compound-pendulum': (v, o, t) => { const c = o.valid ? Math.cos((TAU * t) / o.T) : 0; return air([{ x: 0.5 + 0.3 * c, y: 0.5, r: 24 }]) },
  'radius-of-gyration': (v, o, t) => { const c = o.valid ? Math.cos((TAU * t) / o.T) : 0; return air([{ x: 0.5 + 0.3 * c, y: 0.5, r: 24 }]) },
  'free-fall': (v, o, t) => { const u = clamp((t % (o.tf * 7 + 0.7)) / (o.tf * 7), 0, 1); return air([{ x: 0.5, y: 0.1 + 0.8 * u * u, r: 20 }], 'As the ball falls it pushes through the air molecules.') },
}
const coupledMotion = (o, t) => {
  const { a, b } = o.c
  if (o.mode === 'in') return [Math.cos(a * t), Math.cos(a * t)]
  if (o.mode === 'anti') return [Math.cos(b * t), -Math.cos(b * t)]
  return [0.5 * (Math.cos(a * t) + Math.cos(b * t)), 0.5 * (Math.cos(a * t) - Math.cos(b * t))]
}
const coupledFn = (v, o, t) => { const [p, q] = coupledMotion(o, t); return air([{ x: 0.28 + 0.15 * p, y: 0.5, r: 22 }, { x: 0.72 + 0.15 * q, y: 0.5, r: 22 }], 'Both bobs move through the same air. The spring passes energy between them.') }

const brewsterFn = {
  'brewster-angle': (v, o) => ({ scene: 'reflect', th: (v.th * Math.PI) / 180, n: v.n, R: clamp(o.I / 40, 0, 0.9), phiP: v.phi < 45, title: 'Photons at the glass surface', note: 'Electrons in the glass shake with the light and re-radiate it. At the Brewster angle p-polarised light has almost no reflected photons.' }),
  'malus-law': (v) => ({ scene: 'polarize', a: (v.phi * Math.PI) / 180, T: Math.cos((v.phi * Math.PI) / 180) ** 2, title: 'Photons meeting the polarizer', note: 'Each photon passes with probability cos²θ, so the detector count follows Malus’s law.' }),
}
const LAMBDA = 589.3
const michelson = {
  'sodium-wavelength': (v, o) => interfere((TAU * 2 * o.d * 1000) / LAMBDA),
  'sodium-doublet': (v, o) => interfere((TAU * 2 * o.d * 1000) / LAMBDA, o.V, 'The two sodium lines drift in and out of step, so the fringes fade and return.'),
  'thin-glass-ri': (v, o) => interfere(TAU * o.path, 1, 'The glass sheet slows light in one arm and shifts its phase.'),
}
const hallFn = (v, o) => ({ scene: 'hall', I: clamp((v.Ip ?? 5) / 14, 0, 1.4), B: clamp(o.B, -1.1, 1.1), title: 'Holes inside the germanium crystal', note: 'The field pushes moving holes to one edge. The charge that builds up there is the Hall voltage.' })
const bhFn = (mat, hc = 0.3) => (v, o, t) => {
  const amp = v.n === undefined ? clamp(v.I, 0.1, 1) : 0.8 ** v.n
  const H = Math.sin(((t * 0.5) % 1) * TAU), lag = Math.sin(((t * 0.5) % 1) * TAU - hc)
  return mag(amp * lag * 1.2 * (Math.abs(H) + 0.3), 0.06)
}
const quinckeFn = {
  'surface-tension': (v, o) => ({ scene: 'surface', rise: clamp(o.h * 4, 2, 70), label: `${o.h.toFixed(2)} mm`, title: 'Liquid molecules in the narrow limb', note: 'Molecules at the surface are pulled up the glass wall, lifting the column until its weight balances the pull.' }),
  'magnetic-susceptibility': (v, o) => mag(clamp(o.B / 0.6, 0, 1), 0.55, false, 'Paramagnetic ions in solution partly line up with the field and are drawn into the gap.'),
}
const dielectricFn = {
  'polar-liquid': (v) => ({ scene: 'dipoles', E: 0.55, fill: v.h / 150, title: 'Polar molecules in the field', note: 'The molecules turn to line up with the field between the cylinders, which raises the capacitance.' }),
  'solid-dielectric': (v) => ({ scene: 'dipoles', E: clamp(1.4 / v.d, 0.1, 0.8), title: 'Atoms polarised in the sample', note: 'The field slightly separates the charges in each atom. A smaller gap gives a stronger effect.' }),
}
const ultrasound = (standing) => (v, o, t) => {
  if (standing) {
    const lam = (v.f === 2 ? 0.74 : 0.99)
    return { scene: 'sound', standing: true, lambda: 96, amp: clamp(o.I / 100, 0.4, 1), reflector: clamp(90 + v.d * 230, 40, 790), title: 'Liquid molecules at the crystal', note: `Molecules pile up and spread out in a standing wave. The wavelength here is about ${lam.toFixed(2)} mm.` }
  }
  void t
  return { scene: 'sound', lambda: 120, amp: 0.8, title: 'Air molecules in the sound wave', note: 'Molecules shuffle back and forth along the wave. They pass on the pressure without travelling with it.' }
}
const zeemanFn = (v, o) => ({ scene: 'levels', B: clamp(o.B / 1.28, 0, 1), show: v.pol === 'sigma' ? [0, 2] : v.pol === 'pi' ? [1] : [0, 1, 2], title: 'Atomic energy levels in the field', note: 'The field splits the upper level. Electrons dropping from the split levels emit photons of slightly different colour.' })
const milli = (v, o) => ({ scene: 'millikan', v: o.vel / Math.max(o.vf, 1e-9), n: o.n, field: v.on ? v.V / o.Vb : 0, title: 'One oil drop between the plates', note: 'Extra electrons on the drop feel the electric force qE, which balances gravity when the drop stops moving.' })
const fhFn = (v) => ({ scene: 'franck', V: v.V, Ex: 18.7, title: 'Electrons colliding with neon atoms', note: 'Electrons gain energy from the field. At 18.7 eV a collision excites a neon atom, which glows, and the electron starts again.' })

const am = {
  'dsb-fc': (v, o, t) => conductor(Math.sin(t * 9) * (1 + o.m * Math.sin(t * 1.2)) * 0.55, 0.25, 'Electrons in the antenna', 'Electrons surge back and forth at the carrier rate, in bursts that follow the audio.'),
  'dsb-sc': (v, o, t) => conductor(Math.sin(t * 9) * Math.sin(t * 1.2), 0.25, 'Electrons in the antenna', 'With no carrier, the electron motion falls to zero whenever the audio crosses zero.'),
  'ssb-sc': (v, o, t) => conductor(Math.sin(t * 7) * 0.8, 0.25, 'Electrons in the filter output', 'A single sideband gives a steady oscillation at one frequency.'),
  'ssb-demodulation': (v, o, t) => conductor(Math.sin(t * 6 * (o.fo / 1000 + 0.2)) * 0.8, 0.25, 'Electrons in the speaker coil', 'The recovered tone drives the speaker. A BFO offset changes how fast the electrons swing, so the pitch moves.'),
}
const faultFn = (v, o, t) => conductor(o.ok ? Math.sin(t * 6) * 0.8 : 0, 0.25, 'Electrons at the test point', 'A faulty stage stops the signal, so the electrons stop surging.')
const lamCol = (v) => (v.l === 950 ? '#8B5CF6' : '#E5484D')
const ofc = {
  'numerical-aperture': (v) => fibre(1, 0, lamCol(v)),
  'bending-loss': (v, o) => fibre(1, clamp(30 / v.R, 0, 1.6), lamCol(v), 'On a tight bend, some rays strike the wall too steeply and escape.'),
  'propagation-loss': (v) => fibre(1 / (1 + v.c * 0.4), 0, lamCol(v)),
  'led-vi': (v, o) => ({ scene: 'junction', mode: 'led', i: clamp(o.I / 30, 0, 1.2), color: lamCol(v), title: 'Inside the LED junction', note: 'Electrons and holes meet at the junction and release their energy as photons.' }),
  photodetector: (v) => ({ scene: 'junction', mode: 'detect', i: clamp(v.P / 400, 0, 1.2), color: lamCol(v), title: 'Inside the photodetector', note: 'Each absorbed photon frees an electron and a hole, which are swept apart as photocurrent.' }),
  'am-fm-pwm-link': () => fibre(0.9, 0, '#E5484D'),
  'rs232-duplex': () => fibre(0.9, 0, '#8B5CF6', 'Each bit is a burst of light. A second fibre carries data in the other direction.'),
  'fault-diagnosis': faultFn,
}

/** code -> experiment id -> (v, o, t) => scene settings */
const byExp = {
  'PhyUGEx-2': mech,
  'PhyUGEx-11': { '*': coupledFn },
  'PhyUGEx-35': {
    'air-wedge-thickness': (v, o) => interfere((TAU * o.x) / (o.beta * 1000)),
    'newtons-rings': (v) => interfere(v.n * TAU + Math.PI, 1, 'The air film between lens and plate changes thickness, so ring by ring the waves fall in and out of step.'),
    spherometer: (v, o) => ({ scene: 'contact', gap: Math.max(0, o.gap) / 3, touch: o.touch, title: 'Atoms at the screw tip', note: 'The screw tip comes down until its atoms meet the atoms of the lens.' }),
  },
  'PhyUGEx-44': {
    superposition: (v, o) => conductor(o.I2 * 500),
    thevenin: (v, o, t) => conductor(v.on ? o.IL * 200 : 0, 0.3, undefined, t >= 0 ? undefined : ''),
    norton: (v, o) => conductor(v.on ? o.IL * 200 : 0),
    'maximum-power': (v, o) => conductor(v.on ? o.IL * 200 : 0, clamp(o.P * 30, 0.1, 1), 'Electrons heating the load', 'Collisions with the ions turn the electrons’ energy into heat. The hottest load is the one taking maximum power.'),
    reciprocity: (v, o) => conductor((v.swap ? -1 : 1) * o.I * 200),
    tellegen: (v, o) => conductor(o.ik * 300),
  },
  'PhyUGEx-48': brewsterFn, 'PhyPGEx-18': brewsterFn,
  'PhyUGEx-74': { '*': (v, o) => ({ scene: 'beam', net: clamp(o.net / 12, -1, 1), E: clamp(v.Vy / 40, 0, 1), B: clamp(o.B / 2e-4, 0, 1), title: 'Electrons in the CRT beam', note: 'The electric field pushes the beam one way and the magnetic field pushes it the other.' }) },
  'PhyUGEx-80': michelson, 'PhyPGEx-20': michelson,
  'PhyUGEx-98': { '*': hallFn },
  'PhyUGEx-101': { '*': (v) => conductor(v.I / 20 + 0.1, clamp((v.T - 20) / 75, 0, 1), 'Electrons scattering in copper', 'Heating makes the ions vibrate harder. Electrons collide more often and resistance rises.') },
  'PhyUGEx-105': dielectricFn,
  'PhyUGEx-107': { '*': bhFn() }, 'PhyPGEx-62': { 'hard-material': bhFn('hard', 0.55), 'soft-material': bhFn('soft', 0.12), '*': bhFn() },
  'PhyUGEx-161': quinckeFn,
  'PhyUGEx-201': { '*': (v) => ({ scene: 'heat', wave: true, k: 1, w: (TAU / v.P) * 24, decay: 2.4, title: 'Heat waves through the copper atoms', note: 'Atoms near the heater shake hardest. The vibration spreads along the rod, weaker and later with distance.' }) },
  'PhyUGEx-214': { '*': (v, o, t) => conductor(clamp(o.Vp / 1.8, 0.1, 1.2) * Math.sin((t % 2.4) * 3.9) * (t % 2.4 < 1.6 ? 1 : 0), 0.25, 'Electrons in the coil', 'The changing magnetic flux pushes electrons one way, then the other, as the magnet passes.') },
  'PhyUGEx-242': { 'full-adder': (v, o) => logic([v.A, v.B, v.C, o.S, o.Co], ['A', 'B', 'Cin', 'Sum', 'Cout']), 'full-subtractor': (v, o) => logic([v.A, v.B, v.C, o.D, o.Bo], ['A', 'B', 'Bin', 'Diff', 'Bout']) },
  'PhyUGEx-250': {
    'seebeck-effect': (v, o) => ({ scene: 'heat', hot: clamp(v.Th / 90, 0, 1), cold: clamp(v.Tc / 90, 0, 1), carriers: clamp(o.dT / 40, 0.05, 1), title: 'Carriers moving from hot to cold', note: 'Carriers at the hot end have more energy and diffuse toward the cold end. That build-up is the Seebeck voltage.' }),
    'peltier-effect': (v, o) => ({ scene: 'heat', hot: 0.5 + clamp(o.dT / 30, 0, 0.5) * (v.rev ? -1 : 1), cold: 0.5 - clamp(o.dT / 30, 0, 0.5) * (v.rev ? -1 : 1), carriers: clamp(o.I / 3, 0, 1) * (v.rev ? -1 : 1), title: 'Carriers pumping heat', note: 'Current carries heat from one side to the other. Reversing the current swaps hot and cold.' }),
  },
  'PhyUGEx-256': { '*': fhFn }, 'PhyPGEx-17': { '*': fhFn },
  'PhyUGEx-262': { '*': (v, o, t) => conductor(ac(t, 0.9), 0.25, 'Electrons in the signal lines', 'The two signals push electrons to and fro, and that motion steers the display spot.') },
  'PhyUGEx-268': { '*': (v, o, t) => conductor(Math.sin(t * 5) * clamp(Math.abs((o.vo ?? o.ideal ?? 5)) / 12, 0.1, 1.1), 0.25, 'Electrons at the op-amp output', 'The output stage pushes electrons into the load to match the feedback condition.') },
  'PhyUGEq-1': { '*': (v, o) => conductor(clamp(o.I / 2, 0, 1.2), clamp(o.P / 60, 0.1, 1), 'Electrons in the output lead', 'A heavier load means more current, so electrons drift faster and the lead warms up.') },
  'PhyPGEx-32': { 'ultrasound-characteristics': ultrasound(false), 'ultrasonic-distance': ultrasound(false), 'object-detection': ultrasound(false), 'velocity-liquid': ultrasound(true), compressibility: ultrasound(true) },
  'PhyPGEx-61': { '*': (v) => mag(0.75, clamp((v.T / 78) ** 3 * 0.8, 0.03, 1), false, 'Heat scrambles the atomic moments. At the Curie temperature the alignment is lost.') },
  'PhyPGEx-103': { '*': zeemanFn },
  'PhyPGEx-114': { '*': milli },
  'EleEq-37': { ...am, 'fault-diagnosis': faultFn }, 'EleEq-47': ofc,
}

export const microFor = (code, exp) => {
  if (exp.micro) return exp.micro
  const g = byExp[code]
  const fn = g && (g[exp.id] || g['*'])
  if (!fn) return undefined
  return (v, o, t) => fn(v, o, t)
}
