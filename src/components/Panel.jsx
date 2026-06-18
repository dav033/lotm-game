import { useState, useRef, useEffect } from 'react'
import { PATHWAYS, PATH_NAMES } from '../data/pathways.js'

// Searchable pathway combobox. The typed text is a local draft; the committed
// pathway (`value`) only changes when an option is picked, so clearing the input
// to search never leaves an invalid pathway. Picking resets that slot to Seq 0.
function PathwayCombo({ value, onPick }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const blurTimer = useRef(null)

  // Keep the draft in sync when the committed pathway changes from outside.
  useEffect(() => { setQuery(value) }, [value])

  const filter = query.trim().toLowerCase()
  const matches = PATH_NAMES.filter((n) => n.toLowerCase().includes(filter))

  return (
    <>
      <input
        value={query}
        placeholder="Type to search…"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => { setOpen(false); setQuery(value) }, 150)
        }}
      />
      <div className={'combo-list' + (open ? ' open' : '')}>
        {matches.length === 0 ? (
          <div className="none">No results</div>
        ) : (
          matches.map((n) => (
            <div
              key={n}
              className="opt"
              onMouseDown={(e) => {
                e.preventDefault()
                clearTimeout(blurTimer.current)
                onPick(n)
                setOpen(false)
              }}
            >
              {n}
              <span className="s0">Seq 0 · {PATHWAYS[n][9]}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

function SeqSelect({ path, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: 10 }, (_, i) => 9 - i).map((n) => (
        <option key={n} value={n}>Seq {n} · {PATHWAYS[path][9 - n]}</option>
      ))}
    </select>
  )
}

export default function Panel({
  state, set, accent, batch, busy, editingId, editingIndex,
  onUploadImage, onDownload, onAddToBatch, onUpdateCard, onLoadCard, onStep, onNewCard,
  onRemoveFromBatch, onClearBatch, onDownloadZip,
}) {
  const fileRef = useRef(null)

  return (
    <div className="panel">
      <h1>Card builder</h1>
      <p className="sub">
        Search a pathway (loads its sequences), pick the sequence (auto-colors by tier),
        then export at 960×1280.
      </p>

      <div className="field">
        <label>Type</label>
        <div className="toggle">
          {['Character', 'Artifact'].map((t) => (
            <button
              key={t}
              className={'seg' + (state.type === t ? ' sel' : '')}
              onClick={() => set({ type: t })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Name</label>
        <input value={state.name} onChange={(e) => set({ name: e.target.value })} />
      </div>

      <div className="field">
        <label>Pathway (search all 22)</label>
        <PathwayCombo
          value={state.path}
          onPick={(n) => set({ path: n, seq: 0 })}
        />
      </div>

      <div className="field">
        <label>Sequence</label>
        <SeqSelect path={state.path} value={state.seq} onChange={(seq) => set({ seq })} />
      </div>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={state.hasSecond}
            onChange={(e) => set({ hasSecond: e.target.checked })}
          />
          Second sequence (optional)
        </label>
      </div>

      {state.hasSecond && (
        <>
          <div className="field">
            <label>Pathway #2</label>
            <PathwayCombo
              value={state.path2}
              onPick={(n) => set({ path2: n, seq2: 0 })}
            />
          </div>

          <div className="field">
            <label>Sequence #2</label>
            <SeqSelect path={state.path2} value={state.seq2} onChange={(seq2) => set({ seq2 })} />
          </div>
        </>
      )}

      {state.type === 'Character' && (
        <div className="field">
          <label>Power</label>
          <select value={state.power} onChange={(e) => set({ power: e.target.value })}>
            <option>Human</option>
            <option>Low Sequence</option>
            <option>Mid Sequence</option>
            <option>Saint</option>
            <option>Angel</option>
            <option>King of Angels</option>
            <option>True God</option>
          </select>
        </div>
      )}

      {state.type === 'Artifact' && (
        <div className="field">
          <label>Grade</label>
          <select value={state.grade} onChange={(e) => set({ grade: e.target.value })}>
            <option>5</option><option>4</option><option>3</option>
            <option>2</option><option>1</option><option>0</option>
          </select>
        </div>
      )}

      <div className="field">
        <label>Modifier — shown in parentheses (optional)</label>
        <input
          value={state.mod}
          placeholder="e.g. latent"
          onChange={(e) => set({ mod: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Alter Domain</label>
        <input value={state.dom} onChange={(e) => set({ dom: e.target.value })} />
      </div>

      <div className="legend">
        <div className="lt">Tier color system</div>
        <div className="lrow"><span className="sw" style={{ background: '#6e8bc0' }} />Seq 9–7 · Low</div>
        <div className="lrow"><span className="sw" style={{ background: '#46c2a0' }} />Seq 6–4 · Mid</div>
        <div className="lrow"><span className="sw" style={{ background: '#b07ce0' }} />Seq 3–1 · High (Angel)</div>
        <div className="lrow"><span className="sw" style={{ background: '#e8c36b' }} />Seq 0 · Apex (God)</div>
      </div>

      <div className="actions">
        <button className="btn-img" onClick={() => fileRef.current.click()}>Upload image</button>
        <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onUploadImage(e.target.files[0])}
      />

      <div className="batch">
        <div className="batch-head">
          <span className="bt">Batch · {batch.length}</span>
          {batch.length > 0 && (
            <div className="batch-nav">
              <button className="nav" onClick={() => onStep(-1)} aria-label="Previous">‹</button>
              <span className="pos">{editingIndex >= 0 ? editingIndex + 1 : '–'} / {batch.length}</span>
              <button className="nav" onClick={() => onStep(1)} aria-label="Next">›</button>
            </div>
          )}
          {batch.length > 0 && (
            <button className="batch-clear" onClick={onClearBatch}>Clear all</button>
          )}
        </div>

        {editingId ? (
          <div className="batch-actions">
            <button className="batch-add" disabled={busy} onClick={onUpdateCard}>
              {busy ? 'Saving…' : `Update card ${editingIndex + 1}`}
            </button>
            <button className="batch-add ghost" disabled={busy} onClick={onAddToBatch}>Save as new</button>
            <button className="batch-add ghost" onClick={onNewCard}>New card</button>
          </div>
        ) : (
          <button className="batch-add" disabled={busy} onClick={onAddToBatch}>
            {busy ? 'Saving…' : '+ Save current card to batch'}
          </button>
        )}

        {batch.length === 0 ? (
          <p className="batch-empty">No cards saved yet. Save the current card, change the fields, save again — repeat for as many as you want. Click any thumbnail to edit it.</p>
        ) : (
          <div className="batch-grid">
            {batch.map((item) => (
              <div
                className={'thumb' + (item.id === editingId ? ' active' : '')}
                key={item.id}
                title={item.label}
                onClick={() => onLoadCard(item.id)}
              >
                <img src={item.url} alt={item.label} />
                <button
                  className="rm"
                  onClick={(e) => { e.stopPropagation(); onRemoveFromBatch(item.id) }}
                  aria-label="Remove"
                >×</button>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn-zip"
          style={{ background: accent.c }}
          disabled={batch.length === 0}
          onClick={onDownloadZip}
        >
          Download ZIP ({batch.length})
        </button>
      </div>

      <p className="hint">PNG exports at 960×1280 (vertical 3:4). If the download fails, just screenshot the card.</p>
    </div>
  )
}
