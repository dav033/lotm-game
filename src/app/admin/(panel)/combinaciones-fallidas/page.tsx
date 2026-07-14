import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { parseInputKey } from '@/server/domain/inputKey'

export const runtime = 'nodejs'

// Las ideas de los jugadores: combinaciones intentadas que aún no tienen
// receta. El botón de la derecha convierte cada una en receta en un clic.
export default async function PaginaCombinacionesFallidas() {
  await exigirAdminPagina()

  const grupos = await prisma.playerCombinationStat.groupBy({
    by: ['inputKey'],
    where: { recipeId: null, advanceId: null, successes: 0 },
    _sum: { attempts: true },
    _count: { profileId: true },
    _min: { firstAttemptAt: true },
    _max: { lastAttemptAt: true },
  })

  // Excluye combinaciones que YA tienen receta (creada después de los intentos).
  const claves = grupos.map((g) => g.inputKey)
  const conReceta = new Set(
    (
      await prisma.recipe.findMany({
        where: { inputKey: { in: claves } },
        select: { inputKey: true },
      })
    ).map((r) => r.inputKey),
  )

  const pendientes = grupos
    .filter((g) => !conReceta.has(g.inputKey))
    .sort((a, b) => (b._sum.attempts ?? 0) - (a._sum.attempts ?? 0))

  // Traducir slugs a nombres visibles.
  const slugs = new Set(pendientes.flatMap((g) => parseInputKey(g.inputKey).map((i) => i.slug)))
  const elementos = await prisma.element.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, name: true },
  })
  const nombreDe = new Map(elementos.map((e) => [e.slug, e.name]))

  const fecha = (d: Date | null) =>
    d ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(d) : '—'

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Combinaciones fallidas
      </h1>
      <p className="mb-4 text-sm text-fog">
        Lo que los jugadores intentaron y todavía no responde. Conviértelas en
        recetas para que empiecen a funcionar de inmediato.
      </p>

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Elementos intentados</th>
              <th>Clave interna</th>
              <th>Intentos</th>
              <th>Jugadores</th>
              <th>Primer intento</th>
              <th>Último intento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((g) => {
              const partes = parseInputKey(g.inputKey)
              return (
                <tr key={g.inputKey}>
                  <td className="text-parchment">
                    {partes
                      .map((p) => `${nombreDe.get(p.slug) ?? p.slug} × ${p.quantity}`)
                      .join(' + ')}
                  </td>
                  <td><code className="text-xs text-fog">{g.inputKey}</code></td>
                  <td className="text-fog">{g._sum.attempts ?? 0}</td>
                  <td className="text-fog">{g._count.profileId}</td>
                  <td className="text-fog">{fecha(g._min.firstAttemptAt)}</td>
                  <td className="text-fog">{fecha(g._max.lastAttemptAt)}</td>
                  <td>
                    <Link
                      href={`/admin/recetas/nueva?ingredientes=${encodeURIComponent(g.inputKey)}`}
                      className="text-brass underline"
                    >
                      Crear receta a partir de esta combinación
                    </Link>
                  </td>
                </tr>
              )
            })}
            {pendientes.length === 0 && (
              <tr>
                <td colSpan={7} className="italic text-fog">
                  No hay combinaciones fallidas pendientes. El archivo está tranquilo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
