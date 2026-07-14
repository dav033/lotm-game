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

export function toPublicAdvance(advance: {
  id: string
  ingredients: { quantity: number; element: { name: string } }[]
}): ElementPublicData {
  const token = advanceToken(advance.id)
  const derivationLabel = advance.ingredients
    .map((ingredient) => `${ingredient.element.name} × ${ingredient.quantity}`)
    .join(' + ')

  return {
    kind: 'ADVANCE',
    id: token,
    slug: token,
    name: 'Unknown Advance',
    description: 'Un avance de naturaleza desconocida. Combínalo con la secuencia correcta.',
    iconKey: 'wand-sparkles',
    imageUrl: null,
    type: 'AVANCE',
    tier: 0,
    isMajorDiscovery: false,
    derivationLabel,
  }
}
