'use client'

import { IconoElemento } from './IconoElemento'
import { ModalOculto } from './ModalOculto'

// Se muestra una sola vez, al obtener el primer avance: es la única mecánica
// que rompe las reglas aprendidas hasta entonces (los avances sí se consumen).
export function ModalTutorialAvance({ onCerrar }: { onCerrar: () => void }) {
  return (
    <ModalOculto titulo="Has obtenido tu primer avance" onCerrar={onCerrar}>
      <span className="text-xs uppercase tracking-[0.25em] text-spectral">
        Tu primer avance
      </span>
      <div className="anim-glow mx-auto my-5 flex h-24 w-24 items-center justify-center rounded-full border border-brass-deep">
        <IconoElemento iconKey="wand-sparkles" className="h-12 w-12 text-brass" />
      </div>
      <div className="space-y-3 text-left text-sm text-fog">
        <p>
          Los avances son distintos a todo lo demás:{' '}
          <span className="text-parchment">se consumen al usarse</span>, mientras que los
          conceptos nunca se gastan.
        </p>
        <p>
          Para usarlo, combínalo con el elemento de secuencia correcto. Reconocerás las
          secuencias en tu archivo por su insignia{' '}
          <span className="rounded-full border border-brass-deep px-2 py-0.5 text-[10px] text-brass">
            Secuencia N · Camino
          </span>
          ; el icono del avance señala su camino de origen.
        </p>
        <p>
          Algunos avances exigen haber{' '}
          <span className="text-parchment">preparado antes un ritual</span>. Fracasar sin él
          tiene consecuencias.
        </p>
      </div>
      <button autoFocus type="button" onClick={onCerrar} className="btn-brass mt-7">
        Entendido
      </button>
    </ModalOculto>
  )
}
