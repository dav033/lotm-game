'use client'

import { ShieldAlert } from 'lucide-react'
import { ModalOculto } from './ModalOculto'

export function ModalRiesgoRitual({
  onCancelar,
  onConfirmar,
  cargando,
}: {
  onCancelar: () => void
  onConfirmar: () => void
  cargando: boolean
}) {
  return (
    <ModalOculto
      titulo="Ascensión sin protección"
      descripcionId="riesgo-ritual-descripcion"
      onCerrar={onCancelar}
    >
      <ShieldAlert className="mx-auto h-12 w-12 text-wine" aria-hidden />
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl text-parchment">
        Ascensión sin protección
      </h2>
      <p id="riesgo-ritual-descripcion" className="mt-4 text-sm leading-relaxed text-fog">
        No has completado una preparación ritual para esta ascensión. Intentarlo de todos modos
        puede producir consecuencias irreversibles.
      </p>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          autoFocus
          disabled={cargando}
          onClick={onCancelar}
          className="rounded-md border border-line2 px-5 py-2.5 text-sm text-parchment transition hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={cargando}
          onClick={onConfirmar}
          className="rounded-md border border-wine bg-wine/20 px-5 py-2.5 text-sm text-parchment transition hover:bg-wine/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine disabled:opacity-40"
        >
          {cargando ? 'Consultando…' : 'Intentar sin protección'}
        </button>
      </div>
    </ModalOculto>
  )
}
