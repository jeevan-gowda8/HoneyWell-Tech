import { useEffect, useSyncExternalStore } from 'react'

/* A minimal hash router, so the site works from any static folder without a routing library. */

const subscribe = (fn) => { window.addEventListener('hashchange', fn); return () => window.removeEventListener('hashchange', fn) }
const read = () => window.location.hash.slice(1) || '/'

export const usePath = () => useSyncExternalStore(subscribe, read)

export const Link = ({ to, children, ...rest }) => <a href={`#${to}`} {...rest}>{children}</a>

export function Navigate({ to }) {
  useEffect(() => { window.location.replace(`#${to}`) }, [to])
  return null
}
