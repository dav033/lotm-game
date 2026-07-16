import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { etiquetaTipo } from '@/server/domain/tipos'
import {
  ArbolConexiones,
  type AristaArbol,
  type CaminoLeyenda,
  type NodoArbol,
} from '@/components/admin/ArbolConexiones'

export const runtime = 'nodejs'

// Mapa completo del contenido: qué crea qué, por dónde pasan los caminos y
// dónde encajan avances y rituales. Solo admin: es el spoiler definitivo.
export default async function PaginaArbolAdmin() {
  await exigirAdminPagina()

  const [elementos, recetas, avances, rituales, caminos] = await Promise.all([
    prisma.element.findMany({
      include: { sequence: { include: { pathway: true } } },
    }),
    prisma.recipe.findMany({
      include: {
        ingredients: { include: { element: { select: { id: true, name: true } } } },
        outputs: { include: { element: { select: { id: true } } } },
      },
    }),
    prisma.advance.findMany({
      include: {
        ingredients: { include: { element: { select: { id: true, name: true } } } },
        sourceSequence: { include: { pathway: true } },
        targetSequence: { include: { pathway: true } },
      },
    }),
    prisma.ritual.findMany({
      include: {
        ingredients: { include: { element: { select: { id: true, name: true } } } },
        advance: { select: { targetSequence: { select: { pathwayId: true } } } },
      },
    }),
    prisma.pathway.findMany({ orderBy: { createdAt: 'asc' } }),
  ])

  // El índice del camino decide su color en el cliente; orden estable por
  // fecha de creación para que no cambie al renombrar.
  const indiceCamino = new Map(caminos.map((camino, index) => [camino.id, index]))
  const leyenda: CaminoLeyenda[] = caminos.map((camino, index) => ({
    nombre: camino.name,
    index,
  }))

  const nodos: NodoArbol[] = []
  const aristas: AristaArbol[] = []

  for (const el of elementos) {
    nodos.push({
      id: `el:${el.id}`,
      nombre: el.name,
      clase: el.sequence ? 'secuencia' : 'elemento',
      tipo: etiquetaTipo(el.type),
      tier: el.tier,
      caminoIndex: el.sequence ? (indiceCamino.get(el.sequence.pathwayId) ?? null) : null,
      secuencia: el.sequence?.number ?? null,
      inicial: el.isStarter,
      activo: el.isActive,
      espontaneo: el.unlockedByType !== null || el.unlockedBySequenceNumber !== null,
    })
  }

  for (const receta of recetas) {
    const via =
      receta.name ??
      receta.ingredients
        .map((i) => (i.quantity > 1 ? `${i.element.name} × ${i.quantity}` : i.element.name))
        .join(' + ')
    for (const ingrediente of receta.ingredients) {
      for (const salida of receta.outputs) {
        aristas.push({
          de: `el:${ingrediente.elementId}`,
          a: `el:${salida.elementId}`,
          tipo: 'receta',
          via,
        })
      }
    }
  }

  for (const avance of avances) {
    const idAvance = `av:${avance.id}`
    nodos.push({
      id: idAvance,
      nombre: avance.internalName,
      clase: 'avance',
      tipo: 'Avance',
      tier: 0,
      caminoIndex: indiceCamino.get(avance.targetSequence.pathwayId) ?? null,
      secuencia: null,
      inicial: false,
      activo: avance.isActive,
      espontaneo: false,
    })
    const viaIngredientes = avance.ingredients
      .map((i) => (i.quantity > 1 ? `${i.element.name} × ${i.quantity}` : i.element.name))
      .join(' + ')
    for (const ingrediente of avance.ingredients) {
      aristas.push({
        de: `el:${ingrediente.elementId}`,
        a: idAvance,
        tipo: 'creacion',
        via: viaIngredientes,
      })
    }
    // La secuencia origen se combina con el avance; el resultado es la destino.
    aristas.push({
      de: `el:${avance.sourceSequence.elementId}`,
      a: idAvance,
      tipo: 'requisito',
      via: `${avance.sourceSequence.pathway.name} · Secuencia ${avance.sourceSequence.number}`,
    })
    aristas.push({
      de: idAvance,
      a: `el:${avance.targetSequence.elementId}`,
      tipo: 'ascension',
      via: `${avance.targetSequence.pathway.name} · Secuencia ${avance.targetSequence.number}`,
    })
  }

  for (const ritual of rituales) {
    const idRitual = `rit:${ritual.id}`
    nodos.push({
      id: idRitual,
      nombre: ritual.name,
      clase: 'ritual',
      tipo: 'Ritual',
      tier: 0,
      // Hereda el camino del avance que protege: así se agrupa y colorea junto a él.
      caminoIndex: indiceCamino.get(ritual.advance.targetSequence.pathwayId) ?? null,
      secuencia: null,
      inicial: false,
      activo: ritual.isActive,
      espontaneo: false,
    })
    for (const ingrediente of ritual.ingredients) {
      aristas.push({
        de: `el:${ingrediente.elementId}`,
        a: idRitual,
        tipo: 'ritual',
        via: ritual.name,
      })
    }
    aristas.push({
      de: idRitual,
      a: `av:${ritual.advanceId}`,
      tipo: 'ritual',
      via: 'Requisito para sobrevivir al avance',
    })
  }

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Árbol de habilidades
      </h1>
      <p className="mb-4 text-sm text-fog">
        {nodos.length} habilidades y {aristas.length} conexiones. Explora las ramas de recetas,
        avances, secuencias y rituales como un mapa de progresión.
      </p>
      <ArbolConexiones nodos={nodos} aristas={aristas} caminos={leyenda} />
    </div>
  )
}
