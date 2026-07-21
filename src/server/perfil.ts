import { cookies } from 'next/headers'
import { prisma } from './db'
import { descubrirIniciales } from './domain/descubrimientos'

export const PROFILE_COOKIE = 'mist_perfil'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // un año
}

// Devuelve el perfil de la cookie si existe y es válido; no crea nada.
export async function obtenerPerfilActual() {
  const store = await cookies()
  const id = store.get(PROFILE_COOKIE)?.value
  if (!id) return null
  return prisma.playerProfile.findUnique({ where: { id } })
}

// Para Route Handlers y Server Actions: garantiza un perfil válido, creando
// uno nuevo (con sus descubrimientos iniciales) y fijando la cookie si falta.
export async function asegurarPerfil() {
  const store = await cookies()
  const id = store.get(PROFILE_COOKIE)?.value
  if (id) {
    const existing = await prisma.playerProfile.findUnique({ where: { id } })
    if (existing) {
      // Reconcilia starters y desbloqueos declarativos añadidos después de que
      // el perfil fue creado, sin reiniciar ni alterar descubrimientos previos.
      await descubrirIniciales(prisma, existing.id)
      return existing
    }
  }
  const profile = await prisma.playerProfile.create({ data: {} })
  await descubrirIniciales(prisma, profile.id)
  store.set(PROFILE_COOKIE, profile.id, COOKIE_OPTIONS)
  return profile
}

// Borra el progreso del perfil actual y vuelve a otorgar los iniciales.
export async function reiniciarPerfil(profileId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.playerDiscovery.deleteMany({ where: { profileId } })
    await tx.playerAdvance.deleteMany({ where: { profileId } })
    await tx.playerAchievement.deleteMany({ where: { profileId } })
    await tx.playerRitual.deleteMany({ where: { profileId } })
    await tx.playerPathwayUnlock.deleteMany({ where: { profileId } })
    await tx.playerCombinationStat.deleteMany({ where: { profileId } })
    await tx.playerProfile.update({
      where: { id: profileId },
      data: { resetAt: new Date(), lastSeenAt: new Date() },
    })
    await descubrirIniciales(tx, profileId)
  })
}
