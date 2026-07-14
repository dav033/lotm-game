import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { eliminarSecuencia } from '@/server/actions/caminos'
import { FormularioCamino, FormularioSecuencia } from '@/components/admin/FormularioCamino'

export const runtime = 'nodejs'

export default async function PaginaCaminosAdmin({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  await exigirAdminPagina()
  const { editar } = await searchParams

  const [caminos, categorias, elementos] = await Promise.all([
    prisma.pathway.findMany({
      orderBy: { name: 'asc' },
      include: {
        category: { select: { name: true } },
        sequences: { orderBy: { number: 'desc' }, include: { element: { select: { name: true } } } },
      },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.element.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, iconKey: true, isActive: true },
    }),
  ])
  const enEdicion = editar ? caminos.find((c) => c.id === editar) ?? null : null

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Caminos y secuencias
      </h1>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <FormularioCamino
          camino={
            enEdicion
              ? {
                  id: enEdicion.id,
                  slug: enEdicion.slug,
                  name: enEdicion.name,
                  description: enEdicion.description,
                  categoryId: enEdicion.categoryId,
                  iconKey: enEdicion.iconKey,
                  isHiddenUntilDiscovered: enEdicion.isHiddenUntilDiscovered,
                  isActive: enEdicion.isActive,
                }
              : null
          }
          categorias={categorias}
        />
        <FormularioSecuencia
          caminos={caminos.map((c) => ({ id: c.id, name: c.name }))}
          elementos={elementos}
        />
      </div>

      {enEdicion && (
        <p className="mb-4 text-sm text-fog">
          Editando «{enEdicion.name}».{' '}
          <Link href="/admin/caminos" className="text-brass underline">Cancelar y crear uno nuevo</Link>
        </p>
      )}

      <div className="space-y-4">
        {caminos.map((c) => (
          <div key={c.id} className={`rounded-lg mist-card p-4 ${c.isActive ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-lg text-brass">{c.name}</h2>
              <span className="text-xs text-fog">categoría: {c.category.name}</span>
              {c.isHiddenUntilDiscovered && (
                <span className="rounded border border-line2 px-1 text-[10px] text-fog">oculto hasta descubrir</span>
              )}
              {!c.isActive && <span className="text-xs text-wine">inactivo</span>}
              <Link href={`/admin/caminos?editar=${c.id}`} className="ml-auto text-sm text-brass underline">
                Editar
              </Link>
            </div>
            {c.description && <p className="mt-1 text-sm italic text-fog">{c.description}</p>}
            <ul className="mt-3 space-y-1">
              {c.sequences.map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="text-parchment">
                    Secuencia {s.number}: {s.name}
                  </span>
                  <span className="text-fog">— elemento: {s.element.name}</span>
                  <form action={eliminarSecuencia.bind(null, s.id)}>
                    <button type="submit" className="text-fog underline hover:text-wine">Quitar</button>
                  </form>
                </li>
              ))}
              {c.sequences.length === 0 && (
                <li className="text-sm italic text-fog">Sin secuencias todavía.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
