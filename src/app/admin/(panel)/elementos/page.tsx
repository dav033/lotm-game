import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { alternarElementoActivo, eliminarElemento } from '@/server/actions/elementos'
import { IconoElemento } from '@/components/game/IconoElemento'
import { BotonEliminar } from '@/components/admin/BotonEliminar'
import { FiltrosElementos } from '@/components/admin/FiltrosElementos'
import { etiquetaTipo } from '@/server/domain/tipos'

export const runtime = 'nodejs'

export default async function PaginaElementosAdmin({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string }>
}) {
  await exigirAdminPagina()
  const { q = '', tipo = '', estado = '' } = await searchParams

  const elementos = await prisma.element.findMany({
    where: {
      ...(q ? { name: { contains: q } } : {}),
      ...(tipo ? { type: tipo } : {}),
      ...(estado === 'activos' ? { isActive: true } : {}),
      ...(estado === 'inactivos' ? { isActive: false } : {}),
    },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    include: {
      sequence: true,
      _count: { select: { outputs: true, usedIn: true, unlockTriggers: true } },
    },
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-parchment">Elementos</h1>
        <Link href="/admin/elementos/nuevo" className="btn-brass ml-auto inline-block">
          Nuevo elemento
        </Link>
      </div>

      <FiltrosElementos inicial={{ q, tipo, estado }} />

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Elemento</th>
              <th>Tipo</th>
              <th>Nivel</th>
              <th>Recetas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {elementos.map((e) => (
              <tr key={e.id} className={e.isActive ? '' : 'opacity-50'}>
                <td>
                  <div className="flex items-center gap-2">
                    <IconoElemento iconKey={e.iconKey} className="h-4 w-4 text-brass" />
                    <span className="text-parchment">{e.name}</span>
                    {e.isStarter && <span className="rounded border border-brass-deep px-1 text-[10px] text-brass">inicial</span>}
                    {e.isMajorDiscovery && <span className="rounded border border-wine px-1 text-[10px] text-parchment">mayor</span>}
                    {e.sequence && <span className="rounded border border-line2 px-1 text-[10px] text-fog">seq {e.sequence.number}</span>}
                    {(e.unlockedByType || e._count.unlockTriggers > 0) && (
                      <span
                        className="rounded border border-line2 px-1 text-[10px] text-fog"
                        title={`Descubrimiento espontáneo${e.unlockedByType ? ` · por tipo ${etiquetaTipo(e.unlockedByType)}` : ''}${e._count.unlockTriggers > 0 ? ` · ${e._count.unlockTriggers} desencadenante(s)` : ''}`}
                      >
                        espontáneo
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-fog">{e.type}</td>
                <td className="text-fog">{e.tier}</td>
                <td className="text-fog">
                  lo producen {e._count.outputs} · participa en {e._count.usedIn}
                </td>
                <td>{e.isActive ? <span className="text-brass">activo</span> : <span className="text-fog">inactivo</span>}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/elementos/${e.id}`} className="text-brass underline">Editar</Link>
                    <form action={alternarElementoActivo.bind(null, e.id)}>
                      <button type="submit" className="text-fog underline hover:text-parchment">
                        {e.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    {!e.isStarter && (
                      <BotonEliminar
                        action={eliminarElemento.bind(null, e.id)}
                        confirmacion={`¿Eliminar «${e.name}»? También se eliminarán las recetas donde participa. Esta acción no se puede deshacer.`}
                        className="text-wine underline hover:text-parchment"
                      >
                        Eliminar
                      </BotonEliminar>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {elementos.length === 0 && (
              <tr><td colSpan={6} className="italic text-fog">No hay elementos que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
