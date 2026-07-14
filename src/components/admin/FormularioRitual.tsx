'use client'

import { useActionState } from 'react'
import { guardarRitual } from '@/server/actions/rituales'
import { ESTADO_INICIAL } from '@/server/actions/tipos'
import { BotonGuardar, MensajeEstado } from './ui'

export type RitualEditable = {
  id: string
  name: string
  ingredientAId: string
  ingredientBId: string
  advanceId: string
  requiredSequenceNumber: number
  failureOutputIds: string[]
  isActive: boolean
}

export default function FormularioRitual({ ritual, elementos, avances }: {
  ritual: RitualEditable | null
  elementos: { id: string; name: string }[]
  avances: { id: string; internalName: string }[]
}) {
  const [state, action] = useActionState(guardarRitual.bind(null, ritual?.id ?? null), ESTADO_INICIAL)
  return (
    <form action={action} className="space-y-4 rounded-lg mist-card p-5">
      <h2 className="etiqueta">{ritual ? `Editar: ${ritual.name}` : 'Nuevo ritual'}</h2>
      <MensajeEstado estado={state} />
      <div>
        <label className="etiqueta" htmlFor="ritual-name">Nombre público</label>
        <input id="ritual-name" name="name" required defaultValue={ritual?.name ?? ''} className="campo" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['A', 'B'] as const).map((slot) => (
          <div key={slot}>
            <label className="etiqueta" htmlFor={`ritual-ingredient-${slot}`}>Concepto {slot}</label>
            <select id={`ritual-ingredient-${slot}`} name={`ingredient${slot}Id`} required defaultValue={slot === 'A' ? ritual?.ingredientAId ?? '' : ritual?.ingredientBId ?? ''} className="campo">
              <option value="">Seleccionar</option>
              {elementos.map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="ritual-advance">Avance que protege</label>
          <select id="ritual-advance" name="advanceId" required defaultValue={ritual?.advanceId ?? ''} className="campo">
            <option value="">Seleccionar</option>
            {avances.map((advance) => <option key={advance.id} value={advance.id}>{advance.internalName}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="ritual-sequence">Se muestra tras una secuencia número</label>
          <input id="ritual-sequence" name="requiredSequenceNumber" type="number" min={0} max={99} defaultValue={ritual?.requiredSequenceNumber ?? 6} className="campo" />
        </div>
      </div>
      <fieldset>
        <legend className="etiqueta">Consecuencias del fallo</legend>
        <div className="grid max-h-52 gap-2 overflow-y-auto rounded-md border border-line p-3 sm:grid-cols-2">
          {elementos.map((element) => (
            <label key={element.id} className="flex items-center gap-2 text-xs text-parchment">
              <input type="checkbox" name="failureOutputIds" value={element.id} defaultChecked={ritual?.failureOutputIds.includes(element.id) ?? false} className="accent-[var(--color-brass)]" />
              {element.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-parchment">
        <input type="checkbox" name="isActive" defaultChecked={ritual?.isActive ?? true} className="accent-[var(--color-brass)]" />
        Ritual activo
      </label>
      <BotonGuardar>{ritual ? 'Guardar ritual' : 'Crear ritual'}</BotonGuardar>
    </form>
  )
}
