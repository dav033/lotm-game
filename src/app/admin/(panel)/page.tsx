import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'

export const runtime = 'nodejs'

export default async function PaginaResumenAdmin() {
  await exigirAdminPagina()

  const [
    elementosActivos,
    elementosTotal,
    recetasActivas,
    recetasTotal,
    avancesActivos,
    avancesTotal,
    logrosActivos,
    logrosTotal,
    categorias,
    caminos,
    secuencias,
    perfiles,
    fallidas,
  ] = await Promise.all([
    prisma.element.count({ where: { isActive: true } }),
    prisma.element.count(),
    prisma.recipe.count({ where: { isActive: true } }),
    prisma.recipe.count(),
    prisma.advance.count({ where: { isActive: true } }),
    prisma.advance.count(),
    prisma.achievement.count({ where: { isActive: true } }),
    prisma.achievement.count(),
    prisma.category.count(),
    prisma.pathway.count(),
    prisma.sequence.count(),
    prisma.playerProfile.count(),
    prisma.playerCombinationStat.count({
      where: { recipeId: null, advanceId: null, successes: 0 },
    }),
  ])

  const tarjetas = [
    { valor: `${elementosActivos}/${elementosTotal}`, label: 'Elementos activos', href: '/admin/elementos' },
    { valor: `${recetasActivas}/${recetasTotal}`, label: 'Recetas activas', href: '/admin/recetas' },
    { valor: `${avancesActivos}/${avancesTotal}`, label: 'Avances activos', href: '/admin/avances' },
    { valor: `${logrosActivos}/${logrosTotal}`, label: 'Logros activos', href: '/admin/logros' },
    { valor: String(categorias), label: 'Categorías', href: '/admin/categorias' },
    { valor: String(caminos), label: 'Caminos', href: '/admin/caminos' },
    { valor: String(secuencias), label: 'Secuencias', href: '/admin/caminos' },
    { valor: String(perfiles), label: 'Perfiles de jugador', href: '/admin' },
    { valor: String(fallidas), label: 'Combinaciones sin receta', href: '/admin/combinaciones-fallidas' },
  ]

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-parchment">Resumen</h1>
      <p className="mb-6 text-sm text-fog">
        Estado general del contenido del juego. Todo lo que edites aquí funciona
        inmediatamente, sin reiniciar la aplicación.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-lg mist-card p-4 transition hover:border-brass-deep">
            <div className="text-2xl font-bold text-brass">{t.valor}</div>
            <div className="text-xs uppercase tracking-wider text-fog">{t.label}</div>
          </Link>
        ))}
      </div>
      <div className="mt-8 rounded-lg mist-card p-5 text-sm text-fog">
        <h2 className="mb-2 font-semibold text-parchment">Flujo recomendado</h2>
        <ol className="list-inside list-decimal space-y-1">
          <li>Revisa las <Link className="text-brass underline" href="/admin/combinaciones-fallidas">combinaciones fallidas</Link>: son las ideas que los jugadores ya intentaron.</li>
          <li>Crea el <Link className="text-brass underline" href="/admin/elementos">elemento</Link> resultante si aún no existe.</li>
          <li>Convierte la combinación en <Link className="text-brass underline" href="/admin/recetas">receta</Link> con un clic desde la lista de fallidas.</li>
          <li>Pasa por <Link className="text-brass underline" href="/admin/diagnostico">diagnóstico</Link> para verificar que todo sigue alcanzable.</li>
        </ol>
      </div>
    </div>
  )
}
