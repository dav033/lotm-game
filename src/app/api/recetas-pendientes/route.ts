import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { haySesionAdmin } from '@/server/adminAuth'
import { asegurarPerfil } from '@/server/perfil'
import { obtenerRecetasPendientes } from '@/server/domain/descubrimientos'

export const runtime = 'nodejs'

// Panel de depuración para el admin: recetas activas que el perfil actual
// todavía no ha descubierto por completo.
export async function GET() {
  if (!(await haySesionAdmin())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }
  try {
    const profile = await asegurarPerfil()
    const pendientes = await obtenerRecetasPendientes(prisma, profile.id)
    return NextResponse.json({ pendientes })
  } catch (err) {
    console.error('[api/recetas-pendientes]', err)
    return NextResponse.json({ error: 'No se pudieron cargar las recetas pendientes.' }, { status: 500 })
  }
}
