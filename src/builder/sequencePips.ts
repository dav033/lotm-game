// El kicker de una carta Breakdown es texto libre ("Authority · Seq 1→0"), asi
// que la secuencia se deduce de ahi en vez de guardarse aparte: los datos que ya
// existen la traen escrita y hay cartas que directamente no tienen ninguna.
export type SequenceReach = { full: number; partial: number | null }

export function parseSequenceReach(kicker: string): SequenceReach | null {
  const match = /Seq(?:uence)?\s*(\d)\s*(?:[→>-]+\s*(\d))?/i.exec(kicker || '')
  if (!match) return null
  const start = Number(match[1])
  const end = match[2] === undefined ? null : Number(match[2])
  // La secuencia baja es la mas fuerte: 1→0 significa control parcial en 1 y
  // completo en 0.
  if (end === null) return { full: start, partial: null }
  return { full: Math.min(start, end), partial: Math.max(start, end) }
}
