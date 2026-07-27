import { useEffect, useState } from 'react'

export const MIN_DURATION = 0.5
export const MAX_DURATION = 60

// Duracion propia de una carta o imagen dentro del video, pegada a su
// miniatura. Vacio significa "sin excepcion": ese elemento usa la duracion
// global, que es lo que se muestra atenuado como pista.
export default function DurationBadge({ value, fallback, disabled, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // Si el valor cambia por fuera (otra pestaña, el MCP) mientras no se esta
  // editando, el badge tiene que reflejarlo.
  useEffect(() => {
    if (!editing) setDraft(value === null || value === undefined ? '' : String(value))
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const text = draft.trim()
    if (text === '') {
      if (value !== null && value !== undefined) onChange(null)
      return
    }
    const parsed = Number(text.replace(',', '.'))
    if (!Number.isFinite(parsed)) return
    const clamped = Math.min(MAX_DURATION, Math.max(MIN_DURATION, parsed))
    if (clamped !== value) onChange(clamped)
  }

  if (editing) {
    return (
      <input
        className="duration-badge editing"
        autoFocus
        value={draft}
        inputMode="decimal"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  const own = value !== null && value !== undefined
  return (
    <button
      className={'duration-badge' + (own ? ' own' : '')}
      disabled={disabled}
      title={own
        ? `Dura ${value}s. Borra el valor para volver a la global (${fallback}s).`
        : `Usa la duracion global (${fallback}s). Pulsa para darle la suya.`}
      onClick={(e) => { e.stopPropagation(); setEditing(true) }}
    >{own ? `${value}s` : `${fallback}s`}</button>
  )
}
