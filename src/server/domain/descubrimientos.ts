import type { Db } from '../db'
import { desbloqueoEspontaneoSatisfecho } from './desbloqueoEspontaneo'
import {
  elementoDisponiblePorPhaseId,
  faseActualParaPerfil,
  filtroElementoDisponiblePorPhaseIds,
  resolverFasePorDescubrimientos,
} from './fases'
import { toPublicElement } from './publicos'
import type { RecetaPendiente } from './tipos'

// Descubrimientos espontáneos: elementos que ninguna receta fabrica y que se
// desbloquean solos. La regla exacta vive en `desbloqueoEspontaneo.ts`: una
// ruta directa por desencadenante (OR) o una ruta de restricciones donde
// TODOS los campos configurados (tipo, número de secuencia, requisitos AND)
// deben cumplirse a la vez. Procesa en cascada — un desbloqueo puede
// habilitar otros — hasta alcanzar un punto fijo. Devuelve los elementos
// recién desbloqueados.
export async function desbloquearEspontaneos(
  db: Db,
  profileId: string,
  descubiertos: { id: string; type: string }[],
  now: Date,
) {
  const desbloqueados = []

  const discoveredIds = new Set<string>(
    (
      await db.playerDiscovery.findMany({
        where: { profileId },
        select: {
          elementId: true,
          element: {
            select: {
              isActive: true,
              sequence: { select: { pathway: { select: { isActive: true } } } },
            },
          },
        },
      })
    )
      .filter((d) => d.element.isActive && (!d.element.sequence || d.element.sequence.pathway.isActive))
      .map((d) => d.elementId),
  )
  for (const d of descubiertos) discoveredIds.add(d.id)

  // El catálogo es pequeño (cientos de filas): cargarlo entero permite
  // aplicar el mismo predicado puro sin reconsultar por tipo/id en cada ronda.
  const [candidatosCatalogo, todosLosElementos, secuencias, phases] = await Promise.all([
    db.element.findMany({
      where: { isActive: true },
      include: {
        unlockTriggers: { select: { triggerId: true } },
        unlockRequirements: { select: { requiredElementId: true } },
        sequence: { select: { pathway: { select: { isActive: true } } } },
      },
    }),
    db.element.findMany({
      select: {
        id: true,
        slug: true,
        type: true,
        isActive: true,
        availableFromPhaseId: true,
        sequence: { select: { pathway: { select: { isActive: true } } } },
      },
    }),
    db.sequence.findMany({
      where: { element: { isActive: true }, pathway: { isActive: true } },
      select: { elementId: true, number: true },
    }),
    db.progressionPhase.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        sortOrder: true,
        unlockAtDiscoveryCount: true,
        advancementRuleJson: true,
        isActive: true,
      },
    }),
  ])
  const candidatos = candidatosCatalogo.filter(
    (element) => !element.sequence || element.sequence.pathway.isActive,
  )

  const typeByElementId = new Map(todosLosElementos.map((e) => [e.id, e.type]))
  const phaseByElementId = new Map(
    todosLosElementos.map((element) => [element.id, element.availableFromPhaseId]),
  )
  const slugByElementId = new Map(todosLosElementos.map((element) => [element.id, element.slug]))
  const activeById = new Map(
    todosLosElementos.map((e) => [
      e.id,
      e.isActive && (!e.sequence || e.sequence.pathway.isActive),
    ]),
  )
  // El llamador ya conoce el tipo de lo recién descubierto (venía de la
  // combinación); se confía en ese dato sin esperar una segunda consulta.
  for (const d of descubiertos) {
    if (!typeByElementId.has(d.id)) typeByElementId.set(d.id, d.type)
    if (!activeById.has(d.id)) activeById.set(d.id, true)
    if (!phaseByElementId.has(d.id)) phaseByElementId.set(d.id, null)
  }
  const sequenceNumberByElementId = new Map(secuencias.map((s) => [s.elementId, s.number]))

  let cambiado = true
  while (cambiado) {
    cambiado = false

    const { discoveryCount, availablePhaseIds } = resolverFasePorDescubrimientos(
      phases,
      [...discoveredIds]
        .filter((id) => activeById.get(id) === true)
        .map((id) => ({
          availableFromPhaseId: phaseByElementId.get(id) ?? null,
          elementSlug: slugByElementId.get(id) ?? '',
        })),
    )
    const discoveredTypes = new Set<string>()
    const discoveredSequenceNumbers = new Set<number>()
    const activeDiscoveredIds = new Set<string>()
    for (const id of discoveredIds) {
      if (activeById.get(id) !== true) continue
      const phaseId = phaseByElementId.get(id)
      if (phaseId !== null && phaseId !== undefined && !availablePhaseIds.has(phaseId)) continue
      activeDiscoveredIds.add(id)
      const type = typeByElementId.get(id)
      if (type) discoveredTypes.add(type)
      const number = sequenceNumberByElementId.get(id)
      if (number != null) discoveredSequenceNumbers.add(number)
    }
    for (const el of candidatos) {
      if (discoveredIds.has(el.id)) continue
      const aperturaDeFase =
        el.availableFromPhaseId !== null && availablePhaseIds.has(el.availableFromPhaseId)
      if (!aperturaDeFase) {
        if (el.availableFromPhaseId !== null) continue
        const satisfecho = desbloqueoEspontaneoSatisfecho(
          {
            unlockedByType: el.unlockedByType,
            unlockedBySequenceNumber: el.unlockedBySequenceNumber,
            unlockedAtDiscoveryCount: el.unlockedAtDiscoveryCount,
            requiredElementIds: el.unlockRequirements.map((r) => r.requiredElementId),
            triggerIds: el.unlockTriggers.map((t) => t.triggerId),
          },
          { discoveredIds: activeDiscoveredIds, discoveredTypes, discoveredSequenceNumbers, discoveryCount },
        )
        if (!satisfecho) continue
      }
      await db.playerDiscovery.create({
        data: { profileId, elementId: el.id, firstDiscoveredAt: now, lastCreatedAt: now },
      })
      discoveredIds.add(el.id)
      desbloqueados.push(el)
      cambiado = true
    }
  }

  if (desbloqueados.length > 0) {
    const sequences = await db.sequence.findMany({
      where: {
        elementId: { in: desbloqueados.map((element) => element.id) },
        pathway: { isActive: true },
      },
      select: { pathwayId: true },
    })
    for (const pathwayId of new Set(sequences.map((sequence) => sequence.pathwayId))) {
      await db.playerPathwayUnlock.upsert({
        where: { profileId_pathwayId: { profileId, pathwayId } },
        create: { profileId, pathwayId, unlockedAt: now },
        update: {},
      })
    }
  }

  return desbloqueados
}

