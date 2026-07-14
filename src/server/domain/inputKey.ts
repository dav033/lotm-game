// Normalización determinista de combinaciones.
//
// Una receta se identifica por su inputKey: los slugs de sus ingredientes
// agrupados, ordenados alfabéticamente y unidos con "|":
//   Ojo + Ojo            -> "ojo*2"
//   Ojo + Visión         -> "ojo*1|vision*1"
//   Visión + Ojo         -> "ojo*1|vision*1"  (el orden no importa)
// El administrador nunca escribe esta clave: siempre se deriva de los
// ingredientes estructurados (RecipeIngredient).

export type IngredientInput = {
  slug: string
  quantity: number
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

export function buildRecipeInputKey(ingredients: IngredientInput[]): string {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new Error('Se necesita al menos un ingrediente.')
  }
  const grouped = new Map<string, number>()
  for (const ing of ingredients) {
    const slug = ing.slug.trim().toLowerCase()
    if (!isValidSlug(slug)) {
      throw new Error(`Identificador de ingrediente inválido: «${ing.slug}».`)
    }
    if (!Number.isInteger(ing.quantity) || ing.quantity < 1) {
      throw new Error('Cada ingrediente necesita una cantidad entera mayor o igual a 1.')
    }
    grouped.set(slug, (grouped.get(slug) ?? 0) + ing.quantity)
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([slug, qty]) => `${slug}*${qty}`)
    .join('|')
}

export function parseInputKey(inputKey: string): IngredientInput[] {
  return inputKey.split('|').map((part) => {
    const [slug, qty] = part.split('*')
    const quantity = Number(qty)
    if (!slug || !isValidSlug(slug) || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`inputKey corrupta: «${inputKey}».`)
    }
    return { slug, quantity }
  })
}

export function totalUnits(ingredients: IngredientInput[]): number {
  return ingredients.reduce((sum, i) => sum + i.quantity, 0)
}
