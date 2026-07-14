import type { Db } from '../db'
import { toPublicElement } from './publicos'
import type { RitualPublicData } from './tipos'

export class RitualError extends Error {}

export async function obtenerRitualesDisponibles(
  db: Db,
  profileId: string,
): Promise<RitualPublicData[]> {
  const [sequenceDiscoveries, discoveries, rituals] = await Promise.all([
    db.playerDiscovery.findMany({
      where: { profileId, element: { sequence: { isNot: null } } },
      include: { element: { include: { sequence: true } } },
    }),
    db.playerDiscovery.findMany({ where: { profileId }, select: { elementId: true } }),
    db.ritual.findMany({
      where: { isActive: true },
      include: {
        ingredients: { include: { element: true }, orderBy: { id: 'asc' } },
        players: { where: { profileId }, select: { profileId: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const sequenceNumbers = new Set(
    sequenceDiscoveries.flatMap((item) => (item.element.sequence ? [item.element.sequence.number] : [])),
  )
  const discoveredIds = new Set(discoveries.map((item) => item.elementId))

  return rituals
    .filter((ritual) => sequenceNumbers.has(ritual.requiredSequenceNumber))
    .map((ritual) => ({
      id: ritual.id,
      name: ritual.name,
      requiredSequenceNumber: ritual.requiredSequenceNumber,
      isCompleted: ritual.players.length > 0,
      ingredients: ritual.ingredients.map((ingredient) => ({
        element: toPublicElement(ingredient.element),
        quantity: ingredient.quantity,
        discovered: discoveredIds.has(ingredient.elementId),
      })),
    }))
}

export async function realizarRitual(
  db: Db,
  profileId: string,
  ritualId: string,
): Promise<{ ritual: RitualPublicData; isNew: boolean }> {
  const available = await obtenerRitualesDisponibles(db, profileId)
  const ritualPublic = available.find((ritual) => ritual.id === ritualId)
  if (!ritualPublic) throw new RitualError('Ese ritual aún no está disponible.')
  if (ritualPublic.ingredients.some((ingredient) => !ingredient.discovered)) {
    throw new RitualError('Todavía no has descubierto todos los conceptos del ritual.')
  }
  const previous = await db.playerRitual.findUnique({
    where: { profileId_ritualId: { profileId, ritualId } },
  })
  if (!previous) await db.playerRitual.create({ data: { profileId, ritualId } })
  return {
    ritual: { ...ritualPublic, isCompleted: true },
    isNew: !previous,
  }
}
