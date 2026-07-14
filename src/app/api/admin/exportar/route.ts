import { NextResponse } from 'next/server'
import { haySesionAdmin } from '@/server/adminAuth'
import { prisma } from '@/server/db'
import { exportarContenido } from '@/server/services/datos'

export const runtime = 'nodejs'

// Descarga de todo el contenido del juego como JSON (requiere sesión admin).
export async function GET() {
  if (!(await haySesionAdmin())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  try {
    const doc = await exportarContenido(prisma)
    const fecha = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify(doc, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="archivo-de-misterios-${fecha}.json"`,
      },
    })
  } catch (err) {
    console.error('[api/admin/exportar]', err)
    return NextResponse.json({ error: 'No se pudo exportar el contenido.' }, { status: 500 })
  }
}
