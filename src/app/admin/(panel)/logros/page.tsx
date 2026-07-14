import Link from 'next/link'
import { prisma } from '@/server/db'
import { exigirAdminPagina } from '@/server/adminAuth'
import { alternarLogroActivo, eliminarLogro } from '@/server/actions/logros'
import { BotonEliminar } from '@/components/admin/BotonEliminar'
import { IconoElemento } from '@/components/game/IconoElemento'

export const runtime = 'nodejs'

export default async function PaginaLogrosAdmin() {
  await exigirAdminPagina()
  const achievements = await prisma.achievement.findMany({
    include: {
      triggerElement: true,
      triggerSequence: { include: { pathway: true } },
      _count: { select: { players: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-parchment">Logros</h1>
          <p className="mt-1 text-sm text-fog">Cada jugador puede obtener cada logro una sola vez.</p>
        </div>
        <Link href="/admin/logros/nuevo" className="btn-brass ml-auto">Nuevo logro</Link>
      </div>

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Logro</th>
              <th>Condición</th>
              <th>Jugadores</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {achievements.map((achievement) => (
              <tr key={achievement.id} className={achievement.isActive ? '' : 'opacity-50'}>
                <td>
                  <div className="flex items-center gap-2 text-parchment">
                    <IconoElemento iconKey={achievement.iconKey} className="h-5 w-5 text-brass" />
                    <span>{achievement.name}</span>
                    {achievement.isHiddenUntilUnlocked && <span className="text-xs text-fog">oculto</span>}
                  </div>
                </td>
                <td className="text-fog">
                  {achievement.triggerSequence
                    ? `${achievement.triggerSequence.pathway.name} · ${achievement.triggerSequence.number}: ${achievement.triggerSequence.name}`
                    : achievement.triggerElement?.name ?? 'Sin desencadenante'}
                </td>
                <td className="text-fog">{achievement._count.players}</td>
                <td>{achievement.isActive ? <span className="text-brass">activo</span> : <span className="text-fog">inactivo</span>}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/logros/${achievement.id}`} className="text-brass underline">Editar</Link>
                    <form action={alternarLogroActivo.bind(null, achievement.id)}>
                      <button type="submit" className="text-fog underline hover:text-parchment">
                        {achievement.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    <BotonEliminar
                      action={eliminarLogro.bind(null, achievement.id)}
                      confirmacion="¿Eliminar este logro y todos sus desbloqueos?"
                      className="text-wine underline hover:text-parchment"
                    >
                      Eliminar
                    </BotonEliminar>
                  </div>
                </td>
              </tr>
            ))}
            {achievements.length === 0 && (
              <tr><td colSpan={5} className="italic text-fog">Aún no hay logros configurados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