// Panel de depuración (solo admin): recetas activas que el perfil todavía no
// ha descubierto por completo, con sus ingredientes y resultados (aunque esos
// elementos también estén ocultos para un jugador normal).
export async function obtenerRecetasPendientes(db: Db, profileId: string): Promise<RecetaPendiente[]> {
  const { availablePhaseIds } = await faseActualParaPerfil(db, profileId)
  const [recetas, descubrimientos] = await Promise.all([
    db.recipe.findMany({
      where: { isActive: true },
      include: {
        ingredients: { include: { element: true } },
        outputs: { include: { element: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.playerDiscovery.findMany({
      where: {
        profileId,
        element: filtroElementoDisponiblePorPhaseIds(availablePhaseIds),
      },
      select: { elementId: true },
    }),
  ])
  const descubiertos = new Set(descubrimientos.map((d) => d.elementId))

  // Cuanto más bajo el tier de los ingredientes y menos falten por
  // descubrir, menos combinaciones previas exige llegar a esta receta.
  const conPrioridad: { receta: RecetaPendiente; faltantes: number; maxTier: number }[] = []
  for (const r of recetas) {
    if (
      !r.ingredients.every((ingredient) =>
        elementoDisponiblePorPhaseId(ingredient.element, availablePhaseIds),
      )
    ) continue
    const resultadosActivos = r.outputs.filter((output) =>
      elementoDisponiblePorPhaseId(output.element, availablePhaseIds),
    )
    if (resultadosActivos.length === 0) continue
    const completa = resultadosActivos.every((o) => descubiertos.has(o.elementId))
    if (completa) continue

    conPrioridad.push({
      receta: {
        recipeId: r.id,
        ingredientes: r.ingredients.map((i) => ({
          ...toPublicElement(i.element),
          quantity: i.quantity,
          discovered: descubiertos.has(i.elementId),
        })),
        resultados: resultadosActivos.map((o) => ({
          ...toPublicElement(o.element),
          quantity: o.quantity,
          discovered: descubiertos.has(o.elementId),
        })),
      },
      faltantes: r.ingredients.filter((i) => !descubiertos.has(i.elementId)).length,
      maxTier: Math.max(0, ...r.ingredients.map((i) => i.element.tier)),
    })
  }

  conPrioridad.sort((a, b) => a.faltantes - b.faltantes || a.maxTier - b.maxTier)
  return conPrioridad.map((p) => p.receta)
}

// Concede starters y reconcilia aperturas de fase y desbloqueos espontáneos.
// Vive en el dominio (sin dependencias de Next) para poder probarse aislado.
export async function descubrirIniciales(db: Db, profileId: string) {
  const now = new Date()
  const { availablePhaseIds } = await faseActualParaPerfil(db, profileId)
  const starterCatalog = await db.element.findMany({
    where: { isStarter: true, isActive: true },
    select: {
      id: true,
      type: true,
      isActive: true,
      availableFromPhaseId: true,
      sequence: { select: { pathway: { select: { isActive: true } } } },
    },
  })
  const starters = starterCatalog.filter(
    (element) =>
      elementoDisponiblePorPhaseId(element, availablePhaseIds) &&
      (!element.sequence || element.sequence.pathway.isActive),
  )
  for (const s of starters) {
    await db.playerDiscovery.upsert({
      where: { profileId_elementId: { profileId, elementId: s.id } },
      create: { profileId, elementId: s.id, firstDiscoveredAt: now, lastCreatedAt: now },
      update: {},
    })
  }
  const starterSequences = await db.sequence.findMany({
    where: { elementId: { in: starters.map((starter) => starter.id) }, pathway: { isActive: true } },
    select: { pathwayId: true },
  })
  for (const pathwayId of new Set(starterSequences.map((sequence) => sequence.pathwayId))) {
    await db.playerPathwayUnlock.upsert({
      where: { profileId_pathwayId: { profileId, pathwayId } },
      create: { profileId, pathwayId, unlockedAt: now },
      update: {},
    })
  }
  await desbloquearEspontaneos(
    db,
    profileId,
    starters.map((s) => ({ id: s.id, type: s.type })),
    now,
  )
}
