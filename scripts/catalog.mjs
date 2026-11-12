/* Writes src/data/catalog.json: the kit names and experiment titles the catalog pages need,
   without the simulation code. Runs automatically before each build and dev start. */
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const { KITS } = await server.ssrLoadModule('/src/data/kits.js')
/* The kit's web address uses its name: "AM Modulation & Demodulation Trainer" -> am-modulation-and-demodulation-trainer */
const slugOf = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/&/g, ' and ').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const used = new Set()
const catalog = KITS.map((k) => {
  let slug = slugOf(k.name)
  if (used.has(slug)) slug = `${slug}-${k.id}`
  used.add(slug)
  return {
  id: k.id, slug, code: k.code, name: k.name, domain: k.domain, level: k.level, blurb: k.blurb, specTitle: k.specTitle,
  experiments: k.experiments.map((e) => ({ id: e.id, title: e.title, short: e.short })),
  }
})
fs.writeFileSync('src/data/catalog.json', `${JSON.stringify(catalog)}\n`)
await server.close()
