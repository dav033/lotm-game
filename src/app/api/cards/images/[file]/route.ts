import fs from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { cardImageMime, resolveCardImageFile } from '@/cards/images'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  try {
    const path = resolveCardImageFile(file)
    const bytes = await fs.readFile(path)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': cardImageMime(path),
        // El nombre incluye un UUID, asi que el contenido nunca cambia.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Imagen no encontrada.' }, { status: 404 })
  }
}
