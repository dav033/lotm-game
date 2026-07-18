'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'

// Estallido de motas arcanas cuando el círculo sella un descubrimiento.
// La semilla (que cambia con cada resolución) fija direcciones y distancias
// de forma determinista: mismo estallido en cada re-render, distinto en cada sello.
export function Particulas({ semilla }: { semilla: string }) {
  const motas = useMemo(() => {
    let h = 2166136261
    for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
    const rand = () => {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0
      return h / 0xffffffff
    }
    return Array.from({ length: 18 }, (_, i) => {
      const angulo = (i / 18) * Math.PI * 2 + rand() * 0.6
      const radio = 90 + rand() * 120
      return {
        id: i,
        x: Math.cos(angulo) * radio,
        y: Math.sin(angulo) * radio,
        tam: 3 + rand() * 4,
        dur: 0.75 + rand() * 0.55,
        espectral: rand() > 0.55,
      }
    })
  }, [semilla])

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {motas.map((m) => (
        <motion.span
          key={m.id}
          className="absolute rounded-full"
          style={{
            width: m.tam,
            height: m.tam,
            background: m.espectral ? 'var(--color-spectral)' : 'var(--color-brass)',
            boxShadow: m.espectral
              ? '0 0 9px 1px rgba(139, 118, 201, 0.85)'
              : '0 0 9px 1px rgba(201, 163, 92, 0.85)',
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: m.x, y: m.y, opacity: 0, scale: 0.15 }}
          transition={{ duration: m.dur, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
