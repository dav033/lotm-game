import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import FormularioElemento from '@/components/admin/FormularioElemento'

export const runtime = 'nodejs'

export default async function PaginaNuevoElemento() {
  await exigirAdminPagina()
  const [categorias, elementos] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.element.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, iconKey: true, isActive: true },
    }),
  ])

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Nuevo elemento
      </h1>
      <FormularioElemento
        elemento={null}
        categorias={categorias}
        elementos={elementos}
        slugBloqueado={false}
      />
    </div>
  )
}
