import specs from './specs.json'
import { barPendulum, coupledOsc } from '../sims/mechanics'
import { airWedge, brewster, michelsonNa, michelsonGlass } from '../sims/optics'
import { lissajous, opAmp, psuKit } from '../sims/electrical'
import { networkPanelKit } from '../sims/networkpanel'
import { lcrPanelKit } from '../sims/lcrpanel'
import { microFor } from '../sims/micromap'
import { hallKit, bhCro, bhHardSoft, faraday, emThomson, quincke, zeeman } from '../sims/magnetism'
import { fermi, curieKit, angstrom, seebeck, dielectric, franckHertz } from '../sims/thermal'
import { millikan, ultrasonic } from '../sims/modern'
import { adderPanelKit } from '../sims/adderpanel'
import { amKit, ofcKit } from '../sims/comm'

export const DOMAINS = {
  Mechanics: '#C2410C',
  Optics: '#7C3AED',
  Electrical: '#0369A1',
  Magnetism: '#BE123C',
  Thermal: '#B45309',
  'Modern Physics': '#0F766E',
  Digital: '#4338CA',
  Communication: '#A21CAF',
  Equipment: '#475569',
}

const levelOf = (code) => (code.includes('UGEx') ? 'UG Lab' : code.includes('PGEx') ? 'PG Lab' : 'Equipment')

/** The sample items, in document order. Specifications come from the Word file. */
const defs = [
  ['PhyUGEx-2', 'Bar Pendulum', 'Mechanics', 'Measure g with simple, compound and free-fall methods on one microcontroller-timed stand.', barPendulum],
  ['PhyUGEx-11', 'Coupled Oscillator', 'Mechanics', 'Two 1 m pendulums joined by a spring, logging normal modes and beats on a dashboard.', coupledOsc],
  ['PhyUGEx-35', 'Air Wedge', 'Optics', 'A compact sodium-lit unit for measuring tiny thicknesses from straight fringes.', airWedge],
  ['PhyUGEx-44', 'Network Theorems Trainer', 'Electrical', 'Verify six network theorems on a board with regulated supplies and built-in meters.', networkPanelKit],
  ['PhyUGEx-48', 'Brewster’s Law: Refractive Index', 'Optics', 'A goniometer, polarizer and 650 nm laser that find the refractive index of glass.', brewster(false)],
  ['PhyUGEx-61', 'Series and Parallel LCR', 'Electrical', 'Patch real components on the front panel and find resonance, bandwidth and Q.', lcrPanelKit],
  ['PhyUGEx-74', 'Thomson e/m', 'Modern Physics', 'Balance electric and magnetic deflection of a CRT beam with bar magnets and a compass.', emThomson],
  ['PhyUGEx-80', 'Michelson Interferometer', 'Optics', 'Count sodium fringes and resolve the D-line doublet with micrometer-driven mirrors.', michelsonNa],
  ['PhyUGEx-98', 'Hall Effect in Semiconductor', 'Magnetism', 'Find the mobility and Hall coefficient of a p-type germanium crystal.', hallKit],
  ['PhyUGEx-101', 'Fermi Energy of Copper', 'Thermal', 'Extract the Fermi energy from a copper coil’s resistance as it warms.', fermi],
  ['PhyUGEx-105', 'Dielectric Constant', 'Electrical', 'Capacitance cells for polar liquids and solid samples.', dielectric],
  ['PhyUGEx-107', 'B–H Curve', 'Magnetism', 'Live hysteresis loops with auto permeability and automatic demagnetization.', bhCro],
  ['PhyUGEx-161', 'Quincke’s Method', 'Magnetism', 'A U-tube and travelling microscope for capillary and magnetic rise.', quincke],
  ['PhyUGEx-201', 'Angstrom’s Thermal Conductivity', 'Thermal', 'Track heat waves along a copper rod with four evenly spaced sensors.', angstrom],
  ['PhyUGEx-214', 'Faraday’s Law', 'Magnetism', 'Drop a magnet through coil sets and capture the EMF at high sample rates.', faraday],
  ['PhyUGEx-242', 'Full Adder and Subtractor', 'Digital', 'Patch 74-series adder and subtractor circuits to logic inputs, LEDs, clocks and seven-segment displays.', adderPanelKit],
  ['PhyUGEx-250', 'Seebeck and Peltier Effect', 'Thermal', 'Generate voltage from heat and pump heat with current in one module.', seebeck],
  ['PhyUGEx-256', 'Franck–Hertz: Ionization Potential', 'Modern Physics', 'See neon’s glow layers appear while the anode current steps through its peaks.', franckHertz],
  ['PhyUGEx-262', 'Lissajous Figures', 'Electrical', 'Read frequency ratios, resonance and phase from X–Y figures.', lissajous],
  ['PhyUGEx-268', 'Operational Amplifier Trainer', 'Electrical', 'Eight µA741 configurations with a full supply, generator and component bank.', opAmp],
  ['PhyUGEq-1', 'Regulated DC Power Supply', 'Equipment', 'A 0–30 V, 0–3 A bench supply with constant voltage and constant current modes.', psuKit],
  ['PhyPGEx-17', 'Franck–Hertz Experiment', 'Modern Physics', 'Postgraduate data-logged measurement of the excitation energy of neon.', franckHertz],
  ['PhyPGEx-18', 'Brewster’s Law of Polarization', 'Optics', 'Verify the Brewster condition by tracking the reflected p-polarised beam.', brewster(true)],
  ['PhyPGEx-20', 'Refractive Index of Thin Glass', 'Optics', 'Find a thin sheet’s refractive index from the fringe shift it creates.', michelsonGlass],
  ['PhyPGEx-32', 'Ultrasonic Interferometer', 'Modern Physics', 'Sound velocity in liquids, plus ranging and object detection in air.', ultrasonic],
  ['PhyPGEx-61', 'Curie Temperature', 'Thermal', 'Watch a Ni–Fe core lose its coupling as it passes the Curie point.', curieKit],
  ['PhyPGEx-62', 'B–H Curve: Hard and Soft', 'Magnetism', 'Compare U–I cores of mild steel and CRNGO with a 12-bit data logger.', bhHardSoft],
  ['PhyPGEx-103', 'Zeeman Effect', 'Modern Physics', 'Split spectral rings with a Fabry–Perot etalon and an electromagnet.', zeeman],
  ['PhyPGEx-114', 'Millikan’s Oil Drop', 'Modern Physics', 'Balance charged oil drops and reveal the elementary charge.', millikan],
  ['EleEq-37', 'AM Modulation Trainer', 'Communication', 'A full AM transmitter and superheterodyne receiver with switched faults.', amKit],
  ['EleEq-47', 'Fiber Optic Trainer', 'Communication', 'Analog and digital links over PMMA fibre, with loss and fault exercises.', ofcKit],
]

const spec = Object.fromEntries(specs.map((s) => [s.code, s]))

export const KITS = defs.map(([code, name, domain, blurb, experiments]) => ({
  id: code.toLowerCase(), code, name, domain, blurb,
  experiments: experiments.map((e) => ({ ...e, micro: microFor(code, e) })),
  level: levelOf(code), hue: DOMAINS[domain],
  no: spec[code].no, specTitle: spec[code].title, groups: spec[code].groups,
}))

export const findKit = (id) => KITS.find((k) => k.id === id)
export const TOTAL_EXPERIMENTS = KITS.reduce((s, k) => s + k.experiments.length, 0)
