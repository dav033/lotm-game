import { useEffect, useRef, useState } from 'react'

// Un solo campo para las dos cosas: escribir el nombre de una seccion que ya
// existe mueve la carta ahi, y escribir uno nuevo la crea. El datalist sugiere
// las que hay, asi que no hace falta recordarlas.
export default function SectionField({ section, sections, onMove }) {
  const [draft, setDraft] = useState(section?.name ?? '')
  const [busy, setBusy] = useState(false)
  const committed = useRef(section?.name ?? '')

  // Si la carta activa cambia (o la mueve el MCP), el campo la sigue.
  useEffect(() => {
    committed.current = section?.name ?? ''
    setDraft(section?.name ?? '')
  }, [section?.id, section?.name])

  if (!section) return null

  const commit = async () => {
    const name = draft.trim()
    if (!name || name === committed.current) {
      setDraft(committed.current)
      return
    }
    setBusy(true)
    // Coincidir con una seccion existente la reutiliza, incluso si esta en otro
    // universo; cualquier otro nombre crea una nueva junto a la carta.
    const existing = sections.find((s) => s.name.toLowerCase() === name.toLowerCase())
    const ok = await onMove(
      existing
        ? {
          universe: { name: existing.universe.name },
          part: existing.number === null ? { name: existing.name } : { name: existing.name, number: existing.number },
        }
        : { part: { name } },
    )
    if (!ok) setDraft(committed.current)
    setBusy(false)
  }

  return (
    <label className="stage-section">
      <span>Sección</span>
      <input
        list="stage-section-options"
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setDraft(committed.current); e.currentTarget.blur() }
        }}
      />
      <datalist id="stage-section-options">
        {sections.map((s) => <option key={s.id} value={s.name} />)}
      </datalist>
    </label>
  )
}
