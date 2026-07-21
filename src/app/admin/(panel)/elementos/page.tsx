import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { cargarAnalisisProgresion } from '@/server/services/progresion'
import { etiquetaTipo } from '@/server/domain/tipos'
import { ExploradorElementos, type ElementoVista } from '@/components/admin/ExploradorElementos'

export const runtime = 'nodejs'

// Lista viva de elementos: se cargan todos de una vez junto al análisis de
// progresión (profundidad, dificultad, alcanzabilidad) y el filtrado ocurre
// en el cliente, instantáneo. Los filtros iniciales llegan por URL, así las
// categorías pueden enlazar aquí con su filtro ya aplicado.
export default async function PaginaElementosAdmin({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    tipo?: string
    estado?: string
    categoria?: string
    progresion?: string
    orden?: string
  }>
}) {
  await exigirAdminPagina()
  const { q = '', tipo = '', estado = '', categoria = '', progresion = '', orden = '' } =
    await searchParams

  const [elementos, categorias, progresionAnalisis] = await Promise.all([
    prisma.element.findMany({
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
      include: {
        sequence: { include: { pathway: { select: { name: true } } } },
        categories: { include: { category: { select: { id: true, name: true } } } },
        _count: { select: { outputs: true, usedIn: true, unlockTriggers: true } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    cargarAnalisisProgresion(prisma),
  ])

  const vista: ElementoVista[] = elementos.map((e) => {
    const res = progresionAnalisis.analisis.get(e.id)
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      iconKey: e.iconKey,
      type: e.type,
      tier: e.tier,
      isActive: e.isActive,
      isStarter: e.isStarter,
      isMajorDiscovery: e.isMajorDiscovery,
      espontaneo:
        e.unlockedByType || e.unlockedAtDiscoveryCount != null || e._count.unlockTriggers > 0
          ? `Descubrimiento espontáneo${e.unlockedByType ? ` · por tipo ${etiquetaTipo(e.unlockedByType)}` : ''}${e.unlockedAtDiscoveryCount != null ? ` · desde ${e.unlockedAtDiscoveryCount} descubrimientos` : ''}${e._count.unlockTriggers > 0 ? ` · ${e._count.unlockTriggers} desencadenante(s)` : ''}`
          : null,
      secuencia: e.sequence
        ? { numero: e.sequence.number, camino: e.sequence.pathway.name }
        : null,
      categorias: e.categories.map((c) => ({
        id: c.category.id,
        name: c.category.name,
        isPrimary: c.isPrimary,
      })),
      produceEn: e._count.outputs,
      participaEn: e._count.usedIn,
      profundidad: res?.depth ?? null,
      alcanzable: res?.reachable ?? false,
      dificultad: res?.difficulty ?? 'impossible',
    }
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-parchment">Elementos</h1>
        <Link href="/admin/elementos/nuevo" className="btn-brass ml-auto inline-block">
          Nuevo elemento
        </Link>
      </div>

      <ExploradorElementos
        elementos={vista}
        categorias={categorias}
        inicial={{
          ...(q ? { q } : {}),
          ...(tipo ? { tipo } : {}),
          ...(estado ? { estado } : {}),
          ...(categoria ? { categoria } : {}),
          ...(progresion ? { progresion } : {}),
          ...(orden === 'nombre' || orden === 'profundidad' ? { orden } : {}),
        }}
      />
    </div>
  )
}
