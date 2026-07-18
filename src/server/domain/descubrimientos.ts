import type { Db } from '../db'
import { desbloqueoEspontaneoSatisfecho } from './desbloqueoEspontaneo'
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
        select: { elementId: true },
      })
    ).map((d) => d.elementId),
  )
  for (const d of descubiertos) discoveredIds.add(d.id)

  // El catálogo es pequeño (cientos de filas): cargarlo entero permite
  // aplicar el mismo predicado puro sin reconsultar por tipo/id en cada ronda.
  const [candidatos, todosLosElementos, secuencias] = await Promise.all([
    db.element.findMany({
      where: { isActive: true },
      include: {
        unlockTriggers: { select: { triggerId: true } },
        unlockRequirements: { select: { requiredElementId: true } },
      },
    }),
    db.element.findMany({ select: { id: true, type: true } }),
    db.sequence.findMany({ select: { elementId: true, number: true } }),
  ])

  const typeByElementId = new Map(todosLosElementos.map((e) => [e.id, e.type]))
  // El llamador ya conoce el tipo de lo recién descubierto (venía de la
  // combinación); se confía en ese dato sin esperar una segunda consulta.
  for (const d of descubiertos) {
    if (!typeByElementId.has(d.id)) typeByElementId.set(d.id, d.type)
  }
  const sequenceNumberByElementId = new Map(secuencias.map((s) => [s.elementId, s.number]))

  let cambiado = true
  while (cambiado) {
    cambiado = false

    const discoveredTypes = new Set<string>()
    const discoveredSequenceNumbers = new Set<number>()
    for (const id of discoveredIds) {
      const type = typeByElementId.get(id)
      if (type) discoveredTypes.add(type)
      const number = sequenceNumberByElementId.get(id)
      if (number != null) discoveredSequenceNumbers.add(number)
    }

    for (const el of candidatos) {
      if (discoveredIds.has(el.id)) continue
      const satisfecho = desbloqueoEspontaneoSatisfecho(
        {
          unlockedByType: el.unlockedByType,
          unlockedBySequenceNumber: el.unlockedBySequenceNumber,
          requiredElementIds: el.unlockRequirements.map((r) => r.requiredElementId),
          triggerIds: el.unlockTriggers.map((t) => t.triggerId),
        },
        { discoveredIds, discoveredTypes, discoveredSequenceNumbers },
      )
      if (!satisfecho) continue
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
      where: { profileId },
      select: { elementId: true },
    }),
  ])
  const descubiertos = new Set(descubrimientos.map((d) => d.elementId))

  // Cuanto más bajo el tier de los ingredientes y menos falten por
  // descubrir, menos combinaciones previas exige llegar a esta receta.
  const conPrioridad: { receta: RecetaPendiente; faltantes: number; maxTier: number }[] = []
  for (const r of recetas) {
    const resultadosActivos = r.outputs.filter((o) => o.element.isActive)
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

// Marca como descubiertos todos los elementos con isStarter=true (leídos de
// la base, nunca de una lista fija) y dispara los desbloqueos espontáneos
// que esos starters puedan causar. Vive en el dominio (sin dependencias de
// Next) para poder probarse aislado.
export async function descubrirIniciales(db: Db, profileId: string) {
  const now = new Date()
  const starters = await db.element.findMany({
    where: { isStarter: true, isActive: true },
    select: { id: true, type: true },
  })
  for (const s of starters) {
    await db.playerDiscovery.upsert({
      where: { profileId_elementId: { profileId, elementId: s.id } },
      create: { profileId, elementId: s.id, firstDiscoveredAt: now, lastCreatedAt: now },
      update: {},
    })
  }
  if (starters.length > 0) {
    await desbloquearEspontaneos(
      db,
      profileId,
      starters.map((s) => ({ id: s.id, type: s.type })),
      now,
    )
  }
}
