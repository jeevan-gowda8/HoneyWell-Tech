import KITS from './catalog.json'
import { pub } from '../lib/router'

/* Lightweight kit metadata for the catalog pages. catalog.json is generated from kits.js
   by scripts/catalog.mjs, so the simulations themselves are only loaded when opened. */

export { KITS }
export const DOMAINS = [...new Set(KITS.map((k) => k.domain))]
export const LEVELS = ['UG Lab', 'PG Lab', 'Equipment']
export const TOTAL_EXPERIMENTS = KITS.reduce((s, k) => s + k.experiments.length, 0)
export const findKit = (key) => KITS.find((k) => k.slug === key) || KITS.find((k) => k.id === key)
export const kitPath = (kit, exp) => `/kits/${kit.slug}${exp ? `/${exp.id || exp}` : ''}`
export const thumb = (kit, exp) => pub(`thumbs/${kit.id}-${exp.id}.webp`)
