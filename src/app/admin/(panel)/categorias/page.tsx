import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import FormularioCategoria from '@/components/admin/FormularioCategoria'
import { IconoElemento } from '@/components/game/IconoElemento'

export const runtime = 'nodejs'

const MAX_CHIPS = 12

export default async function PaginaCategoriasAdmin({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  await exigirAdminPagina()
  const { editar } = await searchParams

  const categorias = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { elements: true, pathways: true } },
      elements: {
        orderBy: { element: { name: 'asc' } },
        take: MAX_CHIPS + 1,
        include: { element: { select: { id: true, name: true, iconKey: true, isActive: true } } },
      },
    },
  })
  const enEdicion = editar ? categorias.find((c) => c.id === editar) ?? null : null

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Categorías
      </h1>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <FormularioCategoria
          categoria={
            enEdicion
              ? {
                  id: enEdicion.id,
                  slug: enEdicion.slug,
                  name: enEdicion.name,
                  description: enEdicion.description,
                  parentId: enEdicion.parentId,
                  sortOrder: enEdicion.sortOrder,
                  isHidden: enEdicion.isHidden,
                  isActive: enEdicion.isActive,
                }
              : null
          }
          padres={categorias.map((c) => ({ id: c.id, name: c.name }))}
        />
        {enEdicion && (
          <div className="self-start rounded-lg border border-line p-4 text-sm text-fog">
            Editando «{enEdicion.name}».{' '}
            <Link href="/admin/categorias" className="text-brass underline">Cancelar y crear una nueva</Link>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Padre</th>
              <th>Orden</th>
              <th>Contenido</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className={c.isActive ? '' : 'opacity-50'}>
                <td className="text-parchment">
                  {c.name} <code className="text-xs text-fog">({c.slug})</code>
                  {c.isHidden && <span className="ml-2 rounded border border-line2 px-1 text-[10px] text-fog">oculta</span>}
                  {c.elements.length > 0 && (
                    <details className="group mt-2">
                      <summary className="cursor-pointer list-none text-xs text-fog hover:text-brass">
                        <span className="group-open:hidden">▸ Ver elementos ({c._count.elements})</span>
                        <span className="hidden group-open:inline">▾ Ocultar elementos</span>
                      </summary>
                      <div className="mt-2 flex max-w-md flex-wrap gap-1.5">
                        {c.elements.slice(0, MAX_CHIPS).map(({ element }) => (
                          <Link
                            key={element.id}
                            href={`/admin/elementos/${element.id}`}
                            className={`flex items-center gap-1 rounded border border-line2 px-1.5 py-0.5 text-[11px] text-fog hover:border-brass hover:text-brass ${
                              element.isActive ? '' : 'opacity-50'
                            }`}
                          >
                            <IconoElemento iconKey={element.iconKey} className="h-3 w-3 text-brass" />
                            {element.name}
                          </Link>
                        ))}
                        {c._count.elements > MAX_CHIPS && (
                          <Link
                            href={`/admin/elementos?categoria=${c.id}`}
                            className="rounded border border-brass-deep px-1.5 py-0.5 text-[11px] text-brass hover:brightness-110"
                          >
                            +{c._count.elements - MAX_CHIPS} más →
                          </Link>
                        )}
                      </div>
                    </details>
                  )}
                </td>
                <td className="text-fog">
                  {c.parent ? (
                    <Link href={`/admin/categorias?editar=${c.parent.id}`} className="hover:text-brass hover:underline">
                      {c.parent.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="text-fog">{c.sortOrder}</td>
                <td>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <Link
                      href={`/admin/elementos?categoria=${c.id}`}
                      className="text-fog hover:text-brass hover:underline"
                      title="Ver sus elementos en la lista de elementos"
                    >
                      {c._count.elements} elementos
                    </Link>
                    <Link
                      href="/admin/caminos"
                      className="text-fog hover:text-brass hover:underline"
                      title="Gestionar sus caminos"
                    >
                      {c._count.pathways} caminos
                    </Link>
                  </div>
                </td>
                <td>{c.isActive ? <span className="text-brass">activa</span> : <span className="text-fog">inactiva</span>}</td>
                <td>
                  <Link href={`/admin/categorias?editar=${c.id}`} className="text-brass underline">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
