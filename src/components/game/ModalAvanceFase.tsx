'use client'

import { Sparkles } from 'lucide-react'
import type { ElementoDescubierto, TransicionFase } from './tipos'
import { IconoElemento } from './IconoElemento'
import { ModalOculto } from './ModalOculto'

export function ModalAvanceFase({
  transicion,
  aperturas,
  onCerrar,
  onVerLienzo,
}: {
  transicion: TransicionFase
  aperturas: ElementoDescubierto[]
  onCerrar: () => void
  onVerLienzo: () => void
}) {
  return (
    <ModalOculto titulo={`Nueva fase: ${transicion.phase.name}`} onCerrar={onCerrar}>
      <span className="text-xs uppercase tracking-[0.25em] text-spectral">Nueva fase alcanzada</span>
      <div className="anim-glow mx-auto my-5 flex h-24 w-24 items-center justify-center rounded-full border border-brass-deep">
        <Sparkles className="h-12 w-12 text-brass" aria-hidden />
      </div>
      <h2 className="text-balance font-[family-name:var(--font-display)] text-3xl font-bold text-brass">
        {transicion.phase.name}
      </h2>
      {transicion.celebrationMessage && (
        <p className="mt-4 text-pretty italic leading-relaxed text-fog">
          {transicion.celebrationMessage}
        </p>
      )}
      {aperturas.length > 0 && (
        <div className="mt-6 rounded-lg border border-line bg-black/15 p-3 text-left">
          <p className="text-xs uppercase tracking-[0.18em] text-brass">Nuevas aperturas</p>
          <ul className="mt-3 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
            {aperturas.map((elemento) => (
              <li key={elemento.id} className="flex min-w-0 items-center gap-2 rounded-md border border-line2 px-2 py-2 text-xs text-parchment">
                <IconoElemento iconKey={elemento.iconKey} className="h-4 w-4 shrink-0 text-brass" />
                <span className="truncate">{elemento.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fog">Se colocaron en el lienzo de transmutación.</p>
        </div>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {aperturas.length > 0 && (
          <button autoFocus type="button" onClick={onVerLienzo} className="btn-brass">
            Ver en el lienzo
          </button>
        )}
        <button type="button" onClick={onCerrar} className="btn-ghost">
          Continuar
        </button>
      </div>
    </ModalOculto>
  )
}
