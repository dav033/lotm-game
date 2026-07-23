import { NextResponse } from 'next/server'
import { cardsRepository } from '@/server/cardsDb'

export const runtime = 'nodejs'

// Vista de solo lectura sobre la biblioteca SQLite del MCP de cartas, para que
// /cartas/vivo pueda hacer polling y mostrar en el navegador lo que el MCP va guardando.
export async function GET() {
  const universes = cardsRepository.listLibrary()
  return NextResponse.json({ universes })
}
