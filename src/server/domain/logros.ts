import type { Db } from '../db'
import type { AchievementPublicData } from './tipos'

function toPublicAchievement(
  achievement: {
    id: string
    slug: string
    name: string
    description: string
    iconKey: string
  },
  unlockedAt: Date,
): AchievementPublicData {
  return {
    id: achievement.id,
    slug: achievement.slug,
    name: achievement.name,
    description: achievement.description,
    iconKey: achievement.iconKey,
    unlockedAt: unlockedAt.toISOString(),
  }
}

export async function concederLogrosPorElementos(
  db: Db,
  profileId: string,
  elementIds: string[],
  now = new Date(),
): Promise<AchievementPublicData[]> {
  const uniqueIds = [...new Set(elementIds)]
  if (uniqueIds.length === 0) return []

  const achievements = await db.achievement.findMany({
    where: {
      isActive: true,
      OR: [
        { triggerElementId: { in: uniqueIds } },
        { triggerSequence: { elementId: { in: uniqueIds } } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })
  if (achievements.length === 0) return []

  const existing = await db.playerAchievement.findMany({
    where: { profileId, achievementId: { in: achievements.map((achievement) => achievement.id) } },
    select: { achievementId: true },
  })
  const existingIds = new Set(existing.map((item) => item.achievementId))
  const unlocked: AchievementPublicData[] = []

  for (const achievement of achievements) {
    if (existingIds.has(achievement.id)) continue
    await db.playerAchievement.create({
      data: { profileId, achievementId: achievement.id, unlockedAt: now },
    })
    unlocked.push(toPublicAchievement(achievement, now))
  }

  return unlocked
}

export async function reconciliarLogros(
  db: Db,
  profileId: string,
  now = new Date(),
): Promise<AchievementPublicData[]> {
  const discoveries = await db.playerDiscovery.findMany({
    where: { profileId },
    select: { elementId: true },
  })
  return concederLogrosPorElementos(
    db,
    profileId,
    discoveries.map((discovery) => discovery.elementId),
    now,
  )
}

export async function obtenerLogrosPendientes(
  db: Db,
  profileId: string,
): Promise<AchievementPublicData[]> {
  const pending = await db.playerAchievement.findMany({
    where: { profileId, notifiedAt: null, achievement: { isActive: true } },
    include: { achievement: true },
    orderBy: { unlockedAt: 'asc' },
  })
  return pending.map((item) => toPublicAchievement(item.achievement, item.unlockedAt))
}

export async function marcarLogrosNotificados(
  db: Db,
  profileId: string,
  achievementIds: string[],
): Promise<void> {
  if (achievementIds.length === 0) return
  await db.playerAchievement.updateMany({
    where: {
      profileId,
      achievementId: { in: [...new Set(achievementIds)] },
      notifiedAt: null,
    },
    data: { notifiedAt: new Date() },
  })
}
