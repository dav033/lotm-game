'use client'

import type { PathwayReveal } from '@/server/domain/tipos'
import { ModalOculto } from './ModalOculto'

// Revelación de descubrimiento mayor (desbloqueo de un camino).
export function ModalRevelacion({
  reveal,
  onCerrar,
}: {
  reveal: PathwayReveal
  onCerrar: () => void
}) {
  return (
    <ModalOculto titulo={reveal.title} onCerrar={onCerrar}>
      <h2 className="anim-rise font-[family-name:var(--font-arcana)] text-2xl text-brass">
        {reveal.title}
      </h2>
      <div className="anim-rise-1 mt-6 space-y-1 text-lg text-parchment">
        {reveal.categoryPath.map((nombre) => (
          <div key={nombre}>
            <div>{nombre}</div>
            <div className="text-brass-deep" aria-hidden>↓</div>
          </div>
        ))}
        <div>{reveal.pathwayName}</div>
      </div>
      <p className="anim-rise-2 mt-5 font-[family-name:var(--font-display)] text-xl text-brass">
        Secuencia {reveal.sequenceNumber}: {reveal.sequenceName}
      </p>
      <p className="anim-rise-3 mt-4 italic text-fog">«{reveal.text}»</p>
      <button
        autoFocus
        onClick={onCerrar}
        className="anim-rise-4 btn-brass mt-8 px-8"
      >
        Continuar
      </button>
    </ModalOculto>
  )
}
