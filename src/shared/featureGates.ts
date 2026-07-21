export const FEATURE_KEYS = ['ADVANCEMENT_RITUALS'] as const

export const FEATURE_DEFINITIONS = [
  {
    key: 'ADVANCEMENT_RITUALS',
    label: 'Rituales de avance',
    description: 'Permite preparar rituales y aplicar avances que requieren uno.',
    defaultMinimumPhaseSortOrder: 6,
  },
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]
export type FeatureState = Record<FeatureKey, boolean>

export function resolveFeatureState(
  gates: readonly { key: string; minimumPhaseSortOrder: number }[],
  currentPhaseSortOrder: number,
): FeatureState {
  return Object.fromEntries(
    FEATURE_DEFINITIONS.map(({ key }) => {
      const gate = gates.find((candidate) => candidate.key === key)
      return [key, gate !== undefined && currentPhaseSortOrder >= gate.minimumPhaseSortOrder]
    }),
  ) as FeatureState
}
