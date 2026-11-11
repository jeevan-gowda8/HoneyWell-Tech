import { lcrPanelKit } from './lcrpanel'
import { networkPanelKit } from './networkpanel'
import { adderPanelKit } from './adderpanel'
import { panel3D } from './panel3d'

const wrap = (list, cfg) => list.map((e) => ({ ...e, wide: true, Stage: panel3D(e, cfg) }))
export const lcr3D = wrap(lcrPanelKit, { pw: 0.62, vw: 1000, vh: 800, hint: 'Patch the cords and press the generator keys on the panel exactly as on the real trainer.' })
export const network3D = wrap(networkPanelKit, { pw: 0.86, vw: 1620, vh: 930, body: 0x2f3540, hint: 'Patch the cords, turn the pots and set the supplies on the panel exactly as on the real trainer.' })
export const adder3D = wrap(adderPanelKit, { pw: 0.66, vw: 1100, vh: 820, hint: 'Patch the logic cords and flip the input switches on the panel exactly as on the real trainer.' })
