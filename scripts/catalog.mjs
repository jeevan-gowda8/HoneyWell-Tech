/* Writes src/data/catalog.json: the kit names and experiment titles the catalog pages need,
   without the simulation code. Runs automatically before each build and dev start. */
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const { KITS } = await server.ssrLoadModule('/src/data/kits.js')
const catalog = KITS.map((k) => ({
  id: k.id, code: k.code, name: k.name, domain: k.domain, level: k.level, blurb: k.blurb, specTitle: k.specTitle,
  experiments: k.experiments.map((e) => ({ id: e.id, title: e.title, short: e.short })),
}))
fs.writeFileSync('src/data/catalog.json', `${JSON.stringify(catalog)}\n`)
await server.close()
