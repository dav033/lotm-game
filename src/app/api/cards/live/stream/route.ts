import { cardsRepository } from '@/server/cardsDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// `PRAGMA data_version` cambia con los commits de cualquier otra conexion (el
// MCP stdio, el contenedor del MCP HTTP o el propio editor), asi que vigilar la
// revision detecta el cambio venga de donde venga.
//
// Cada stream sondea por su cuenta: el intervalo unico compartido en globalThis
// dejaba de dispararse en el build de produccion, y con unas pocas pestanas
// abiertas un pragma cada 250 ms no se nota.
// ponytail: un sondeo por conexion; si algun dia hay muchas, un solo vigilante
// con recuento de suscriptores.
const POLL_MS = 250
const KEEP_ALIVE_MS = 25_000

export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let revision = cardsRepository.revision()

      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          close()
        }
      }
      const send = (event: string, data: unknown) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

      const poll = setInterval(() => {
        if (closed) return
        let current: string
        try {
          current = cardsRepository.revision()
        } catch {
          return // la base puede estar ocupada un instante; se reintenta
        }
        if (current === revision) return
        revision = current
        send('library-change', { revision })
      }, POLL_MS)

      const keepAlive = setInterval(() => write(': keep-alive\n\n'), KEEP_ALIVE_MS)

      function close() {
        if (closed) return
        closed = true
        clearInterval(poll)
        clearInterval(keepAlive)
        try { controller.close() } catch { /* ya estaba cerrado */ }
      }

      request.signal.addEventListener('abort', close)
      send('connected', { revision })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evita que un proxy inverso acumule el stream en un buffer.
      'X-Accel-Buffering': 'no',
    },
  })
}
