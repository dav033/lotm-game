import { NextResponse } from 'next/server'
import { z } from 'zod/v4'

// Un error de validacion acaba mostrandose en el editor, asi que se traduce a
// texto legible en vez del volcado JSON de issues que trae ZodError.message.
export function badRequest(error: unknown, fallback: string) {
  const message = error instanceof z.ZodError
    ? z.prettifyError(error).replace(/\s*\n\s*/g, ' ').trim()
    : error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status: 400 })
}
