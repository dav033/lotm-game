import { NextResponse } from 'next/server'
import { cardsRepository } from '@/server/cardsDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sesion completa de la biblioteca: es la unica fuente de verdad que consumen
// el editor y la vista en vivo. `revision` identifica el estado y coincide con
// la que anuncia el stream SSE, asi que el cliente puede ignorar una respuesta
// que ya quedo vieja.
export async function GET() {
  return NextResponse.json(
    {
      revision: cardsRepository.revision(),
      cards: cardsRepository.listCards(),
      // Proyectos e imagenes viajan aqui para que el editor no necesite mas
      // peticiones: el sondeo de `revision` ya cubre sus cambios.
      projects: cardsRepository.listProjects(),
      images: cardsRepository.listImages(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
