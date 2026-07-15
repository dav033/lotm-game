import { NextResponse } from 'next/server'
import { haySesionAdmin } from '@/server/adminAuth'
import { prisma } from '@/server/db'
import { exportarElementosYCombinaciones } from '@/server/services/datos'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await haySesionAdmin())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  try {
    const doc = await exportarElementosYCombinaciones(prisma)
    const fecha = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify(doc, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="elementos-y-combinaciones-${fecha}.json"`,
      },
    })
  } catch (err) {
    console.error('[api/admin/exportar-elementos]', err)
    return NextResponse.json({ error: 'No se pudieron exportar los elementos.' }, { status: 500 })
  }
}
