import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { parseInputKey } from '@/server/domain/inputKey'
import ConstructorReceta from '@/components/admin/ConstructorReceta'

export const runtime = 'nodejs'

export default async function PaginaNuevaReceta({
  searchParams,
}: {
  searchParams: Promise<{ ingredientes?: string }>
}) {
  await exigirAdminPagina()
  const { ingredientes: pre } = await searchParams

  const [elementos, caminos, categorias] = await Promise.all([
    prisma.element.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, iconKey: true, isActive: true },
    }),
    prisma.pathway.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  // Precarga desde /admin/combinaciones-fallidas: ?ingredientes=ojo*1|vision*1
  let iniciales: { elementId: string; quantity: number }[] = []
  if (pre) {
    try {
      const porSlug = new Map(elementos.map((e) => [e.slug, e.id]))
      iniciales = parseInputKey(pre).flatMap((i) => {
        const id = porSlug.get(i.slug)
        return id ? [{ elementId: id, quantity: i.quantity }] : []
      })
    } catch {
      iniciales = []
    }
  }

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Nueva receta
      </h1>
      <ConstructorReceta
        elementos={elementos}
        receta={null}
        ingredientesIniciales={iniciales}
        caminos={caminos}
        categorias={categorias}
      />
    </div>
  )
}
