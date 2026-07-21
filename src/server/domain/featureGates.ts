import type { Db } from '../db'
import { resolveFeatureState } from '@/shared/featureGates'

export async function featuresParaFase(db: Db, currentPhaseSortOrder: number) {
  const gates = await db.featureGate.findMany({
    select: { key: true, minimumPhaseSortOrder: true },
  })
  return resolveFeatureState(gates, currentPhaseSortOrder)
}
