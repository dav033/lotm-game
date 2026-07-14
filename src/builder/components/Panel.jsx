import { useState, useRef, useEffect } from 'react'
import { PATHWAYS, PATH_NAMES, TIER_RANKS, TIER_RANK_NAMES } from '../data/pathways.js'

// Searchable pathway combobox. Focusing clears the field so you can type a new
// search instantly; Enter commits the first match; Escape/blur restores the
// committed pathway. The typed text is a local draft, so clearing it to search
// never leaves an invalid pathway.
function PathwayCombo({ value, onPick }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const blurTimer = useRef(null)

  // Show the committed pathway whenever the field is closed/idle.
  useEffect(() => { if (!open) setQuery('') }, [value, open])

  const filter = query.trim().toLowerCase()
  const matches = PATH_NAMES.filter((n) => n.toLowerCase().includes(filter))

  const commit = (n) => {
    onPick(n)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <>
      <input
        ref={inputRef}
        value={open ? query : value}
        placeholder="Type to search…"
        autoComplete="off"
        onFocus={() => { setQuery(''); setOpen(true) }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length) { e.preventDefault(); commit(matches[0]) }
          else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => { setOpen(false); setQuery('') }, 150)
        }}
      />
      <div className={'combo-list' + (open ? ' open' : '')}>
        {matches.length === 0 ? (
          <div className="none">No results</div>
        ) : (
          matches.map((n, i) => (
            <div
              key={n}
              className={'opt' + (i === 0 ? ' active' : '')}
              onMouseDown={(e) => {
                e.preventDefault()
                clearTimeout(blurTimer.current)
                commit(n)
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

export default function Panel({ state, set, accent, onUploadImage, onDownload, onGenerateTierBatch }) {
  const fileRef = useRef(null)
  const isCover = state.type === 'Cover'
  const isTier = state.type === 'Tier'

  return (
    <aside className="panel">
      <h1>Card builder</h1>
      <p className="sub">
        Search a pathway, pick the sequence (auto-colors by tier), and your work
        saves automatically. Export at 960×1280.
      </p>

      <div className="field">
        <label>Type</label>
        <div className="toggle">
          {['Character', 'Artifact', 'Cover', 'Tier'].map((t) => (
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

      {isTier ? (
        <div key="tier-fields">
          <div className="field">
            <label>Pathway (search all 22)</label>
            <PathwayCombo
              value={PATHWAYS[state.tierPath] ? state.tierPath : 'Fool'}
              onPick={(n) => set({ tierPath: n })}
            />
          </div>

          <div className="field">
            <label>Tier</label>
            <div className="toggle tier-toggle">
              {TIER_RANK_NAMES.map((r) => (
                <button
                  key={r}
                  className={'seg' + (state.tierRank === r ? ' sel' : '')}
                  style={state.tierRank === r
                    ? { background: TIER_RANKS[r].c, borderColor: TIER_RANKS[r].c, color: '#0a0a11' }
                    : { color: TIER_RANKS[r].c }}
                  onClick={() => set({ tierRank: r })}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Verdict — shown on the slide</label>
            <textarea
              rows={6}
              value={state.tierText ?? ''}
              placeholder="Why this pathway lands in this tier…"
              onChange={(e) => set({ tierText: e.target.value })}
            />
          </div>

          <button className="batch-add" onClick={onGenerateTierBatch}>
            Generate all 22 pathway slides
          </button>

          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>

          <p className="hint">
            One slide per pathway: pick it, rank it, write your verdict. The rank
            color tints the whole card. "Generate all 22" appends one slide per
            pathway in canon order so you can rank them one by one.
          </p>
        </div>
      ) : isCover ? (
        <div key="cover-fields">
          <div className="field">
            <label>Title (crossover series)</label>
            <input
              value={state.coverTitle ?? ''}
              placeholder="e.g. Fate"
              onChange={(e) => set({ coverTitle: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Part</label>
            <input
              value={state.coverPartNum ?? ''}
              placeholder="e.g. 1"
              onChange={(e) => set({ coverPartNum: e.target.value })}
            />
          </div>

          <p className="hint">
            Everything else — "Pathways in", "Part", "Lord of Mysteries ×" —
            is fixed. Click or drop images directly onto the top and main
            panels of the cover to upload them. Every change auto-saves.
          </p>
        </div>
      ) : (
        <div key="stat-fields">
          <div className="field">
            <label>Name</label>
            <input value={state.name} onChange={(e) => set({ name: e.target.value })} />
          </div>

          <div className="field">
            <label>Pathway (search all 22)</label>
            <PathwayCombo value={state.path} onPick={(n) => set({ path: n, seq: 0 })} />
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
                <PathwayCombo value={state.path2} onPick={(n) => set({ path2: n, seq2: 0 })} />
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

          <p className="hint">
            Every change auto-saves. Use the strip below the card to switch, reorder
            (drag), or add cards. PNG exports at 960×1280.
          </p>
        </div>
      )}

      {isCover && (
        <div className="actions">
          <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
        </div>
      )}
    </aside>
  )
}
