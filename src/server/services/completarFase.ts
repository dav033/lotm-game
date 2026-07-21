import type { PrismaClient } from '@/generated/prisma/client'
import { concederLogrosPorElementos } from '../domain/logros'
import { desbloquearEspontaneos } from '../domain/descubrimientos'
import { faseActualParaPerfil } from '../domain/fases'
import { cargarAnalisisProgresion } from './progresion'
import { simularCierreHastaFase } from './fasesProgresion'

export type CompletePhaseErrorCode = 'PHASE_CHANGED' | 'NO_ACTIVE_PHASE' | 'NO_NEXT_PHASE' | 'PHASE_NOT_OPENED'

export class CompletePhaseError extends Error {
  constructor(
    message: string,
    readonly code: CompletePhaseErrorCode,
    readonly status: 409 | 422,
  ) {
    super(message)
  }
}

export async function completarFaseActual(
  db: PrismaClient,
  profileId: string,
  expectedPhaseSlug: string,
) {
  return db.$transaction(async (tx) => {
    const now = new Date()
    await tx.playerProfile.update({ where: { id: profileId }, data: { lastSeenAt: now } })

    const before = await faseActualParaPerfil(tx, profileId)
    if (!before.phase) {
      throw new CompletePhaseError('No hay una fase activa que completar.', 'NO_ACTIVE_PHASE', 422)
    }
    if (before.phase.slug !== expectedPhaseSlug) {
      throw new CompletePhaseError(
        'La fase cambió antes de completar la operación.',
        'PHASE_CHANGED',
        409,
      )
    }
    const nextPhase = before.phases.find((phase) => phase.sortOrder > before.sortOrder)
    if (!nextPhase) {
      throw new CompletePhaseError('Ya has alcanzado la última fase activa.', 'NO_NEXT_PHASE', 422)
    }

    const { simInput } = await cargarAnalisisProgresion(tx)
    const closure = simularCierreHastaFase(simInput, before.sortOrder)
    const elements = await tx.element.findMany({
      where: { slug: { in: [...closure.discovered] }, isActive: true },
      include: { sequence: { include: { pathway: true } } },
    })
    const grantable = elements.filter(
      (element) => !element.sequence || element.sequence.pathway.isActive,
    )
    const existing = await tx.playerDiscovery.findMany({
      where: { profileId, elementId: { in: grantable.map((element) => element.id) } },
      select: { elementId: true },
    })
    const existingIds = new Set(existing.map((discovery) => discovery.elementId))
    const newlyGranted = grantable.filter((element) => !existingIds.has(element.id))

    for (const element of newlyGranted) {
      await tx.playerDiscovery.create({
        data: { profileId, elementId: element.id, firstDiscoveredAt: now, lastCreatedAt: now },
      })
    }
    for (const pathwayId of new Set(
      newlyGranted.flatMap((element) => element.sequence?.pathwayId ?? []),
    )) {
      await tx.playerPathwayUnlock.upsert({
        where: { profileId_pathwayId: { profileId, pathwayId } },
        create: { profileId, pathwayId, unlockedAt: now },
        update: {},
      })
    }

    const cascaded = await desbloquearEspontaneos(
      tx,
      profileId,
      newlyGranted.map((element) => ({ id: element.id, type: element.type })),
      now,
    )
    const after = await faseActualParaPerfil(tx, profileId)
    const enteredPhase = after.phases.find(
      (phase) => phase.sortOrder > before.sortOrder && after.availablePhaseIds.has(phase.id),
    )
    if (!enteredPhase) {
      throw new CompletePhaseError(
        'La regla de la siguiente fase no se satisface al completar el cierre actual.',
        'PHASE_NOT_OPENED',
        422,
      )
    }

    const openingElements = await tx.element.findMany({
      where: {
        availableFromPhaseId: enteredPhase.id,
        isActive: true,
        discoveries: { some: { profileId } },
      },
      select: { slug: true },
      orderBy: { name: 'asc' },
    })
    await concederLogrosPorElementos(
      tx,
      profileId,
      [...newlyGranted, ...cascaded].map((element) => element.id),
      now,
    )

    return {
      completedPhase: {
        slug: before.phase.slug,
        name: before.phase.name,
        sortOrder: before.phase.sortOrder,
      },
      phase: {
        slug: enteredPhase.slug,
        name: enteredPhase.name,
        sortOrder: enteredPhase.sortOrder,
      },
      celebrationMessage: enteredPhase.celebrationMessage,
      openingElementSlugs: openingElements.map((element) => element.slug),
      grantedCount: newlyGranted.length + cascaded.length,
    }
  })
}
