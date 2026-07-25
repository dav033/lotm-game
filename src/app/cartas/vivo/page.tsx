'use client'

import { useEffect, useState } from 'react'
import '@/builder/styles.css'
import LiveCardPreview from '@/builder/LiveCardPreview.jsx'
import type { CardContent } from '@/cards/schema'

const POLL_MS = 1_000
const FLASH_MS = 4_000

type LiveCard = {
  id: string
  title: string
  content: CardContent
  updatedAt: string
  universe: { id: string; name: string }
  part: { id: string; name: string; number: number | null }
}

type LivePart = {
  id: string
  name: string
  number: number | null
  cards: LiveCard[]
}

type LiveUniverse = {
  id: string
  name: string
  parts: LivePart[]
}

// La sesion llega plana y ya ordenada; aqui solo se agrupa para mostrarla.
function groupByUniverse(cards: LiveCard[]): LiveUniverse[] {
  const universes = new Map<string, LiveUniverse>()
  for (const card of cards) {
    let universe = universes.get(card.universe.id)
    if (!universe) {
      universe = { id: card.universe.id, name: card.universe.name, parts: [] }
      universes.set(card.universe.id, universe)
    }
    let part = universe.parts.find(({ id }) => id === card.part.id)
    if (!part) {
      part = { id: card.part.id, name: card.part.name, number: card.part.number, cards: [] }
      universe.parts.push(part)
    }
    part.cards.push(card)
  }
  return [...universes.values()]
}

export default function CartasVivoPage() {
  const [universes, setUniverses] = useState<LiveUniverse[] | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let cancelled = false
    let pending = 0
    let revision: string | null = null

    async function refresh() {
      // Varias lecturas seguidas pueden dejar respuestas en vuelo: solo la mas
      // reciente puede pintar, para no volver a una version anterior.
      const requestId = ++pending
      try {
        const response = await fetch('/api/cards/session', { cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const data = await response.json()
        if (cancelled || requestId !== pending) return
        revision = data.revision
        setUniverses(groupByUniverse(data.cards))
        setConnected(true)
      } catch {
        if (!cancelled && requestId === pending) setConnected(false)
      }
      if (!cancelled) setNow(Date.now())
    }

    refresh()
    // Se pide solo la revision y se recarga la biblioteca cuando cambia.
    const poll = setInterval(async () => {
      if (cancelled || document.hidden) return
      try {
        const response = await fetch('/api/cards/revision', { cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const data = await response.json()
        if (data.revision !== revision) await refresh()
        else if (!cancelled) setConnected(true)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [])

  const cardCount = universes?.reduce(
    (total, universe) => total + universe.parts.reduce((partTotal, part) => partTotal + part.cards.length, 0),
    0,
  ) ?? 0

  return (
    <div className="builder-root">
      <div className="live-view">
        <div className="live-header">
          <h1>Cartas — vista en vivo del MCP</h1>
          <span className={'live-status' + (connected ? '' : ' offline')}>
            {connected ? `${cardCount} carta${cardCount === 1 ? '' : 's'}` : 'Sin conexion'}
          </span>
        </div>

        {universes === null ? (
          <p className="live-empty">Cargando…</p>
        ) : cardCount === 0 ? (
          <p className="live-empty">Esperando a que el MCP guarde cartas…</p>
        ) : (
          universes.map((universe) => (
            <section key={universe.id} className="live-universe">
              <h2>{universe.name}</h2>
              {universe.parts.map((part) => (
                <div key={part.id}>
                  <p className="live-part">
                    Parte {part.number ?? '–'} · {part.name}
                  </p>
                  <div className="live-grid">
                    {part.cards.map((card) => {
                      const isRecent = now - new Date(card.updatedAt).getTime() < FLASH_MS
                      return (
                        <div key={card.id} className={'live-tile' + (isRecent ? ' flash' : '')}>
                          <div className="live-tile-inner">
                            <LiveCardPreview content={card.content} />
                          </div>
                          <span className="live-tile-title">{card.title}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
