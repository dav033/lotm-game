import { useState } from 'react'

// Hasta tres proyectos abiertos a la vez. El limite no es tecnico: mas
// pestañas convierten la barra en una lista y dejan de servir para saltar de
// una cosa a otra de un vistazo.
export const MAX_OPEN_PROJECTS = 3

export default function ProjectTabs({
  projects, openIds, activeId, busy, onActivate, onOpen, onClose, onCreate,
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')

  const open = openIds
    .map((id) => projects.find((project) => project.id === id))
    .filter(Boolean)
  const closed = projects.filter((project) => !openIds.includes(project.id))
  const full = open.length >= MAX_OPEN_PROJECTS

  const commit = async () => {
    const name = draft.trim()
    setCreating(false)
    setDraft('')
    if (name) await onCreate(name)
  }

  return (
    <div className="project-tabs">
      {open.map((project) => (
        <div
          key={project.id}
          className={'project-tab' + (project.id === activeId ? ' active' : '')}
        >
          <button
            className="project-tab-name"
            disabled={busy}
            onClick={() => onActivate(project.id)}
            title={`${project.cardCount} cartas · ${project.imageCount} imagenes`}
          >
            {project.name}
          </button>
          {open.length > 1 ? (
            <button
              className="project-tab-close"
              aria-label={`Cerrar ${project.name}`}
              disabled={busy}
              onClick={() => onClose(project.id)}
            >×</button>
          ) : null}
        </div>
      ))}

      {/* Un proyecto cerrado no se borra: sigue en la base y se reabre aqui. */}
      {closed.length && !full ? (
        <select
          className="project-open"
          value=""
          disabled={busy}
          onChange={(e) => { if (e.target.value) onOpen(e.target.value) }}
        >
          <option value="">Abrir proyecto…</option>
          {closed.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      ) : null}

      {creating ? (
        <input
          className="project-new-input"
          autoFocus
          value={draft}
          placeholder="Nombre del proyecto"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') { setCreating(false); setDraft('') }
          }}
        />
      ) : (
        <button
          className="project-new"
          disabled={busy || full}
          title={full ? `Maximo ${MAX_OPEN_PROJECTS} proyectos abiertos` : 'Nuevo proyecto'}
          onClick={() => setCreating(true)}
        >+ Proyecto</button>
      )}
    </div>
  )
}
