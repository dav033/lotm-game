'use client'

import { useMemo, useState } from 'react'
import { IconoElemento } from '@/components/game/IconoElemento'
import { BuscadorElemento } from './BuscadorElemento'
import type { ElementoOpcion } from './tiposReceta'

// Lista editable de elementos desencadenantes para el descubrimiento
// espontáneo. Publica los ids como inputs ocultos (name="triggerIds") para
// que viajen con el resto del formulario del elemento.
export function SelectorDesencadenantes({
  elementos,
  iniciales,
}: {
  elementos: ElementoOpcion[]
  iniciales: string[]
}) {
  const [ids, setIds] = useState<string[]>(iniciales)
  const porId = useMemo(() => new Map(elementos.map((e) => [e.id, e])), [elementos])
  const disponibles = useMemo(
    () => elementos.filter((e) => !ids.includes(e.id)),
    [elementos, ids],
  )

  return (
    <div>
      {ids.map((id) => (
        <input key={id} type="hidden" name="triggerIds" value={id} />
      ))}
      <BuscadorElemento
        elementos={disponibles}
        onPick={(id) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
        placeholder="Buscar elemento desencadenante…"
      />
      <ul className="mt-2 flex flex-wrap gap-2">
        {ids.map((id) => {
          const el = porId.get(id)
          return (
            <li
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-line2 bg-panel px-3 py-1 text-sm text-parchment"
            >
              <IconoElemento iconKey={el?.iconKey ?? 'sparkles'} className="h-4 w-4 text-brass" />
              {el?.name ?? '?'}
              <button
                type="button"
                onClick={() => setIds((prev) => prev.filter((x) => x !== id))}
                aria-label={`Quitar ${el?.name ?? 'desencadenante'}`}
                className="ml-1 text-fog hover:text-parchment"
              >
                ✕
              </button>
            </li>
          )
        })}
        {ids.length === 0 && (
          <li className="text-xs italic text-fog">Sin desencadenantes por elemento.</li>
        )}
      </ul>
    </div>
  )
}
