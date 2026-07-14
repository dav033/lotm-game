import type { Db } from '../db'
import { toPublicElement } from './publicos'
import type { RecetaPendiente } from './tipos'

// Descubrimientos espontáneos: elementos que ninguna receta fabrica y que se
// desbloquean solos cuando el jugador descubre (a) cualquier elemento de un
// tipo (Element.unlockedByType), (b) un elemento concreto de su lista de
// desencadenantes o (c) cualquier secuencia de un número configurado. Procesa
// en cascada — un desbloqueo puede habilitar otros — y cada tipo/elemento se
// consulta una sola vez, así que termina siempre. Devuelve los elementos
// recién desbloqueados.
export async function desbloquearEspontaneos(
  db: Db,
  profileId: string,
  descubiertos: { id: string; type: string }[],
  now: Date,
) {
  const desbloqueados = []
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

    const candidatos = await db.element.findMany({
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

    const tiposNuevos = new Set<string>()
    const idsNuevos = new Set<string>()
    for (const el of candidatos) {
      const previo = await db.playerDiscovery.findUnique({
        where: { profileId_elementId: { profileId, elementId: el.id } },
      })
      if (previo) continue
      await db.playerDiscovery.create({
        data: { profileId, elementId: el.id, firstDiscoveredAt: now, lastCreatedAt: now },
      })
      desbloqueados.push(el)
      tiposNuevos.add(el.type)
      idsNuevos.add(el.id)
    }
    tipos = [...tiposNuevos].filter((t) => !tiposProcesados.has(t))
    ids = [...idsNuevos].filter((i) => !idsProcesados.has(i))
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

  const pendientes: RecetaPendiente[] = []
  for (const r of recetas) {
    const resultadosActivos = r.outputs.filter((o) => o.element.isActive)
    if (resultadosActivos.length === 0) continue
    const completa = resultadosActivos.every((o) => descubiertos.has(o.elementId))
    if (completa) continue

    pendientes.push({
      recipeId: r.id,
      ingredientes: r.ingredients.map((i) => ({
        ...toPublicElement(i.element),
        quantity: i.quantity,
      })),
      resultados: resultadosActivos.map((o) => ({
        ...toPublicElement(o.element),
        quantity: o.quantity,
      })),
    })
  }
  return pendientes
}

// Marca como descubiertos todos los elementos iniciales (Ojo, Moneda, Humano).
// Vive en el dominio (sin dependencias de Next) para poder probarse aislado.
export async function descubrirIniciales(db: Db, profileId: string) {
  const starters = await db.element.findMany({
    where: { isStarter: true, isActive: true },
    select: { id: true },
  })
  for (const s of starters) {
    await db.playerDiscovery.upsert({
      where: { profileId_elementId: { profileId, elementId: s.id } },
      create: { profileId, elementId: s.id },
      update: {},
    })
  }
}
