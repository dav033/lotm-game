import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import FormularioCategoria from '@/components/admin/FormularioCategoria'

export const runtime = 'nodejs'

export default async function PaginaCategoriasAdmin({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  await exigirAdminPagina()
  const { editar } = await searchParams

  const categorias = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { parent: { select: { name: true } }, _count: { select: { elements: true, pathways: true } } },
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
                </td>
                <td className="text-fog">{c.parent?.name ?? '—'}</td>
                <td className="text-fog">{c.sortOrder}</td>
                <td className="text-fog">{c._count.elements} elementos · {c._count.pathways} caminos</td>
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
