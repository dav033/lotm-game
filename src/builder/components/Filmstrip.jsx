import { useState } from 'react'

// Horizontal strip of saved cards (Canva-style "pages"). Click to edit, drag a
// thumbnail onto another to reorder, "+" to add a new card.
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

  return (
    <div className="filmstrip">
      <div className="filmstrip-rail">
        {batch.map((item, i) => (
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
            {item.url ? (
              <img src={item.url} alt={item.label} draggable={false} />
            ) : (
              <span className="film-empty">…</span>
            )}
            <button
              className="film-rm"
              onClick={(e) => { e.stopPropagation(); onRemoveFromBatch(item.id) }}
              aria-label="Remove"
            >×</button>
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
