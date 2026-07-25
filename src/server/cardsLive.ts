import { cardsRepository } from './cardsDb'

// Un unico vigilante para toda la app: consulta la revision de la biblioteca y
// avisa a cada stream abierto. Al observar la base y no al proceso que escribe,
// detecta por igual al MCP stdio, al MCP HTTP y a las ediciones del propio
// editor, que era justo lo que la notificacion en memoria del MCP no cubria.
const POLL_MS = 250

type Listener = (revision: string) => void

const globalForCardsLive = globalThis as unknown as {
  cardsLiveListeners?: Set<Listener>
  cardsLiveTimer?: ReturnType<typeof setInterval> | null
}

const listeners = globalForCardsLive.cardsLiveListeners ??= new Set<Listener>()

export function currentRevision(): string {
  return cardsRepository.revision()
}

export function subscribeToCardChanges(listener: Listener): () => void {
  listeners.add(listener)

  if (!globalForCardsLive.cardsLiveTimer) {
    let lastRevision = currentRevision()
    const timer = setInterval(() => {
      const revision = currentRevision()
      if (revision === lastRevision) return
      lastRevision = revision
      for (const notify of listeners) notify(revision)
    }, POLL_MS)
    timer.unref?.()
    globalForCardsLive.cardsLiveTimer = timer
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size > 0 || !globalForCardsLive.cardsLiveTimer) return
    clearInterval(globalForCardsLive.cardsLiveTimer)
    globalForCardsLive.cardsLiveTimer = null
  }
}
