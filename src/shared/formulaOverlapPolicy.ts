import { buildRecipeInputKey } from './inputKey'

export type IntentionalDualOutcome = {
  inputKey: string
  recipeOutputSlugs: readonly string[]
  advanceTargetSlug: string
}

function key(first: string, second: string) {
  return buildRecipeInputKey([
    { slug: first, quantity: 1 },
    { slug: second, quantity: 1 },
  ])
}

export const INTENTIONAL_RECIPE_ADVANCE_DUAL_OUTCOMES: readonly IntentionalDualOutcome[] = [
  {
    inputKey: key('pesadilla', 'psique'),
    recipeOutputSlugs: ['horror'],
    advanceTargetSlug: 'nightmare',
  },
  {
    inputKey: key('autoridad', 'muerte'),
    recipeOutputSlugs: ['autoridad-sobre-la-muerte'],
    advanceTargetSlug: 'death-consul',
  },
  {
    inputKey: key('ocultamiento', 'sombra'),
    recipeOutputSlugs: ['oscuridad'],
    advanceTargetSlug: 'shadow-ascetic',
  },
] as const

export function isIntentionalRecipeAdvanceDualOutcome(input: {
  inputKey: string
  recipeOutputSlugs: readonly string[]
  advanceTargetSlug: string
}): boolean {
  const outputs = [...input.recipeOutputSlugs].sort()
  return INTENTIONAL_RECIPE_ADVANCE_DUAL_OUTCOMES.some(
    (allowed) =>
      allowed.inputKey === input.inputKey &&
      allowed.advanceTargetSlug === input.advanceTargetSlug &&
      outputs.length === allowed.recipeOutputSlugs.length &&
      outputs.every((slug, index) => slug === [...allowed.recipeOutputSlugs].sort()[index]),
  )
}
