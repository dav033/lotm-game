'use client'

import { useActionState } from 'react'
import { guardarCategoria } from '@/server/actions/categorias'
import { ESTADO_INICIAL } from '@/server/actions/tipos'
import { BotonGuardar, MensajeEstado } from './ui'

export type CategoriaEditable = {
  id: string
  slug: string
  name: string
  description: string | null
  parentId: string | null
  sortOrder: number
  isHidden: boolean
  isActive: boolean
}

export default function FormularioCategoria({
  categoria,
  padres,
}: {
  categoria: CategoriaEditable | null
  padres: { id: string; name: string }[]
}) {
  const accion = guardarCategoria.bind(null, categoria?.id ?? null)
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL)

  return (
    <form action={enviar} className="space-y-3 rounded-lg mist-card p-4" key={categoria?.id ?? 'nueva'}>
      <h2 className="etiqueta">{categoria ? `Editar: ${categoria.name}` : 'Nueva categoría'}</h2>
      <MensajeEstado estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="etiqueta">Nombre</label>
          <input id="c-name" name="name" required maxLength={80} defaultValue={categoria?.name ?? ''} className="campo" />
        </div>
        <div>
          <label htmlFor="c-slug" className="etiqueta">Identificador (slug)</label>
          <input
            id="c-slug" name="slug" required maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Solo minúsculas, números y guiones."
            defaultValue={categoria?.slug ?? ''} className="campo"
          />
        </div>
        <div>
          <label htmlFor="c-parent" className="etiqueta">Categoría padre</label>
          <select id="c-parent" name="parentId" defaultValue={categoria?.parentId ?? ''} className="campo">
            <option value="">— Ninguna (raíz)</option>
            {padres
              .filter((p) => p.id !== categoria?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="c-orden" className="etiqueta">Orden</label>
          <input id="c-orden" name="sortOrder" type="number" min={0} max={9999} defaultValue={categoria?.sortOrder ?? 0} className="campo" />
        </div>
      </div>
      <div>
        <label htmlFor="c-desc" className="etiqueta">Descripción</label>
        <input id="c-desc" name="description" maxLength={500} defaultValue={categoria?.description ?? ''} className="campo" />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-parchment">
          <input type="checkbox" name="isHidden" defaultChecked={categoria?.isHidden ?? false} className="accent-[var(--color-brass)]" />
          Oculta hasta descubrir algo dentro
        </label>
        <label className="flex items-center gap-2 text-sm text-parchment">
          <input type="checkbox" name="isActive" defaultChecked={categoria?.isActive ?? true} className="accent-[var(--color-brass)]" />
          Activa
        </label>
      </div>
      <BotonGuardar>{categoria ? 'Guardar cambios' : 'Crear categoría'}</BotonGuardar>
    </form>
  )
}
