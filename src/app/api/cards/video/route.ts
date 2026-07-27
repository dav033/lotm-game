import { NextResponse } from 'next/server'
import { badRequest } from '@/server/apiError'
import { slugify } from '@/cards/schema'
import {
  clampSeconds,
  createVideoFromFrames,
  DEFAULT_SECONDS_PER_CARD,
} from '@/cards/video'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Codificar una parte entera pasa del limite por defecto de una ruta.
export const maxDuration = 600

const MAX_FRAMES = 200
const MAX_TOTAL_BYTES = 256 * 1024 * 1024

// Recibe los fotogramas ya capturados por el editor y devuelve el MP4. El
// render no ocurre aqui: ver el comentario de src/cards/video.ts.
export async function POST(request: Request) {
  let frames: Uint8Array[]
  let seconds: number
  let durations: Array<number | null>
  let filename: string
  try {
    const form = await request.formData()
    const files = form.getAll('frames').filter((value): value is File => value instanceof File)
    if (!files.length) throw new Error('No se recibio ningun fotograma.')
    if (files.length > MAX_FRAMES) throw new Error(`Demasiadas cartas (maximo ${MAX_FRAMES}).`)

    const total = files.reduce((sum, file) => sum + file.size, 0)
    if (total > MAX_TOTAL_BYTES) throw new Error('Los fotogramas superan el tamaño maximo.')

    const rawSeconds = Number(form.get('secondsPerCard') ?? DEFAULT_SECONDS_PER_CARD)
    seconds = clampSeconds(rawSeconds)

    // Una duracion por fotograma, en el mismo orden. Cadena vacia significa
    // "sin excepcion": ese fotograma usa la duracion global.
    const rawDurations = form.getAll('durations').map(String)
    durations = files.map((_, index) => {
      const own = rawDurations[index]
      if (own === undefined || own.trim() === '') return null
      const parsed = Number(own)
      if (!Number.isFinite(parsed)) return null
      return parsed
    })
    filename = `${slugify(String(form.get('name') || 'cartas'))}.mp4`
    frames = await Promise.all(
      files.map(async (file) => new Uint8Array(await file.arrayBuffer())),
    )
  } catch (error) {
    return badRequest(error, 'No se pudo leer la peticion de video.')
  }

  try {
    const video = await createVideoFromFrames(frames, { secondsPerCard: seconds, durations })
    return new NextResponse(new Uint8Array(video), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(video.byteLength),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    // Un fallo de ffmpeg no es culpa de la peticion; se distingue del 400 para
    // que el editor pueda mostrar el motivo real.
    console.error('[cards:video]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el video.' },
      { status: 500 },
    )
  }
}
