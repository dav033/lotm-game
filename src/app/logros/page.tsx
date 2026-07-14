import { Lock } from 'lucide-react'
import { prisma } from '@/server/db'
import { obtenerPerfilActual } from '@/server/perfil'
import { IconoElemento } from '@/components/game/IconoElemento'
import { reconciliarLogros } from '@/server/domain/logros'

export const runtime = 'nodejs'

export default async function PaginaLogros() {
  const profile = await obtenerPerfilActual()
  if (profile) await prisma.$transaction((tx) => reconciliarLogros(tx, profile.id))
  const [achievements, unlocked] = await Promise.all([
    prisma.achievement.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
    profile
      ? prisma.playerAchievement.findMany({
          where: { profileId: profile.id, achievement: { isActive: true } },
          select: { achievementId: true, unlockedAt: true },
        })
      : Promise.resolve([]),
  ])
  const unlockedById = new Map(unlocked.map((item) => [item.achievementId, item.unlockedAt]))

  return (
    <main className="mist-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-parchment">Logros</h1>
        <p className="mt-2 text-sm text-fog">
          {unlocked.length}/{achievements.length} desbloqueados
        </p>

        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((achievement) => {
            const unlockedAt = unlockedById.get(achievement.id)
            const hidden = achievement.isHiddenUntilUnlocked && !unlockedAt
            return (
              <li
                key={achievement.id}
                className={`rounded-lg mist-card p-5 ${unlockedAt ? 'brass-ring' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line2">
                    {hidden ? (
                      <Lock className="h-5 w-5 text-fog" aria-hidden />
                    ) : (
                      <IconoElemento iconKey={achievement.iconKey} className="h-6 w-6 text-brass" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-lg text-parchment">
                      {hidden ? 'Logro oculto' : achievement.name}
                    </h2>
                    <p className="mt-1 text-sm text-fog">
                      {hidden ? 'Su condición permanece sellada.' : achievement.description}
                    </p>
                    {unlockedAt && (
                      <p className="mt-2 text-xs text-brass-deep">
                        Desbloqueado el {unlockedAt.toLocaleDateString('es')}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {achievements.length === 0 && (
          <p className="mt-8 italic text-fog">Aún no hay logros configurados.</p>
        )}
      </div>
    </main>
  )
}
