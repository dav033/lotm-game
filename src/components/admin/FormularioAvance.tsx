'use client'

import { useActionState } from 'react'
import { guardarAvance } from '@/server/actions/avances'
import { ESTADO_INICIAL } from '@/server/actions/tipos'
import { BotonGuardar, MensajeEstado } from './ui'

type OpcionElemento = { id: string; name: string; type: string }
type OpcionSecuencia = {
  id: string
  number: number
  name: string
  pathway: { name: string }
}

export type AvanceEditable = {
  id: string
  internalName: string
  ingredientAId: string
  ingredientBId: string
  sourceSequenceId: string
  targetSequenceId: string
  isActive: boolean
}

export default function FormularioAvance({
  avance,
  elementos,
  secuencias,
}: {
  avance: AvanceEditable | null
  elementos: OpcionElemento[]
  secuencias: OpcionSecuencia[]
}) {
  const [estado, enviar] = useActionState(
    guardarAvance.bind(null, avance?.id ?? null),
    ESTADO_INICIAL,
  )

  return (
    <form action={enviar} className="max-w-2xl space-y-5 rounded-lg mist-card p-5">
      <MensajeEstado estado={estado} />

      <div>
        <label htmlFor="advance-name" className="etiqueta">Nombre interno</label>
        <input
          id="advance-name"
          name="internalName"
          required
          maxLength={120}
          defaultValue={avance?.internalName ?? ''}
          placeholder="Ej. Avance a Robot"
          className="campo"
        />
        <p className="mt-1 text-xs text-fog">
          Solo el administrador verá este nombre. El jugador siempre verá «Avance desconocido».
        </p>
      </div>

      <fieldset>
        <legend className="etiqueta">Combinación que produce el avance</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            name="ingredientAId"
            required
            defaultValue={avance?.ingredientAId ?? ''}
            className="campo"
            aria-label="Primer ingrediente"
          >
            <option value="">Primer elemento</option>
            {elementos.map((element) => (
              <option key={element.id} value={element.id}>{element.name} · {element.type}</option>
            ))}
          </select>
          <select
            name="ingredientBId"
            required
            defaultValue={avance?.ingredientBId ?? ''}
            className="campo"
            aria-label="Segundo ingrediente"
          >
            <option value="">Segundo elemento</option>
            {elementos.map((element) => (
              <option key={element.id} value={element.id}>{element.name} · {element.type}</option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-fog">
          Esta combinación aparecerá como etiqueta pública debajo del avance desconocido.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="advance-source" className="etiqueta">
            Secuencia con la que se combina
          </label>
          <select
            id="advance-source"
            name="sourceSequenceId"
            required
            defaultValue={avance?.sourceSequenceId ?? ''}
            className="campo"
          >
            <option value="">Seleccionar secuencia</option>
            {secuencias.map((sequence) => (
              <option key={sequence.id} value={sequence.id}>
                {sequence.pathway.name} · {sequence.number}: {sequence.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="advance-target" className="etiqueta">
            Secuencia que se descubre
          </label>
          <select
            id="advance-target"
            name="targetSequenceId"
            required
            defaultValue={avance?.targetSequenceId ?? ''}
            className="campo"
          >
            <option value="">Seleccionar secuencia</option>
            {secuencias.map((sequence) => (
              <option key={sequence.id} value={sequence.id}>
                {sequence.pathway.name} · {sequence.number}: {sequence.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-parchment">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={avance?.isActive ?? true}
          className="accent-[var(--color-brass)]"
        />
        Avance activo
      </label>

      <BotonGuardar>{avance ? 'Guardar avance' : 'Crear avance'}</BotonGuardar>
    </form>
  )
}
