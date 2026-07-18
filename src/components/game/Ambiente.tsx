'use client'

import { useMemo } from 'react'

// Capa ambiental del juego: niebla espectral a la deriva, brasas que ascienden
// y un velo que parpadea como luz de vela. Todo es CSS; aquí solo se siembran
// posiciones deterministas (mismas en servidor y cliente, sin hydration issues).
export function Ambiente() {
  const brasas = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 13) % 100}%`,
        size: 2 + ((i * 7) % 3),
        duracion: 16 + ((i * 5) % 14),
        retraso: -((i * 3.7) % 20),
        deriva: `${((i % 5) - 2) * 24}px`,
      })),
    [],
  )

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="niebla niebla-a" />
      <div className="niebla niebla-b" />
      <div className="velo-vela" />
      {brasas.map((b) => (
        <span
          key={b.id}
          className="brasa"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duracion}s`,
            animationDelay: `${b.retraso}s`,
            ['--deriva' as string]: b.deriva,
          }}
        />
      ))}
    </div>
  )
}
