'use client'

import { IconoElemento } from './IconoElemento'
import type { EstadoArrastre } from './useArrastre'

// Ficha semitransparente que sigue al puntero durante el arrastre. No captura
// eventos para que elementFromPoint siga viendo lo que hay debajo.
export function GhostArrastre({ arrastre }: { arrastre: EstadoArrastre | null }) {
  if (!arrastre) return null
  return (
    <div
      className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2"
      style={{ left: arrastre.x, top: arrastre.y }}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-1 rounded-lg mist-card border-brass-deep px-3 py-2 opacity-90 shadow-xl">
        <IconoElemento iconKey={arrastre.payload.iconKey} className="h-8 w-8 text-brass" />
        <span className="text-xs text-parchment">{arrastre.payload.name}</span>
      </div>
    </div>
  )
}
