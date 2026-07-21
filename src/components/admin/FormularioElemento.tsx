'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { guardarElemento } from '@/server/actions/elementos'
import { ESTADO_INICIAL } from '@/server/actions/tipos'
import { ELEMENT_TYPES, etiquetaTipo } from '@/server/domain/tipos'
import { ICON_KEYS, IconoElemento } from '@/components/game/IconoElemento'
import { SelectorDesencadenantes } from './SelectorDesencadenantes'
import type { ElementoOpcion } from './tiposReceta'
import { BotonGuardar, MensajeEstado } from './ui'

export type ElementoEditable = {
  id: string
  slug: string
  name: string
  description: string
  iconKey: string
  imageUrl: string | null
  type: string
  tier: number
  isHiddenUntilDiscovered: boolean
  isMajorDiscovery: boolean
  revealTitle: string | null
  revealText: string | null
  unlockedByType: string | null
  unlockedBySequenceNumber: number | null
  unlockedAtDiscoveryCount: number | null
  triggerIds: string[]
  isActive: boolean
  categoriaIds: string[]
  categoriaPrincipalId: string
}

export default function FormularioElemento({
  elemento,
  categorias,
  elementos,
  slugBloqueado,
}: {
  elemento: ElementoEditable | null
  categorias: { id: string; name: string }[]
  // Opciones para los desencadenantes del descubrimiento espontáneo.
  elementos: ElementoOpcion[]
  slugBloqueado: boolean
}) {
  const router = useRouter()
  const accion = guardarElemento.bind(null, elemento?.id ?? null)
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL)

  useEffect(() => {
    if (estado.ok && !elemento) router.push('/admin/elementos')
    else if (estado.ok) router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  return (
    <form action={enviar} className="max-w-2xl space-y-4">
      <MensajeEstado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="etiqueta">Nombre visible</label>
          <input id="name" name="name" required maxLength={80} defaultValue={elemento?.name ?? ''} className="campo" />
        </div>
        <div>
          <label htmlFor="slug" className="etiqueta">
            Identificador (slug) {slugBloqueado && '· inmutable: ya está en uso'}
          </label>
          <input
            id="slug"
            name="slug"
            required
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Solo minúsculas, números y guiones; sin acentos."
            defaultValue={elemento?.slug ?? ''}
            readOnly={slugBloqueado}
            className={`campo ${slugBloqueado ? 'opacity-60' : ''}`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="etiqueta">Descripción</label>
        <textarea id="description" name="description" rows={2} maxLength={500} defaultValue={elemento?.description ?? ''} className="campo" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="type" className="etiqueta">Tipo</label>
          <select id="type" name="type" defaultValue={elemento?.type ?? 'CONCEPTO'} className="campo">
            {ELEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{etiquetaTipo(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tier" className="etiqueta">Nivel (tier)</label>
          <input id="tier" name="tier" type="number" min={0} max={99} defaultValue={elemento?.tier ?? 0} className="campo" />
        </div>
        <div>
          <label htmlFor="iconKey" className="etiqueta">Icono</label>
          <div className="flex items-center gap-2">
            <select id="iconKey" name="iconKey" defaultValue={elemento?.iconKey ?? 'sparkles'} className="campo">
              {ICON_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <IconoElemento iconKey={elemento?.iconKey ?? 'sparkles'} className="h-5 w-5 shrink-0 text-brass" />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="imageUrl" className="etiqueta">Imagen (ruta o URL, opcional — nunca base64)</label>
        <input id="imageUrl" name="imageUrl" maxLength={300} defaultValue={elemento?.imageUrl ?? ''} placeholder="/imagenes/ojo.webp" className="campo" />
      </div>

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="etiqueta px-1">Comportamiento</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-parchment">
            <input type="checkbox" name="isHiddenUntilDiscovered" defaultChecked={elemento?.isHiddenUntilDiscovered ?? true} className="accent-[var(--color-brass)]" />
            Oculto hasta descubrirlo
          </label>
          <label className="flex items-center gap-2 text-sm text-parchment">
            <input type="checkbox" name="isMajorDiscovery" defaultChecked={elemento?.isMajorDiscovery ?? false} className="accent-[var(--color-brass)]" />
            Descubrimiento mayor (revelación especial)
          </label>
          <label className="flex items-center gap-2 text-sm text-parchment">
            <input type="checkbox" name="isActive" defaultChecked={elemento?.isActive ?? true} className="accent-[var(--color-brass)]" />
            Activo
          </label>
          <p className="text-xs leading-5 text-fog sm:col-span-2">
            Los elementos iniciales se configuran en la pestaña Fases del árbol.
          </p>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="etiqueta px-1">Descubrimiento espontáneo</legend>
        <p className="mb-3 text-xs text-fog">
          Para conceptos que no se fabrican con recetas: se revelan solos
          cuando el jugador descubre cualquier elemento del tipo elegido, o
          cualquiera de los elementos desencadenantes.
        </p>
        <div>
          <label htmlFor="unlockedByType" className="etiqueta">
            Al descubrir un elemento de tipo…
          </label>
          <select
            id="unlockedByType"
            name="unlockedByType"
            defaultValue={elemento?.unlockedByType ?? ''}
            className="campo"
          >
            <option value="">— Ninguno</option>
            {ELEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{etiquetaTipo(t)}</option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <label htmlFor="unlockedBySequenceNumber" className="etiqueta">
            Al descubrir cualquier secuencia número…
          </label>
          <input
            id="unlockedBySequenceNumber"
            name="unlockedBySequenceNumber"
            type="number"
            min={0}
            max={99}
            defaultValue={elemento?.unlockedBySequenceNumber ?? ''}
            placeholder="Ej. 7"
            className="campo"
          />
        </div>
        <div className="mt-3">
          <label htmlFor="unlockedAtDiscoveryCount" className="etiqueta">
            Al tener al menos… elementos activos descubiertos
          </label>
          <input
            id="unlockedAtDiscoveryCount"
            name="unlockedAtDiscoveryCount"
            type="number"
            min={0}
            max={9999}
            defaultValue={elemento?.unlockedAtDiscoveryCount ?? ''}
            placeholder="Ej. 42"
            className="campo"
          />
        </div>
        <div className="mt-3">
          <span className="etiqueta">Al descubrir alguno de estos elementos…</span>
          <SelectorDesencadenantes
            elementos={elementos.filter((e) => e.id !== elemento?.id)}
            iniciales={elemento?.triggerIds ?? []}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="revealTitle" className="etiqueta">Título de revelación (opcional)</label>
          <input id="revealTitle" name="revealTitle" maxLength={120} defaultValue={elemento?.revealTitle ?? ''} className="campo" />
        </div>
        <div>
          <label htmlFor="revealText" className="etiqueta">Texto de revelación (opcional)</label>
          <input id="revealText" name="revealText" maxLength={500} defaultValue={elemento?.revealText ?? ''} className="campo" />
        </div>
      </div>

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="etiqueta px-1">Categorías</legend>
        {categorias.length === 0 && <p className="text-sm text-fog">Aún no hay categorías.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {categorias.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-parchment">
              <input
                type="checkbox"
                name="categoriaIds"
                value={c.id}
                defaultChecked={elemento?.categoriaIds.includes(c.id) ?? false}
                className="accent-[var(--color-brass)]"
              />
              {c.name}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <label htmlFor="categoriaPrincipalId" className="etiqueta">Categoría principal</label>
          <select
            id="categoriaPrincipalId"
            name="categoriaPrincipalId"
            defaultValue={elemento?.categoriaPrincipalId ?? ''}
            className="campo"
          >
            <option value="">— (la primera marcada)</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="flex gap-3">
        <BotonGuardar>{elemento ? 'Guardar cambios' : 'Crear elemento'}</BotonGuardar>
        <button type="button" onClick={() => router.push('/admin/elementos')} className="btn-ghost">
          Volver
        </button>
      </div>
    </form>
  )
}
