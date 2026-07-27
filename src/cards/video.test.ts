import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampSeconds,
  createVideoFromFrames,
  DEFAULT_SECONDS_PER_CARD,
  MAX_SECONDS_PER_CARD,
  MIN_SECONDS_PER_CARD,
  pngSize,
} from './video'

test('la duracion por carta se mantiene dentro de los limites', () => {
  assert.equal(clampSeconds(4), 4)
  assert.equal(clampSeconds(0), MIN_SECONDS_PER_CARD)
  assert.equal(clampSeconds(-3), MIN_SECONDS_PER_CARD)
  assert.equal(clampSeconds(900), MAX_SECONDS_PER_CARD)
  // Un input vacio en el editor llega como NaN; sin esto ffmpeg recibiria una
  // duracion invalida y abortaria el render entero.
  assert.equal(clampSeconds(Number.NaN), DEFAULT_SECONDS_PER_CARD)
  assert.equal(clampSeconds(Number.POSITIVE_INFINITY), DEFAULT_SECONDS_PER_CARD)
})

test('pngSize lee ancho y alto de la cabecera IHDR', () => {
  const png = Buffer.alloc(24)
  png.writeUInt32BE(960, 16)
  png.writeUInt32BE(1_280, 20)
  assert.deepEqual(pngSize(png), { width: 960, height: 1_280 })
})

test('pngSize rechaza un buffer sin cabecera completa', () => {
  assert.throws(() => pngSize(Buffer.alloc(10)), /demasiado corto/)
})

test('sin fotogramas no se invoca a ffmpeg', async () => {
  await assert.rejects(createVideoFromFrames([]), /No hay cartas/)
})

// Duracion global con excepciones por carta: 2s + 5s + 2s = 9s. Si las
// excepciones se ignorasen saldrian 6s, y si mandasen sobre todo, 15s.
test('cada fotograma puede llevar su propia duracion', async () => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const fs = await import('node:fs/promises')
  const os = await import('node:os')
  const path = await import('node:path')
  const ffmpeg = (await import('ffmpeg-static')).default as string

  const run = promisify(execFile)
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-video-dur-'))
  try {
    const file = path.join(dir, 'frame.png')
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=teal:s=120x160', '-frames:v', '1', file])
    const frame = new Uint8Array(await fs.readFile(file))

    const video = await createVideoFromFrames([frame, frame, frame], {
      secondsPerCard: 2,
      durations: [null, 5, undefined],
      fps: 10,
    })
    const output = path.join(dir, 'out.mp4')
    await fs.writeFile(output, video)

    const { stderr } = await run(ffmpeg, ['-hide_banner', '-i', output]).catch((e) => e)
    assert.match(stderr as string, /Duration: 00:00:09/)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('una duracion propia fuera de rango se acota en vez de romper el render', async () => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const fs = await import('node:fs/promises')
  const os = await import('node:os')
  const path = await import('node:path')
  const ffmpeg = (await import('ffmpeg-static')).default as string

  const run = promisify(execFile)
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-video-clamp-'))
  try {
    const file = path.join(dir, 'frame.png')
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=teal:s=120x160', '-frames:v', '1', file])
    const frame = new Uint8Array(await fs.readFile(file))

    // -3 no puede llegar a ffmpeg como duracion negativa.
    const video = await createVideoFromFrames([frame], { durations: [-3], fps: 10 })
    const output = path.join(dir, 'out.mp4')
    await fs.writeFile(output, video)
    const { stderr } = await run(ffmpeg, ['-hide_banner', '-i', output]).catch((e) => e)
    assert.match(stderr as string, /Duration: 00:00:0[01]/)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

// Prueba de extremo a extremo del muxing: dos PNG de tamaños distintos deben
// acabar en un MP4 con un unico lienzo y la duracion pedida.
test('los fotogramas se unen en un MP4 con la duracion pedida', async () => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const fs = await import('node:fs/promises')
  const os = await import('node:os')
  const path = await import('node:path')
  const ffmpeg = (await import('ffmpeg-static')).default as string

  const run = promisify(execFile)
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-video-test-'))
  try {
    const png = async (w: number, h: number) => {
      const file = path.join(dir, `${w}x${h}.png`)
      await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', `color=c=red:s=${w}x${h}`, '-frames:v', '1', file])
      return new Uint8Array(await fs.readFile(file))
    }

    const video = await createVideoFromFrames([await png(120, 160), await png(100, 140)], {
      secondsPerCard: 1,
      fps: 10,
    })
    const output = path.join(dir, 'out.mp4')
    await fs.writeFile(output, video)

    const { stdout } = await run(ffmpeg.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1'), [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=width,height,pix_fmt',
      '-of', 'json', output,
    ]).catch(async () => {
      // ffmpeg-static no trae ffprobe; se lee de la salida del propio ffmpeg.
      const { stderr } = await run(ffmpeg, ['-hide_banner', '-i', output]).catch((e) => e)
      return { stdout: stderr as string }
    })

    assert.match(stdout, /120x160|"width": ?120/)
    assert.match(stdout, /yuv420p/)
    // Dos cartas de 1s tienen que durar 2s. El demuxer concat corta en la
    // primera entrada si los tamaños no coinciden, y aqui no coinciden a
    // proposito: es justo lo que comprueba esta asercion.
    assert.match(stdout, /Duration: 00:00:02|"duration": ?"2\./)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
