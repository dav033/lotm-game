import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)

export const DEFAULT_SECONDS_PER_CARD = 4
export const MIN_SECONDS_PER_CARD = 0.5
export const MAX_SECONDS_PER_CARD = 60
export const DEFAULT_FPS = 30

export type CardVideoOptions = {
  secondsPerCard?: number
  // Duracion propia de cada fotograma, en el mismo orden que `frames`. Un hueco
  // (null/undefined) cae en `secondsPerCard`, que es la duracion global.
  durations?: Array<number | null | undefined>
  fps?: number
}

// Encadena los fotogramas en un solo MP4, cada uno en pantalla los segundos
// indicados.
//
// Los PNG llegan ya renderizados desde el editor en vez de generarse aqui:
// src/cards/render.tsx importa componentes de cliente y react-dom/server, asi
// que una ruta de Next no puede cargarlo (solo lo usan los procesos del MCP,
// que corren fuera del bundler). Capturarlos en el navegador ademas garantiza
// que el video muestre exactamente lo mismo que el export ZIP.
export async function createVideoFromFrames(
  frames: Uint8Array[],
  options: CardVideoOptions = {},
): Promise<Buffer> {
  if (!frames.length) throw new Error('No hay cartas que convertir en video.')
  if (!ffmpegPath) throw new Error('No se encontro el binario de ffmpeg (ffmpeg-static).')
  // El estrechado de tipo se pierde dentro de los callbacks de abajo.
  const ffmpeg = ffmpegPath

  const fallback = clampSeconds(options.secondsPerCard ?? DEFAULT_SECONDS_PER_CARD)
  const seconds = frames.map((_, index) => {
    const own = options.durations?.[index]
    return own === null || own === undefined ? fallback : clampSeconds(own)
  })
  const fps = options.fps ?? DEFAULT_FPS
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-video-'))

  try {
    const files: string[] = []
    let width = 0
    let height = 0
    for (const [index, frame] of frames.entries()) {
      const file = path.join(workDir, `frame-${String(index).padStart(4, '0')}.png`)
      await fs.writeFile(file, frame)
      files.push(file)
      // Las cartas no miden todas igual (un Map con muchas filas es mas alto
      // que un Breakdown). El lienzo se dimensiona al mayor y el resto se
      // centra dentro, que es lo unico que acepta un flujo de video.
      const size = pngSize(frame)
      width = Math.max(width, size.width)
      height = Math.max(height, size.height)
    }

    // H.264 exige lados pares.
    width += width % 2
    height += height % 2

    // El demuxer concat exige que todas las entradas midan igual: si difieren,
    // corta el video en la primera. Un -vf posterior no lo arregla porque actua
    // despues del demuxer, asi que las dispares se llevan al lienzo comun en
    // una pasada previa. Si ya coinciden (el caso normal) no se hace nada.
    const canvas = await Promise.all(
      files.map(async (file) => {
        const size = pngSize(await fs.readFile(file))
        if (size.width === width && size.height === height) return file
        const padded = path.join(workDir, `canvas-${path.basename(file)}`)
        await run(ffmpeg, [
          '-y', '-hide_banner', '-loglevel', 'error',
          '-i', file,
          '-vf', [
            `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
          ].join(','),
          padded,
        ])
        return padded
      }),
    )

    // El demuxer concat ignora la duracion de la ultima entrada, asi que se
    // repite el archivo final para que esa carta dure lo mismo que las demas.
    const listing = [
      ...canvas.map((file, index) => `file '${ffmpegEscape(file)}'\nduration ${seconds[index]}`),
      `file '${ffmpegEscape(canvas[canvas.length - 1])}'`,
    ].join('\n')
    const listFile = path.join(workDir, 'frames.txt')
    await fs.writeFile(listFile, `${listing}\n`)

    const output = path.join(workDir, 'cards.mp4')
    await run(ffmpeg, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-vf', [
        `fps=${fps}`,
        'setsar=1',
        // Las capturas traen alfa; sin aplanarlo a yuv420p el video no se ve
        // en QuickTime ni en la mayoria de reproductores sociales.
        'format=yuv420p',
      ].join(','),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      // Sin esto el reproductor tiene que leer el archivo entero antes de
      // empezar; con faststart el indice va al principio.
      '-movflags', '+faststart',
      output,
    ], { maxBuffer: 32 * 1024 * 1024 })

    return await fs.readFile(output)
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

export function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SECONDS_PER_CARD
  return Math.min(MAX_SECONDS_PER_CARD, Math.max(MIN_SECONDS_PER_CARD, value))
}

// El demuxer concat trata la comilla simple como delimitador y la barra
// invertida como escape, asi que ambas se escapan en las rutas de Windows.
function ffmpegEscape(file: string): string {
  return file.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

// Ancho y alto salen de la cabecera IHDR, que en un PNG siempre ocupa los
// bytes 16..24. Evita añadir una dependencia de imagenes solo para esto.
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const buffer = Buffer.isBuffer(png) ? png : Buffer.from(png)
  if (buffer.length < 24) throw new Error('El PNG renderizado es demasiado corto.')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}
