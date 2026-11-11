import { microFor } from '../sims/micromap'

/* Each kit's simulations are fetched only when one of its experiments is opened. */

const mech = () => import('../sims/mechanics')
const opt = () => import('../sims/optics')
const elec = () => import('../sims/electrical')
const lcr = () => import('../sims/lcrpanel')
const mag = () => import('../sims/magnetism')
const heat = () => import('../sims/thermal')
const mod = () => import('../sims/modern')
const comm = () => import('../sims/comm')
const adder = () => import('../sims/adderpanel')
const bar3d = () => import('../sims/barpendulum3d')
const coupled3d = () => import('../sims/coupled3d')
const netPanel = () => import('../sims/networkpanel')
const brew3d = () => import('../sims/brewster3d')
const thomson3d = () => import('../sims/thomson3d')
const michelson3d = () => import('../sims/michelson3d')
const hall3d = () => import('../sims/hall3d')
const fermi3d = () => import('../sims/fermi3d')
const dielectric3d = () => import('../sims/dielectric3d')
const bh3d = () => import('../sims/bh3d')
const quincke3d = () => import('../sims/quincke3d')
const angstrom3d = () => import('../sims/angstrom3d')
const faraday3d = () => import('../sims/faraday3d')
const seebeck3d = () => import('../sims/seebeck3d')
const franck3d = () => import('../sims/franck3d')
const lissajous3d = () => import('../sims/lissajous3d')
const bhhs3d = () => import('../sims/bhhs3d')
const millikan3d = () => import('../sims/millikan3d')
const zeeman3d = () => import('../sims/zeeman3d')
const ultrasonic3d = () => import('../sims/ultrasonic3d')
const curie3d = () => import('../sims/curie3d')
const am3d = () => import('../sims/am3d')
const panels3d = () => import('../sims/panels3d')
const airwedge3d = () => import('../sims/airwedge3d')
const ofc3d = () => import('../sims/ofc3d')
const opamp3d = () => import('../sims/opamp3d')
const psu3d = () => import('../sims/psu3d')

const pick = (load, name) => () => load().then((m) => m[name])
const call = (load, name, arg) => () => load().then((m) => m[name](arg))

const LOADERS = {
  'PhyUGEx-2': pick(bar3d, 'barPendulum3D'),
  'PhyUGEx-11': pick(coupled3d, 'coupled3D'),
  'PhyUGEx-35': pick(airwedge3d, 'airWedge3D'),
  'PhyUGEx-44': pick(panels3d, 'network3D'),
  'PhyUGEx-48': pick(brew3d, 'brewster3D'),
  'PhyUGEx-61': pick(panels3d, 'lcr3D'),
  'PhyUGEx-74': pick(thomson3d, 'thomson3D'),
  'PhyUGEx-80': pick(michelson3d, 'michelson3D'),
  'PhyUGEx-98': pick(hall3d, 'hall3D'),
  'PhyUGEx-101': pick(fermi3d, 'fermi3D'),
  'PhyUGEx-105': pick(dielectric3d, 'dielectric3D'),
  'PhyUGEx-107': pick(bh3d, 'bh3D'),
  'PhyUGEx-161': pick(quincke3d, 'quincke3D'),
  'PhyUGEx-201': pick(angstrom3d, 'angstrom3D'),
  'PhyUGEx-214': pick(faraday3d, 'faraday3D'),
  'PhyUGEx-242': pick(panels3d, 'adder3D'),
  'PhyUGEx-250': pick(seebeck3d, 'seebeck3D'),
  'PhyUGEx-256': pick(franck3d, 'franck3D'),
  'PhyUGEx-262': pick(lissajous3d, 'lissajous3D'),
  'PhyUGEx-268': pick(opamp3d, 'opAmp3D'),
  'PhyUGEq-1': pick(psu3d, 'psu3D'),
  'PhyPGEx-17': pick(franck3d, 'franck3D'),
  'PhyPGEx-18': pick(brew3d, 'brewster3DPG'),
  'PhyPGEx-20': pick(michelson3d, 'michelsonGlass3D'),
  'PhyPGEx-32': pick(ultrasonic3d, 'ultrasonic3D'),
  'PhyPGEx-61': pick(curie3d, 'curie3D'),
  'PhyPGEx-62': pick(bhhs3d, 'bhHardSoft3D'),
  'PhyPGEx-103': pick(zeeman3d, 'zeeman3D'),
  'PhyPGEx-114': pick(millikan3d, 'millikan3D'),
  'EleEq-37': pick(am3d, 'am3D'),
  'EleEq-47': pick(ofc3d, 'ofc3D'),
}

export const loadExperiments = (code) => LOADERS[code]().then((list) => list.map((e) => ({ ...e, micro: microFor(code, e) })))
