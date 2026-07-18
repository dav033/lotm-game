import { NextResponse } from 'next/server'
import { asegurarPerfil, reiniciarPerfil } from '@/server/perfil'

export const runtime = 'nodejs'

// Borra el progreso del perfil actual y vuelve a entregar los elementos
// iniciales (los que tengan isStarter=true en la base). El perfil (y su
// cookie) se conservan.
export async function POST() {
  try {
    const profile = await asegurarPerfil()
    await reiniciarPerfil(profile.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/perfil/reiniciar]', err)
    return NextResponse.json({ error: 'No se pudo reiniciar el progreso.' }, { status: 500 })
  }
}
