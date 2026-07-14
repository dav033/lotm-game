'use client'

import { useEffect } from 'react'
import type { CombineResult } from '@/server/domain/tipos'
import { IconoElemento } from './IconoElemento'

export type ResultadoDirecto = {
  resultado: CombineResult
  punto: { x: number; y: number }
}

// Tarjeta que aparece donde el jugador soltó el arrastre tras una combinación
// directa (icono sobre icono). Se cierra sola o al hacer clic.
export function ResultadoFlotante({
  directo,
  onCerrar,
}: {
  directo: ResultadoDirecto | null
  onCerrar: () => void
}) {
  useEffect(() => {
    if (!directo) return
    const t = setTimeout(onCerrar, 3200)
    return () => clearTimeout(t)
  }, [directo, onCerrar])

  if (!directo || directo.resultado.results.length === 0) return null

  // Mantener la tarjeta dentro de la pantalla.
  const x = Math.min(Math.max(directo.punto.x, 120), window.innerWidth - 120)
  const y = Math.min(Math.max(directo.punto.y, 90), window.innerHeight - 120)

  return (
    <button
      type="button"
      onClick={onCerrar}
      className="anim-pop fixed z-[55] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{ left: x, top: y }}
      aria-label="Cerrar resultado"
    >
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg mist-card brass-ring px-4 py-3 shadow-2xl">
        {directo.resultado.results.map((r, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1">
            {r.isNewDiscovery && (
              <span className="rounded-full border border-brass px-2 py-0.5 text-[9px] uppercase tracking-widest text-brass">
                {r.element.kind === 'ADVANCE' ? '¡Nuevo avance!' : '¡Nuevo!'}
              </span>
            )}
            <IconoElemento iconKey={r.element.iconKey} className="h-9 w-9 text-brass" />
            <span className="max-w-28 text-center text-xs text-parchment">{r.element.name}</span>
          </div>
        ))}
      </div>
    </button>
  )
}
