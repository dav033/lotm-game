import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { calcularPotencialPorElemento, entradaPotencialPublica } from '@/server/domain/habilidades'
import { cargarSnapshotPotencial, resolverFacultades } from '@/server/services/habilidades'

export const runtime = 'nodejs'

// Visión del Mystery Pryer: tiers de potencial de TODOS los elementos
// descubiertos en una sola pasada. Solo tiers, jamás recuentos exactos ni
// metadatos de fórmulas; solo lectura, sin efectos sobre el progreso.
export async function GET() {
  try {
    const profile = await asegurarPerfil()
    const abilities = await resolverFacultades(prisma, profile.id)
    if (!abilities.mysteryPryer.unlocked) {
      return NextResponse.json(
        { error: 'Aún no has despertado esta facultad.' },
        { status: 403 },
      )
    }

    const snapshot = await cargarSnapshotPotencial(prisma, profile.id)
    const conteos = calcularPotencialPorElemento(snapshot)
    const potential = [...snapshot.discoveredElementIds].map((elementId) =>
      entradaPotencialPublica(elementId, conteos.get(elementId) ?? 0),
    )
    return NextResponse.json({ potential })
  } catch (err) {
    console.error('[api/habilidades/potencial]', err)
    return NextResponse.json(
      { error: 'La visión se ha desvanecido. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }
}
