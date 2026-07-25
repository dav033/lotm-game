import { useState } from 'react'
import LiveCardPreview from '../LiveCardPreview.jsx'

// Horizontal strip of saved cards (Canva-style "pages"). Click to edit, drag a
// thumbnail onto another to reorder, "+" to add a new card.
//
// Cada miniatura es la carta de verdad pintada a escala, no una captura: se ve
// sin haberla abierto y sigue al dia sola, incluso si la edita el MCP.
// Las cartas llegan ya ordenadas por universo, seccion y posicion, asi que las
// de una misma seccion son siempre consecutivas.
function groupBySection(batch) {
  const groups = []
  batch.forEach((item, index) => {
    const current = groups[groups.length - 1]
    if (current && current.partId === item.part.id) current.items.push({ item, index })
    else groups.push({ partId: item.part.id, universe: item.universe, part: item.part, items: [{ item, index }] })
  })
  return groups
}

export default function Filmstrip({
  batch, editingId, accent, busy,
  onLoadCard, onNewCard, onRemoveFromBatch, onReorder, onDownloadZip,
}) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const handleDrop = (to) => {
    if (dragIndex !== null) onReorder(dragIndex, to)
    setDragIndex(null)
    setOverIndex(null)
  }

  const groups = groupBySection(batch)
  // El universo solo se nombra si hay mas de uno; con uno solo seria ruido.
  const showUniverse = new Set(batch.map((item) => item.universe.id)).size > 1

  return (
    <div className="filmstrip">
      <div className="filmstrip-rail">
        {groups.map((group) => (
          <div className="film-group" key={group.partId}>
            <span
              className="film-group-label"
              title={`${group.universe.name} · ${group.part.name}`}
            >
              {showUniverse ? `${group.universe.name} · ` : ''}
              {group.part.number === null ? '' : `${group.part.number}. `}
              {group.part.name}
            </span>
            <div className="film-group-cards">
              {group.items.map(({ item, index: i }) => (
                <div
                  key={item.id}
                  className={
                    'film-thumb' +
                    (item.id === editingId ? ' active' : '') +
                    (overIndex === i && dragIndex !== null ? ' over' : '')
                  }
                  title={item.label}
                  draggable
                  onClick={() => onLoadCard(item.id)}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }}
                  onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
                  onDrop={(e) => { e.preventDefault(); handleDrop(i) }}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                >
                  <span className="film-no">{i + 1}</span>
                  <div className="film-preview">
                    <LiveCardPreview state={item.state} />
                  </div>
                  <button
                    className="film-rm"
                    onClick={(e) => { e.stopPropagation(); onRemoveFromBatch(item.id) }}
                    aria-label="Remove"
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button className="film-add" onClick={onNewCard} disabled={busy} title="New card">
          +
        </button>
      </div>

      <button
        className="btn-zip"
        style={{ background: accent.c }}
        disabled={batch.length === 0 || busy}
        onClick={onDownloadZip}
      >
        Download all ({batch.length})
      </button>
    </div>
  )
}
