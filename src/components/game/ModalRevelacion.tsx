'use client'

import type { PathwayReveal } from '@/server/domain/tipos'

// Revelación de descubrimiento mayor (desbloqueo de un camino).
export function ModalRevelacion({
  reveal,
  onCerrar,
}: {
  reveal: PathwayReveal
  onCerrar: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reveal.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div className="mist-card brass-ring w-full max-w-md rounded-xl p-8 text-center">
        <h2 className="anim-rise font-[family-name:var(--font-display)] text-2xl font-bold text-brass">
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
          className="anim-rise-4 mt-8 rounded-md bg-brass px-8 py-2.5 font-semibold text-ink hover:brightness-110"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
