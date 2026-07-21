import type { Db } from '../db'
import {
  calcularEstadoRitual,
  RITUAL_KNOWLEDGE_ELEMENT_SLUG,
  type PublicRitualState,
  type RitualKnowledgeCandidate,
} from './ritualKnowledge'
import {
  elementoDisponiblePorPhaseId,
  faseActualParaPerfil,
  filtroElementoDisponiblePorPhaseIds,
} from './fases'
import { featuresParaFase } from './featureGates'

export type RitualErrorCode =
  | 'FEATURE_LOCKED'
  | 'KNOWLEDGE_REQUIRED'
  | 'RITUAL_NOT_FOUND'
  | 'SOURCE_REQUIRED'
  | 'TARGET_DISCOVERED'
  | 'INGREDIENTS_REQUIRED'

export class RitualError extends Error {
  constructor(
    message: string,
    readonly code: RitualErrorCode,
    readonly status: 403 | 404 | 422,
  ) {
    super(message)
  }
}

async function cargarSnapshotRitual(
  db: Db,
  profileId: string,
  availablePhaseIds: ReadonlySet<string>,
) {
  const availableElementFilter = filtroElementoDisponiblePorPhaseIds(availablePhaseIds)
  const [discoveries, rituals] = await Promise.all([
    db.playerDiscovery.findMany({
      where: {
        profileId,
        element: availableElementFilter,
      },
      select: { elementId: true, element: { select: { slug: true } } },
    }),
    db.ritual.findMany({
      where: { isActive: true },
      select: {
        id: true,
        advanceId: true,
        isActive: true,
        advance: {
          select: {
            isActive: true,
            sourceSequence: {
              select: {
                number: true,
                elementId: true,
                element: {
                  select: {
                    id: true,
                    name: true,
                    iconKey: true,
                    isActive: true,
                    availableFromPhaseId: true,
                  },
                },
                pathway: { select: { name: true, isActive: true } },
              },
            },
            targetSequence: {
              select: {
                elementId: true,
                element: { select: { isActive: true, availableFromPhaseId: true } },
                pathway: { select: { isActive: true } },
              },
            },
          },
        },
        ingredients: {
          select: {
            elementId: true,
            quantity: true,
            element: {
              select: { name: true, iconKey: true, isActive: true, availableFromPhaseId: true },
            },
          },
          orderBy: { id: 'asc' },
        },
        players: { where: { profileId }, select: { profileId: true } },
      },
      orderBy: [{ advanceId: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  return {
    discoveredElementIds: new Set(discoveries.map((item) => item.elementId)),
    discoveredSlugs: new Set(discoveries.map((item) => item.element.slug)),
    rituals: rituals.filter(
      (ritual) =>
        elementoDisponiblePorPhaseId(ritual.advance.sourceSequence.element, availablePhaseIds) &&
        elementoDisponiblePorPhaseId(ritual.advance.targetSequence.element, availablePhaseIds) &&
        ritual.ingredients.every((ingredient) =>
          elementoDisponiblePorPhaseId(ingredient.element, availablePhaseIds),
        ),
    ) satisfies RitualKnowledgeCandidate[],
  }
}

export async function obtenerEstadoRitual(db: Db, profileId: string): Promise<PublicRitualState> {
  const phaseState = await faseActualParaPerfil(db, profileId)
  const features = await featuresParaFase(db, phaseState.sortOrder)
  if (!features.ADVANCEMENT_RITUALS) return { status: 'HIDDEN', groups: [] }
  return calcularEstadoRitual(
    await cargarSnapshotRitual(db, profileId, phaseState.availablePhaseIds),
  )
}

export async function realizarRitual(
  db: Db,
  profileId: string,
  ritualId: string,
): Promise<{ ok: true; ritualState: PublicRitualState }> {
  const phaseState = await faseActualParaPerfil(db, profileId)
  const { availablePhaseIds } = phaseState
  const features = await featuresParaFase(db, phaseState.sortOrder)
  if (!features.ADVANCEMENT_RITUALS) {
    throw new RitualError(
      'Los rituales de avance aún no están disponibles.',
      'FEATURE_LOCKED',
      403,
    )
  }
  const availableElementFilter = filtroElementoDisponiblePorPhaseIds(availablePhaseIds)
  const [ritual, discoveries] = await Promise.all([
    db.ritual.findFirst({
      where: { id: ritualId, isActive: true },
      select: {
        id: true,
        advance: {
          select: {
            isActive: true,
            sourceSequence: {
              select: {
                elementId: true,
                element: { select: { isActive: true, availableFromPhaseId: true } },
                pathway: { select: { isActive: true } },
              },
            },
            targetSequence: {
              select: {
                elementId: true,
                element: { select: { isActive: true, availableFromPhaseId: true } },
                pathway: { select: { isActive: true } },
              },
            },
            rituals: {
              where: { isActive: true },
              select: {
                id: true,
                players: { where: { profileId }, select: { profileId: true } },
              },
            },
          },
        },
        ingredients: {
          select: {
            elementId: true,
            element: { select: { isActive: true, availableFromPhaseId: true } },
          },
        },
      },
    }),
    db.playerDiscovery.findMany({
      where: {
        profileId,
        element: availableElementFilter,
      },
      select: { elementId: true, element: { select: { slug: true } } },
    }),
  ])

  if (!ritual) {
    throw new RitualError('Ese ritual no está disponible.', 'RITUAL_NOT_FOUND', 404)
  }

  const discoveredIds = new Set(discoveries.map((item) => item.elementId))
  const hasKnowledge = discoveries.some(
    (item) => item.element.slug === RITUAL_KNOWLEDGE_ELEMENT_SLUG,
  )
  if (!hasKnowledge) {
    throw new RitualError(
      'Aún no comprendes el conocimiento ritual.',
      'KNOWLEDGE_REQUIRED',
      403,
    )
  }

  const { advance } = ritual
  const activeContent =
    advance.isActive &&
    elementoDisponiblePorPhaseId(advance.sourceSequence.element, availablePhaseIds) &&
    elementoDisponiblePorPhaseId(advance.targetSequence.element, availablePhaseIds) &&
    advance.sourceSequence.pathway.isActive &&
    advance.targetSequence.pathway.isActive
  if (!activeContent) {
    throw new RitualError('Ese ritual no está disponible.', 'RITUAL_NOT_FOUND', 404)
  }
  if (!discoveredIds.has(advance.sourceSequence.elementId)) {
    throw new RitualError(
      'Aún no has alcanzado la secuencia necesaria.',
      'SOURCE_REQUIRED',
      422,
    )
  }
  if (discoveredIds.has(advance.targetSequence.elementId)) {
    throw new RitualError('Esa preparación ya no es necesaria.', 'TARGET_DISCOVERED', 422)
  }
  if (
    ritual.ingredients.some(
      (ingredient) =>
        !elementoDisponiblePorPhaseId(ingredient.element, availablePhaseIds) ||
        !discoveredIds.has(ingredient.elementId),
    )
  ) {
    throw new RitualError(
      'Todavía no has descubierto todos los conceptos necesarios.',
      'INGREDIENTS_REQUIRED',
      422,
    )
  }

  const protectedByAlternative = advance.rituals.some(
    (option) => option.id !== ritualId && option.players.length > 0,
  )
  if (protectedByAlternative) {
    return { ok: true, ritualState: await obtenerEstadoRitual(db, profileId) }
  }

  await db.playerRitual.upsert({
    where: { profileId_ritualId: { profileId, ritualId } },
    create: { profileId, ritualId },
    update: {},
  })

  return { ok: true, ritualState: await obtenerEstadoRitual(db, profileId) }
}
