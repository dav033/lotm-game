import type { Db } from '../db'
import {
  calcularEstadoRitual,
  RITUAL_KNOWLEDGE_ELEMENT_SLUG,
  type PublicRitualState,
  type RitualKnowledgeCandidate,
} from './ritualKnowledge'

export type RitualErrorCode =
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

async function cargarSnapshotRitual(db: Db, profileId: string) {
  const [discoveries, rituals] = await Promise.all([
    db.playerDiscovery.findMany({
      where: { profileId, element: { isActive: true } },
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
                  select: { id: true, name: true, iconKey: true, isActive: true },
                },
                pathway: { select: { name: true, isActive: true } },
              },
            },
            targetSequence: {
              select: {
                elementId: true,
                element: { select: { isActive: true } },
                pathway: { select: { isActive: true } },
              },
            },
          },
        },
        ingredients: {
          select: {
            elementId: true,
            quantity: true,
            element: { select: { name: true, iconKey: true, isActive: true } },
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
    rituals: rituals satisfies RitualKnowledgeCandidate[],
  }
}

export async function obtenerEstadoRitual(db: Db, profileId: string): Promise<PublicRitualState> {
  return calcularEstadoRitual(await cargarSnapshotRitual(db, profileId))
}

export async function realizarRitual(
  db: Db,
  profileId: string,
  ritualId: string,
): Promise<{ ok: true; ritualState: PublicRitualState }> {
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
                element: { select: { isActive: true } },
                pathway: { select: { isActive: true } },
              },
            },
            targetSequence: {
              select: {
                elementId: true,
                element: { select: { isActive: true } },
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
          select: { elementId: true, element: { select: { isActive: true } } },
        },
      },
    }),
    db.playerDiscovery.findMany({
      where: { profileId, element: { isActive: true } },
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
    advance.sourceSequence.element.isActive &&
    advance.targetSequence.element.isActive &&
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
        !ingredient.element.isActive || !discoveredIds.has(ingredient.elementId),
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
