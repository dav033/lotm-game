import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { alternarAvanceActivo, eliminarAvance } from '@/server/actions/avances'
import { BotonEliminar } from '@/components/admin/BotonEliminar'

export const runtime = 'nodejs'

export default async function PaginaAvancesAdmin() {
  await exigirAdminPagina()
  const advances = await prisma.advance.findMany({
    include: {
      ingredients: { include: { element: true }, orderBy: { id: 'asc' } },
      sourceSequence: { include: { pathway: true } },
      targetSequence: { include: { pathway: true } },
      _count: { select: { players: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-parchment">Avances</h1>
          <p className="mt-1 text-sm text-fog">El nombre y el destino reales nunca se muestran al jugador.</p>
        </div>
        <Link href="/admin/avances/nuevo" className="btn-brass ml-auto">Nuevo avance</Link>
      </div>

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre interno</th>
              <th>Fórmula pública</th>
              <th>Progresión</th>
              <th>En posesión</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {advances.map((advance) => (
              <tr key={advance.id} className={advance.isActive ? '' : 'opacity-50'}>
                <td className="text-parchment">{advance.internalName}</td>
                <td className="text-fog">
                  {advance.ingredients.map((i) => `${i.element.name} × ${i.quantity}`).join(' + ')}
                </td>
                <td className="text-fog">
                  {advance.sourceSequence.pathway.name} · {advance.sourceSequence.number}: {advance.sourceSequence.name}
                  {' → '}
                  {advance.targetSequence.number}: {advance.targetSequence.name}
                </td>
                <td className="text-fog">{advance._count.players}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/avances/${advance.id}`} className="text-brass underline">Editar</Link>
                    <form action={alternarAvanceActivo.bind(null, advance.id)}>
                      <button className="text-fog underline hover:text-parchment" type="submit">
                        {advance.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    <BotonEliminar
                      action={eliminarAvance.bind(null, advance.id)}
                      confirmacion="¿Eliminar este avance y retirarlo de todos los jugadores?"
                      className="text-wine underline hover:text-parchment"
                    >
                      Eliminar
                    </BotonEliminar>
                  </div>
                </td>
              </tr>
            ))}
            {advances.length === 0 && (
              <tr><td colSpan={5} className="italic text-fog">Aún no hay avances configurados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
