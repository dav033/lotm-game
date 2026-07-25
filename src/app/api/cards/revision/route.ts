import { NextResponse } from 'next/server'
import { cardsRepository } from '@/server/cardsDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Identifica el estado de la biblioteca sin leerla. El cliente sondea esto y
// solo recarga la sesion cuando cambia.
//
// Sustituye a un stream SSE: los temporizadores que necesitaba para vigilar la
// base no se ejecutan dentro de un ReadableStream en el build de produccion, asi
// que quien marca el ritmo es el navegador.
export async function GET() {
  return NextResponse.json(
    { revision: cardsRepository.revision() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
