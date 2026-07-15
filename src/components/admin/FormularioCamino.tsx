'use client'

import { useActionState } from 'react'
import { guardarCamino, guardarSecuencia } from '@/server/actions/caminos'
import { ESTADO_INICIAL } from '@/server/actions/tipos'
import { CampoElemento } from './CampoElemento'
import type { ElementoOpcion } from './tiposReceta'
import { BotonGuardar, MensajeEstado } from './ui'

export type CaminoEditable = {
  id: string
  slug: string
  name: string
  description: string
  categoryId: string
  iconKey: string | null
  isHiddenUntilDiscovered: boolean
  isActive: boolean
}

export function FormularioCamino({
  camino,
  categorias,
}: {
  camino: CaminoEditable | null
  categorias: { id: string; name: string }[]
}) {
  const accion = guardarCamino.bind(null, camino?.id ?? null)
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL)

  return (
    <form action={enviar} className="space-y-3 rounded-lg mist-card p-4" key={camino?.id ?? 'nuevo'}>
      <h2 className="etiqueta">{camino ? `Editar: ${camino.name}` : 'Nuevo camino'}</h2>
      <MensajeEstado estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="p-name" className="etiqueta">Nombre</label>
          <input id="p-name" name="name" required maxLength={80} defaultValue={camino?.name ?? ''} className="campo" />
        </div>
        <div>
          <label htmlFor="p-slug" className="etiqueta">Identificador (slug)</label>
          <input
            id="p-slug" name="slug" required maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Solo minúsculas, números y guiones."
            defaultValue={camino?.slug ?? ''} className="campo"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="p-cat" className="etiqueta">Categoría</label>
          <select id="p-cat" name="categoryId" required defaultValue={camino?.categoryId ?? ''} className="campo">
            <option value="">— Selecciona —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="p-desc" className="etiqueta">Descripción</label>
        <input id="p-desc" name="description" maxLength={500} defaultValue={camino?.description ?? ''} className="campo" />
      </div>
      <div>
        <label htmlFor="p-icon" className="etiqueta">Icono (opcional)</label>
        <input id="p-icon" name="iconKey" maxLength={40} defaultValue={camino?.iconKey ?? ''} className="campo" />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-parchment">
          <input type="checkbox" name="isHiddenUntilDiscovered" defaultChecked={camino?.isHiddenUntilDiscovered ?? true} className="accent-[var(--color-brass)]" />
          Oculto hasta descubrirlo
        </label>
        <label className="flex items-center gap-2 text-sm text-parchment">
          <input type="checkbox" name="isActive" defaultChecked={camino?.isActive ?? true} className="accent-[var(--color-brass)]" />
          Activo
        </label>
      </div>
      <BotonGuardar>{camino ? 'Guardar cambios' : 'Crear camino'}</BotonGuardar>
    </form>
  )
}

export function FormularioSecuencia({
  caminos,
  elementos,
}: {
  caminos: { id: string; name: string }[]
  elementos: ElementoOpcion[]
}) {
  const [estado, enviar] = useActionState(guardarSecuencia, ESTADO_INICIAL)

  return (
    <form action={enviar} className="space-y-3 rounded-lg mist-card p-4">
      <h2 className="etiqueta">Nueva secuencia (o reasignar la de un elemento)</h2>
      <MensajeEstado estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="s-camino" className="etiqueta">Camino</label>
          <select id="s-camino" name="pathwayId" required defaultValue="" className="campo">
            <option value="">— Selecciona —</option>
            {caminos.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-numero" className="etiqueta">Número</label>
          <input id="s-numero" name="number" type="number" required min={0} max={99} defaultValue={9} className="campo" />
        </div>
        <div>
          <label htmlFor="s-nombre" className="etiqueta">Nombre de la secuencia</label>
          <input id="s-nombre" name="name" required maxLength={80} className="campo" />
        </div>
        <div>
          <span className="etiqueta">Elemento que la representa</span>
          <CampoElemento
            name="elementId"
            elementos={elementos}
            placeholder="Buscar elemento…"
          />
        </div>
      </div>
      <fieldset className="rounded-md border border-line p-3">
        <legend className="etiqueta px-1">Acceso a la secuencia</legend>
        <label className="mb-3 flex items-center gap-2 text-sm text-parchment">
          <input
            type="checkbox"
            name="crearRecetaNormal"
            defaultChecked
            className="accent-[var(--color-brass)]"
          />
          Crear también una receta normal para esta secuencia
        </label>
        <p className="mb-2 text-xs text-fog">
          Desmarca esta opción si la secuencia solo debe descubrirse mediante
          un Avance desconocido. En ese caso puedes dejar los ingredientes vacíos.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="etiqueta">Ingrediente 1</span>
            <CampoElemento
              name="ingrediente1Id"
              elementos={elementos}
              placeholder="Buscar ingrediente…"
            />
          </div>
          <div>
            <span className="etiqueta">Ingrediente 2</span>
            <CampoElemento
              name="ingrediente2Id"
              elementos={elementos}
              placeholder="Buscar ingrediente…"
            />
          </div>
        </div>
      </fieldset>
      <div>
        <label htmlFor="s-desc" className="etiqueta">Descripción (opcional)</label>
        <input id="s-desc" name="description" maxLength={500} className="campo" />
      </div>
      <BotonGuardar>Guardar secuencia</BotonGuardar>
    </form>
  )
}
