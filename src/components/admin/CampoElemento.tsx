'use client'

import { useState } from 'react'
import { IconoElemento } from '@/components/game/IconoElemento'
import { BuscadorElemento } from './BuscadorElemento'
import type { ElementoOpcion } from './tiposReceta'

// Campo de formulario con buscador de elementos: el id elegido viaja en un
// input oculto (name), así funciona dentro de formularios con server actions.
export function CampoElemento({
  name,
  elementos,
  placeholder,
  inicialId = '',
}: {
  name: string
  elementos: ElementoOpcion[]
  placeholder: string
  inicialId?: string
}) {
  const [id, setId] = useState(inicialId)
  const elegido = elementos.find((e) => e.id === id) ?? null

  return (
    <div>
      <input type="hidden" name={name} value={id} />
      {elegido ? (
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-parchment">
          <IconoElemento iconKey={elegido.iconKey} className="h-4 w-4 shrink-0 text-brass" />
          <span className="flex-1 truncate">{elegido.name}</span>
          <button
            type="button"
            onClick={() => setId('')}
            aria-label={`Quitar ${elegido.name}`}
            className="text-fog hover:text-parchment"
          >
            ✕
          </button>
        </div>
      ) : (
        <BuscadorElemento elementos={elementos} onPick={setId} placeholder={placeholder} />
      )}
    </div>
  )
}
