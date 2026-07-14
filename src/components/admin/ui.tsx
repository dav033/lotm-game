'use client'

import { useFormStatus } from 'react-dom'
import type { EstadoAccion } from '@/server/actions/tipos'

// Botón de envío que se desactiva mientras la acción está en curso
// (evita envíos duplicados).
export function BotonGuardar({ children = 'Guardar' }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn-brass">
      {pending ? 'Guardando…' : children}
    </button>
  )
}

export function MensajeEstado({ estado }: { estado: EstadoAccion }) {
  if (estado.error) {
    return (
      <p role="alert" className="rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm text-parchment">
        {estado.error}
      </p>
    )
  }
  if (estado.ok) {
    return (
      <p role="status" className="rounded-md border border-brass-deep bg-brass/10 px-3 py-2 text-sm text-brass">
        Guardado correctamente.
      </p>
    )
  }
  return null
}
