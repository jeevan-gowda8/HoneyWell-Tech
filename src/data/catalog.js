import KITS from './catalog.json'

/* Lightweight kit metadata for the catalog pages. catalog.json is generated from kits.js
   by scripts/catalog.mjs, so the simulations themselves are only loaded when opened. */

export { KITS }
export const DOMAINS = [...new Set(KITS.map((k) => k.domain))]
export const LEVELS = ['UG Lab', 'PG Lab', 'Equipment']
export const TOTAL_EXPERIMENTS = KITS.reduce((s, k) => s + k.experiments.length, 0)
export const findKit = (id) => KITS.find((k) => k.id === id)
export const thumb = (kit, exp) => `./thumbs/${kit.id}-${exp.id}.webp`
