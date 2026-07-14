import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { alternarRecetaActiva, eliminarReceta } from '@/server/actions/recetas'
import { BotonEliminar } from '@/components/admin/BotonEliminar'

export const runtime = 'nodejs'

export default async function PaginaRecetasAdmin() {
  await exigirAdminPagina()
  const recetas = await prisma.recipe.findMany({
    include: {
      outputs: { include: { element: { select: { name: true, isActive: true } } } },
      ingredients: { include: { element: { select: { name: true, isActive: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-parchment">Recetas</h1>
        <Link href="/admin/recetas/nueva" className="btn-brass ml-auto inline-block">Nueva receta</Link>
      </div>

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Combinación</th>
              <th>Clave interna</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recetas.map((r) => (
              <tr key={r.id} className={r.isActive ? '' : 'opacity-50'}>
                <td className="text-parchment">
                  {r.ingredients.map((i) => `${i.element.name} × ${i.quantity}`).join(' + ')}{' '}
                  <span className="text-brass">→ {r.outputs.map((o) => o.element.name).join(', ')}</span>
                  {(r.outputs.some((o) => !o.element.isActive) ||
                    r.ingredients.some((i) => !i.element.isActive)) && (
                    <span className="ml-2 text-xs text-wine">(usa elementos inactivos)</span>
                  )}
                </td>
                <td><code className="text-xs text-fog">{r.inputKey}</code></td>
                <td>{r.isActive ? <span className="text-brass">activa</span> : <span className="text-fog">inactiva</span>}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/recetas/${r.id}`} className="text-brass underline">Editar</Link>
                    <form action={alternarRecetaActiva.bind(null, r.id)}>
                      <button type="submit" className="text-fog underline hover:text-parchment">
                        {r.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    <BotonEliminar
                      action={eliminarReceta.bind(null, r.id)}
                      confirmacion="¿Eliminar esta receta? Esta acción no se puede deshacer."
                      className="text-wine underline hover:text-parchment"
                    >
                      Eliminar
                    </BotonEliminar>
                  </div>
                </td>
              </tr>
            ))}
            {recetas.length === 0 && (
              <tr><td colSpan={4} className="italic text-fog">Aún no hay recetas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
