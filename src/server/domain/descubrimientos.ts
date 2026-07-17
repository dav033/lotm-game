import type { Db } from '../db'
import { toPublicElement } from './publicos'
import type { RecetaPendiente } from './tipos'

// Descubrimientos espontáneos: elementos que ninguna receta fabrica y que se
// desbloquean solos cuando el jugador descubre (a) cualquier elemento de un
// tipo (Element.unlockedByType), (b) un elemento concreto de su lista de
// desencadenantes, (c) cualquier secuencia de un número configurado o (d) el
// conjunto completo de requisitos AND. Procesa en cascada — un desbloqueo
// puede habilitar otros — y cada tipo/elemento se consulta una sola vez, así
// que termina siempre. Devuelve los elementos recién desbloqueados.
export async function desbloquearEspontaneos(
  db: Db,
  profileId: string,
  descubiertos: { id: string; type: string }[],
  now: Date,
) {
  const desbloqueados = []

  // Caché única de descubrimientos previos para evitar findUnique N+1.
  const descubiertosSet = new Set<string>(
    (
      await db.playerDiscovery.findMany({
        where: { profileId },
        select: { elementId: true },
      })
    ).map((d) => d.elementId),
  )
  for (const d of descubiertos) descubiertosSet.add(d.id)

  const tiposProcesados = new Set<string>()
  const idsProcesados = new Set<string>()
  let tipos = [...new Set(descubiertos.map((d) => d.type))]
  let ids = [...new Set(descubiertos.map((d) => d.id))]

  while (tipos.length > 0 || ids.length > 0) {
    for (const t of tipos) tiposProcesados.add(t)
    for (const i of ids) idsProcesados.add(i)

    const sequenceNumbers =
      ids.length > 0
        ? [
            ...new Set(
              (
                await db.sequence.findMany({
                  where: { elementId: { in: ids } },
                  select: { number: true },
                })
              ).map((sequence) => sequence.number),
            ),
          ]
        : []

    const candidatosOR = await db.element.findMany({
      where: {
        isActive: true,
        OR: [
          ...(tipos.length > 0 ? [{ unlockedByType: { in: tipos } }] : []),
          ...(ids.length > 0
            ? [{ unlockTriggers: { some: { triggerId: { in: ids } } } }]
            : []),
          ...(sequenceNumbers.length > 0
            ? [{ unlockedBySequenceNumber: { in: sequenceNumbers } }]
            : []),
        ],
      },
    })

    const candidatosAND = await db.element.findMany({
      where: {
        isActive: true,
        unlockRequirements: { some: {} },
      },
      include: {
        unlockRequirements: { select: { requiredElementId: true } },
      },
    })

    const tiposNuevos = new Set<string>()
    const idsNuevos = new Set<string>()
    const procesadosEstaRonda = new Set<string>()

    for (const el of candidatosOR) {
      if (procesadosEstaRonda.has(el.id)) continue
      procesadosEstaRonda.add(el.id)
      if (descubiertosSet.has(el.id)) continue
      await db.playerDiscovery.create({
        data: { profileId, elementId: el.id, firstDiscoveredAt: now, lastCreatedAt: now },
      })
      descubiertosSet.add(el.id)
      desbloqueados.push(el)
      tiposNuevos.add(el.type)
      idsNuevos.add(el.id)
    }

    for (const el of candidatosAND) {
      if (procesadosEstaRonda.has(el.id)) continue
      if (descubiertosSet.has(el.id)) continue
      const requiredIds = el.unlockRequirements.map((r) => r.requiredElementId)
      if (requiredIds.every((id) => descubiertosSet.has(id))) {
        await db.playerDiscovery.create({
          data: { profileId, elementId: el.id, firstDiscoveredAt: now, lastCreatedAt: now },
        })
        descubiertosSet.add(el.id)
        desbloqueados.push(el)
        tiposNuevos.add(el.type)
        idsNuevos.add(el.id)
      }
    }

    tipos = [...tiposNuevos].filter((t) => !tiposProcesados.has(t))
    ids = [...idsNuevos].filter((i) => !idsProcesados.has(i))
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

// Marca como descubiertos todos los elementos iniciales (Ojo, Moneda, Tiempo, Tierra)
// y dispara los desbloqueos espontáneos que esos starters puedan causar.
// Vive en el dominio (sin dependencias de Next) para poder probarse aislado.
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
