/** Renders R_TH style text with a true subscript. */
export const Rich = ({ s }) => {
  if (typeof s !== 'string' || !s.includes('_')) return s ?? null
  return s.split(/_([A-Za-z0-9]+)/).map((part, i) => (i % 2 ? <sub key={i}>{part}</sub> : part))
}
