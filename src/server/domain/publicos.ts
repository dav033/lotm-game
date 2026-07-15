import type { ElementPublicData } from './tipos'

export const ADVANCE_TOKEN_PREFIX = 'advance-'

export function advanceToken(id: string): string {
  return `${ADVANCE_TOKEN_PREFIX}${id}`
}

export function advanceIdFromToken(token: string): string | null {
  if (!token.startsWith(ADVANCE_TOKEN_PREFIX)) return null
  const id = token.slice(ADVANCE_TOKEN_PREFIX.length)
  return id || null
}

export function toPublicElement(e: {
  id: string
  slug: string
  name: string
  description: string
  iconKey: string
  imageUrl: string | null
  type: string
  tier: number
  isMajorDiscovery: boolean
}): ElementPublicData {
  return {
    kind: 'ELEMENT',
    id: e.id,
    slug: e.slug,
    name: e.name,
    description: e.description,
    iconKey: e.iconKey,
    imageUrl: e.imageUrl,
    type: e.type,
    tier: e.tier,
    isMajorDiscovery: e.isMajorDiscovery,
    derivationLabel: null,
  }
}

// Etiqueta corta que identifica una secuencia dentro de su camino, para que
// "combínalo con la secuencia correcta" sea accionable desde el panel.
export function sequenceLabelOf(
  seq: { number: number; pathway: { name: string } } | null | undefined,
): string | null {
  return seq ? `Secuencia ${seq.number} · ${seq.pathway.name}` : null
}

export function toPublicAdvance(advance: {
  id: string
  ingredients: { quantity: number; element: { name: string } }[]
  sourceSequence?: { pathway: { name: string; iconKey: string | null } }
}): ElementPublicData {
  const token = advanceToken(advance.id)
  const derivationLabel = advance.ingredients
    .map((ingredient) => `${ingredient.element.name} × ${ingredient.quantity}`)
    .join(' + ')

  return {
    kind: 'ADVANCE',
    id: token,
    slug: token,
    name: 'Avance desconocido',
    description:
      'Se consume al usarlo: combínalo con la secuencia correcta para ascender.',
    // El icono del camino de origen distingue avances entre sí y da una pista
    // de dónde encaja sin revelar la secuencia exacta.
    iconKey: advance.sourceSequence?.pathway.iconKey ?? 'wand-sparkles',
    imageUrl: null,
    type: 'AVANCE',
    tier: 0,
    isMajorDiscovery: false,
    derivationLabel,
  }
}
