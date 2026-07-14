'use client'

import { useState, useTransition } from 'react'
import { crearElementoRapido } from '@/server/actions/elementos'
import { ELEMENT_TYPES, etiquetaTipo } from '@/server/domain/tipos'
import type { ElementoOpcion } from './tiposReceta'

// Alta exprés de elementos: permite armar una combinación desde cero (nuevos
// ingredientes y nuevo resultado) sin abandonar el constructor.
export function CreadorRapido({
  etiqueta,
  onCreado,
}: {
  etiqueta: string
  onCreado: (el: ElementoOpcion) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('CONCEPTO')
  const [error, setError] = useState<string | null>(null)
  const [creando, startCrear] = useTransition()

  const crear = () => {
    setError(null)
    startCrear(async () => {
      const res = await crearElementoRapido({ name: nombre, type: tipo })
      if (res.ok) {
        onCreado(res.elemento)
        setNombre('')
        setAbierto(false)
      } else {
        setError(res.error)
      }
    })
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-2 text-xs text-fog underline hover:text-brass"
      >
        ¿No existe todavía? Crear un elemento nuevo aquí
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-md border border-line p-3">
      <p className="etiqueta">{etiqueta}</p>
      {error && <p role="alert" className="mb-2 text-xs text-wine">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nombre}
          maxLength={80}
          placeholder="Nombre, p. ej. Espejo"
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (nombre.trim() && !creando) crear()
            }
          }}
          className="campo max-w-52"
          aria-label="Nombre del elemento nuevo"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="campo max-w-40"
          aria-label="Tipo del elemento nuevo"
        >
          {ELEMENT_TYPES.map((t) => (
            <option key={t} value={t}>{etiquetaTipo(t)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={crear}
          disabled={creando || !nombre.trim()}
          className="btn-brass"
        >
          {creando ? 'Creando…' : 'Crear y usar'}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="btn-ghost">
          Cancelar
        </button>
      </div>
      <p className="mt-2 text-[11px] text-fog">
        El identificador se genera solo (sin acentos), nace oculto hasta
        descubrirse y podrás afinar icono y textos en «Elementos».
      </p>
    </div>
  )
}
