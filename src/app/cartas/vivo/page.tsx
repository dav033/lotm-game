'use client'

import { useEffect, useState } from 'react'
import '@/builder/styles.css'
import LiveCardPreview from '@/builder/LiveCardPreview.jsx'
import type { CardContent } from '@/cards/schema'

const POLL_MS = 1_500
const FLASH_MS = 4_000

type LiveCard = {
  id: string
  title: string
  content: CardContent
  updatedAt: string
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

export default function CartasVivoPage() {
  const [universes, setUniverses] = useState<LiveUniverse[] | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const response = await fetch('/api/cards/live', { cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const data = await response.json()
        if (!cancelled) {
          setUniverses(data.universes)
          setConnected(true)
        }
      } catch {
        if (!cancelled) setConnected(false)
      }
      if (!cancelled) setNow(Date.now())
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
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
