import { useEffect, useSyncExternalStore } from 'react'

/* A small History API router: clean addresses such as /kits/air-wedge, with no "#".
   BASE is Vite's base path ('/' by default), so the site can also live in a sub-folder. */

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const EVENT = 'app:navigate'

/* old hash links (/#/kits) become clean ones */
if (window.location.hash.startsWith('#/')) window.history.replaceState(null, '', BASE + window.location.hash.slice(1))

const subscribe = (fn) => {
  window.addEventListener('popstate', fn); window.addEventListener(EVENT, fn)
  return () => { window.removeEventListener('popstate', fn); window.removeEventListener(EVENT, fn) }
}
const read = () => {
  const p = window.location.pathname
  const rest = BASE && p.startsWith(BASE) ? p.slice(BASE.length) : p
  return rest.replace(/\/+$/, '') || '/'
}

export const usePath = () => useSyncExternalStore(subscribe, read)

export function navigate(to, { replace = false } = {}) {
  const url = BASE + to
  if (url === window.location.pathname + window.location.search) return
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
  window.dispatchEvent(new Event(EVENT))
}

/* A public file (in /public), resolved against the base path so it loads from any page. */
export const pub = (p) => `${BASE}/${p.replace(/^\.?\//, '')}`

export function Link({ to, children, onClick, ...rest }) {
  const go = (e) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return
    e.preventDefault(); navigate(to)
  }
  return <a href={BASE + to} onClick={go} {...rest}>{children}</a>
}

export function Navigate({ to }) {
  useEffect(() => { navigate(to, { replace: true }) }, [to])
  return null
}
