'use client'

import { useActionState, useState } from 'react'
import { guardarLogro } from '@/server/actions/logros'
import { ESTADO_INICIAL } from '@/server/actions/tipos'
import { ICON_KEYS, IconoElemento } from '@/components/game/IconoElemento'
import { BotonGuardar, MensajeEstado } from './ui'

type ElementOption = { id: string; name: string; type: string }
type SequenceOption = { id: string; number: number; name: string; pathway: { name: string } }

export type LogroEditable = {
  id: string
  slug: string
  name: string
  description: string
  iconKey: string
  triggerType: 'ELEMENT' | 'SEQUENCE'
  triggerId: string
  isHiddenUntilUnlocked: boolean
  isActive: boolean
}

export default function FormularioLogro({
  logro,
  elementos,
  secuencias,
}: {
  logro: LogroEditable | null
  elementos: ElementOption[]
  secuencias: SequenceOption[]
}) {
  const [state, action] = useActionState(guardarLogro.bind(null, logro?.id ?? null), ESTADO_INICIAL)
  const [triggerType, setTriggerType] = useState<'ELEMENT' | 'SEQUENCE'>(
    logro?.triggerType ?? 'SEQUENCE',
  )
  const [iconKey, setIconKey] = useState(logro?.iconKey ?? 'trophy')

  return (
    <form action={action} className="max-w-2xl space-y-5 rounded-lg mist-card p-5">
      <MensajeEstado estado={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="achievement-name" className="etiqueta">Nombre</label>
          <input id="achievement-name" name="name" required maxLength={100} defaultValue={logro?.name ?? ''} className="campo" />
        </div>
        <div>
          <label htmlFor="achievement-slug" className="etiqueta">Slug</label>
          <input id="achievement-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={logro?.slug ?? ''} className="campo" />
        </div>
      </div>
      <div>
        <label htmlFor="achievement-description" className="etiqueta">Descripción</label>
        <textarea id="achievement-description" name="description" maxLength={500} defaultValue={logro?.description ?? ''} className="campo" rows={3} />
      </div>
      <div>
        <label htmlFor="achievement-icon" className="etiqueta">Icono</label>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line2">
            <IconoElemento iconKey={iconKey} className="h-5 w-5 text-brass" />
          </div>
          <select id="achievement-icon" name="iconKey" value={iconKey} onChange={(event) => setIconKey(event.target.value)} className="campo">
            {ICON_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="achievement-trigger-type" className="etiqueta">Tipo de condición</label>
          <select
            id="achievement-trigger-type"
            name="triggerType"
            value={triggerType}
            onChange={(event) => setTriggerType(event.target.value as 'ELEMENT' | 'SEQUENCE')}
            className="campo"
          >
            <option value="SEQUENCE">Descubrir una secuencia</option>
            <option value="ELEMENT">Descubrir un elemento</option>
          </select>
        </div>
        <div>
          <label htmlFor="achievement-trigger" className="etiqueta">Desencadenante</label>
          <select id="achievement-trigger" name="triggerId" required defaultValue={logro?.triggerId ?? ''} className="campo" key={triggerType}>
            <option value="">Seleccionar</option>
            {triggerType === 'ELEMENT'
              ? elementos.map((element) => <option key={element.id} value={element.id}>{element.name} · {element.type}</option>)
              : secuencias.map((sequence) => (
                  <option key={sequence.id} value={sequence.id}>
                    {sequence.pathway.name} · {sequence.number}: {sequence.name}
                  </option>
                ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-parchment">
          <input type="checkbox" name="isHiddenUntilUnlocked" defaultChecked={logro?.isHiddenUntilUnlocked ?? false} className="accent-[var(--color-brass)]" />
          Ocultar nombre y descripción hasta desbloquearlo
        </label>
        <label className="flex items-center gap-2 text-sm text-parchment">
          <input type="checkbox" name="isActive" defaultChecked={logro?.isActive ?? true} className="accent-[var(--color-brass)]" />
          Logro activo
        </label>
      </div>
      <BotonGuardar>{logro ? 'Guardar logro' : 'Crear logro'}</BotonGuardar>
    </form>
  )
}
