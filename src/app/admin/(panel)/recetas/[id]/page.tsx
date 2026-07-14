import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { eliminarReceta } from '@/server/actions/recetas'
import ConstructorReceta from '@/components/admin/ConstructorReceta'
import { BotonEliminar } from '@/components/admin/BotonEliminar'

export const runtime = 'nodejs'

export default async function PaginaEditarReceta({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirAdminPagina()
  const { id } = await params

  const [receta, elementos, caminos, categorias] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
        outputs: { include: { element: true } },
      },
    }),
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
  if (!receta) notFound()

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-parchment">
          Editar receta
        </h1>
        <div className="flex gap-3">
          <Link href="/admin/recetas" className="btn-ghost">Volver</Link>
          <BotonEliminar
            action={eliminarReceta.bind(null, receta.id)}
            confirmacion="¿Eliminar esta receta? Esta acción no se puede deshacer."
            className="rounded-md border border-wine/30 bg-wine/10 px-4 py-2 text-sm text-wine hover:bg-wine/20"
          >
            Eliminar receta
          </BotonEliminar>
        </div>
      </div>
      <ConstructorReceta
        elementos={elementos}
        receta={{
          id: receta.id,
          name: receta.name ?? '',
          outputs: receta.outputs.map((o) => ({
            elementId: o.elementId,
            quantity: o.quantity,
            chance: o.chance,
            sortOrder: o.sortOrder,
          })),
          successText: receta.successText ?? '',
          hintText: receta.hintText ?? '',
          isActive: receta.isActive,
          ingredientes: receta.ingredients.map((i) => ({
            elementId: i.elementId,
            quantity: i.quantity,
          })),
        }}
        ingredientesIniciales={[]}
        caminos={caminos}
        categorias={categorias}
      />
    </div>
  )
}
