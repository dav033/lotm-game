import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { resolverFacultades } from '@/server/services/habilidades'
import { cargarMemoriaAprendiz } from '@/server/services/memoriaAprendiz'

export const runtime = 'nodejs'

// Memoria del Aprendiz: historial persistente y personal de pares de
// Elementos normales que este perfil intentó combinar sin obtener resultado.
// Solo lectura, solo el propio perfil, sin caché compartida: no revela
// recetas, avances, salidas ni contenido de otros jugadores.
export async function GET() {
  try {
    const profile = await asegurarPerfil()

    // El servidor es la autoridad: la facultad se recalcula aquí, nunca se
    // acepta un "unlocked" del cliente.
    const abilities = await resolverFacultades(prisma, profile.id)
    if (!abilities.apprenticeMemory.unlocked) {
      return NextResponse.json(
        { error: 'Aún no has despertado esta facultad.' },
        { status: 403 },
      )
    }

    const { revision, failedInputKeys } = await cargarMemoriaAprendiz(prisma, profile.id)
    return NextResponse.json(
      { revision, failedInputKeys },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    console.error('[api/habilidades/aprendiz/memoria]', err)
    return NextResponse.json(
      { error: 'La memoria del Aprendiz no responde. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }
}
