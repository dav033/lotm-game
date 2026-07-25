import { currentRevision, subscribeToCardChanges } from '@/server/cardsLive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KEEP_ALIVE_MS = 25_000

// Stream del mismo origen que el resto de la app: no depende de que el MCP HTTP
// este levantado ni de CORS, y refleja cualquier escritura sobre cards.db.
export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          close()
        }
      }

      const keepAlive = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
        } catch {
          close()
        }
      }, KEEP_ALIVE_MS)
      keepAlive.unref?.()

      const unsubscribe = subscribeToCardChanges((revision) => send('library-change', { revision }))

      function close() {
        if (closed) return
        closed = true
        clearInterval(keepAlive)
        unsubscribe()
        try { controller.close() } catch { /* ya estaba cerrado */ }
      }

      request.signal.addEventListener('abort', close)
      send('connected', { revision: currentRevision() })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evita que un proxy inverso (nginx) acumule el stream en un buffer.
      'X-Accel-Buffering': 'no',
    },
  })
}
