import React, { useState, useRef, useEffect } from 'react'
import { PATHWAYS, PATH_NAMES, TIER_RANKS, TIER_RANK_NAMES } from '../data/pathways.js'
import { PATHWAY_BACKGROUNDS } from '../data/pathwayBackgrounds.js'

const BACKGROUND_OPACITY_PRESETS = [
  ['Low', 25],
  ['Medium', 45],
  ['High', 65],
  ['Very high', 85],
]

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

// Campo de imagen de fondo. Cada carta guarda la suya en un campo distinto del
// estado, asi que el nombre llega por prop y el input vive aqui dentro para no
// compartir un unico ref entre secciones.
function BackgroundOpacityField({ value = 65, set }) {
  const opacity = Math.max(0, Math.min(100, value))
  return (
    <div className="background-opacity-control">
      <div className="background-opacity-head">
        <label htmlFor="background-opacity">Background visibility</label>
        <output htmlFor="background-opacity">{opacity}%</output>
      </div>
      <input
        className="background-opacity-range"
        id="background-opacity"
        name="backgroundOpacity"
        type="range"
        min="0"
        max="100"
        step="1"
        value={opacity}
        onChange={(event) => set({ backgroundOpacity: Number(event.target.value) })}
      />
      <div className="toggle background-opacity-presets" role="group" aria-label="Background visibility presets">
        {BACKGROUND_OPACITY_PRESETS.map(([label, preset]) => (
          <button
            type="button"
            className={'seg' + (opacity === preset ? ' sel' : '')}
            aria-pressed={opacity === preset}
            key={label}
            onClick={() => set({ backgroundOpacity: preset })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function BackgroundField({ value, field, opacity, set, onUploadImage, help }) {
  const inputRef = useRef(null)
  return (
    <div className="field">
      <label>Background image (optional)</label>
      <div className="actions tier-background-actions">
        <button className="btn-img" onClick={() => inputRef.current?.click()}>
          {value ? 'Replace image' : 'Upload image'}
        </button>
        {value && <button className="btn-img" onClick={() => set({ [field]: null })}>Remove</button>}
      </div>
      <p className="field-help">
        {value ? 'Using a custom background.' : help}
      </p>
      <BackgroundOpacityField value={opacity} set={set} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Choose background image"
        hidden
        onChange={(event) => {
          onUploadImage(event.target.files[0], field)
          event.target.value = ''
        }}
      />
    </div>
  )
}

export default function Panel({ state, set, accent, onUploadImage, onDownload, onGenerateTierBatch }) {
  const fileRef = useRef(null)
  const isCover = state.type === 'Cover'
  const isFullImageCover = state.type === 'Full Image Cover'
  const isTier = state.type === 'Tier'
  const isPathwayCard = state.type === 'Pathway'
  const isTierExplanation = state.type === 'Tier Explanation'
  const isGeneralExplanation = state.type === 'General Explanation'
  const isPathwayExplanation = state.type === 'Pathway Explanation'
  const isBreakdown = state.type === 'Breakdown'
  const isMap = state.type === 'Map'
  const isExplanation = isTierExplanation || isGeneralExplanation
  const defaultTierBackground = PATHWAY_BACKGROUNDS[state.tierPath] ?? null
  const defaultPathwayCardBackground = PATHWAY_BACKGROUNDS[state.pathwayCardPath] ?? null

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
          {['Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier', 'Pathway', 'Tier Explanation', 'General Explanation', 'Pathway Explanation', 'Breakdown', 'Map'].map((t) => (
            <button
              key={t}
              className={'seg' + (state.type === t ? ' sel' : '')}
              onClick={() => set({
                type: t,
                ...(t === 'Tier Explanation' ? { explanationPath: null } : {}),
              })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isExplanation ? (
        <div key="explanation-fields">
          {isGeneralExplanation && (
            <>
              <div className="field">
                <label>Explanation scope</label>
                <div className="toggle">
                  <button
                    className={'seg' + (!state.explanationPath ? ' sel' : '')}
                    onClick={() => set({ explanationPath: null })}
                  >
                    All pathways
                  </button>
                  <button
                    className={'seg' + (state.explanationPath ? ' sel' : '')}
                    onClick={() => set({ explanationPath: state.explanationPath || 'Fool' })}
                  >
                    Specific pathway
                  </button>
                </div>
              </div>

              {state.explanationPath && (
                <div className="field">
                  <label>Pathway (search all 22)</label>
                  <PathwayCombo
                    value={PATHWAYS[state.explanationPath] ? state.explanationPath : 'Fool'}
                    onPick={(n) => set({ explanationPath: n })}
                  />
                </div>
              )}

              {/* Siempre, no solo con pathway: sin pathway no hay fondo por
                  defecto, pero una imagen propia se puede poner igual. */}
              <BackgroundField
                value={state.generalExplanationBackgroundImage}
                field="generalExplanationBackgroundImage"
                opacity={state.backgroundOpacity}
                set={set}
                onUploadImage={onUploadImage}
                help={state.explanationPath
                  ? `Using the default ${state.explanationPath} background. Upload one to override it.`
                  : 'No background image selected.'}
              />
            </>
          )}

          {isTierExplanation ? (
            <>
              <BackgroundField
                value={state.tierExplanationBackgroundImage}
                field="tierExplanationBackgroundImage"
                opacity={state.backgroundOpacity}
                set={set}
                onUploadImage={onUploadImage}
                help="No background image selected."
              />

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
                <label htmlFor="tier-short-explanation">Short description</label>
                <textarea
                  id="tier-short-explanation"
                  rows={5}
                  maxLength={240}
                  value={state.tierExplanationText ?? ''}
                  placeholder="A defining tier with exceptional versatility…"
                  autoComplete="off"
                  onChange={(e) => set({ tierExplanationText: e.target.value })}
                />
                <p className="field-help">{(state.tierExplanationText ?? '').length}/240 characters</p>
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="general-explanation-title">Title</label>
                <input
                  id="general-explanation-title"
                  maxLength={100}
                  value={state.generalExplanationTitle ?? ''}
                  placeholder="Understanding the pathways…"
                  autoComplete="off"
                  onChange={(e) => set({ generalExplanationTitle: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="general-explanation-text">Description</label>
                <textarea
                  id="general-explanation-text"
                  rows={10}
                  maxLength={800}
                  value={state.generalExplanationText ?? ''}
                  placeholder="Write the general explanation shown on the card…"
                  autoComplete="off"
                  onChange={(e) => set({ generalExplanationText: e.target.value })}
                />
                <p className="field-help">{(state.generalExplanationText ?? '').length}/800 characters</p>
              </div>
            </>
          )}

          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>
        </div>
      ) : isTier ? (
        <div key="tier-fields">
          <div className="field">
            <label>Pathway (search all 22)</label>
            <PathwayCombo
              value={PATHWAYS[state.tierPath] ? state.tierPath : 'Fool'}
              onPick={(n) => set({ tierPath: n })}
            />
          </div>

          <div className="field">
            <label>Tier subject</label>
            <div className="toggle">
              <button
                className={'seg' + (state.tierSeq === null ? ' sel' : '')}
                onClick={() => set({ tierSeq: null })}
              >
                Whole pathway
              </button>
              <button
                className={'seg' + (state.tierSeq !== null ? ' sel' : '')}
                onClick={() => set({ tierSeq: state.tierSeq ?? 9 })}
              >
                Specific sequence
              </button>
            </div>
          </div>

          {state.tierSeq !== null && (
            <div className="field">
              <label>Sequence</label>
              <SeqSelect
                path={PATHWAYS[state.tierPath] ? state.tierPath : 'Fool'}
                value={state.tierSeq}
                onChange={(tierSeq) => set({ tierSeq })}
              />
            </div>
          )}

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

          <BackgroundField
            value={state.tierBackgroundImage}
            field="tierBackgroundImage"
            opacity={state.backgroundOpacity}
            set={set}
            onUploadImage={onUploadImage}
            help={defaultTierBackground
              ? `Using the default ${state.tierPath} background.`
              : `No default background exists for ${state.tierPath}.`}
          />

          <div className="field">
            <label htmlFor="tier-explanation">Explanation points (one per line)</label>
            <p className="field-help" id="tier-explanation-help">
              Each non-empty line becomes a bullet. A leading -, *, or • is optional.
            </p>
            <textarea
              className="tier-textarea"
              id="tier-explanation"
              name="tierExplanation"
              rows={10}
              value={state.tierText ?? ''}
              placeholder={'Strong at low sequences…\nFlexible across matchups…\nFalls off at the highest levels…'}
              aria-describedby="tier-explanation-help"
              autoComplete="off"
              onChange={(e) => set({ tierText: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="tier-footer-text">Large bottom text</label>
            <textarea
              id="tier-footer-text"
              name="tierFooterText"
              rows={3}
              maxLength={240}
              value={state.tierFooterText ?? ''}
              placeholder="Add a final highlighted statement…"
              autoComplete="off"
              onChange={(event) => set({ tierFooterText: event.target.value })}
            />
            <p className="field-help">{(state.tierFooterText ?? '').length}/240 characters</p>
          </div>

          <button className="batch-add" onClick={onGenerateTierBatch}>
            Generate all 22 pathway slides
          </button>

          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>

          <p className="hint">
            One slide per pathway: pick it, rank it, add explanation points. The rank
            color tints the whole card. "Generate all 22" appends one slide per
            pathway in canon order so you can rank them one by one.
          </p>
        </div>
      ) : isPathwayCard ? (
        <div key="pathway-card-fields">
          <div className="field">
            <label>Pathway (search all 22)</label>
            <PathwayCombo
              value={PATHWAYS[state.pathwayCardPath] ? state.pathwayCardPath : 'Fool'}
              onPick={(n) => set({ pathwayCardPath: n })}
            />
          </div>

          <div className="field">
            <label>Subject</label>
            <div className="toggle">
              <button
                className={'seg' + (state.pathwayCardSeq === null ? ' sel' : '')}
                onClick={() => set({ pathwayCardSeq: null })}
              >
                Whole pathway
              </button>
              <button
                className={'seg' + (state.pathwayCardSeq !== null ? ' sel' : '')}
                onClick={() => set({ pathwayCardSeq: state.pathwayCardSeq ?? 9 })}
              >
                Specific sequence
              </button>
            </div>
          </div>

          {state.pathwayCardSeq !== null && (
            <div className="field">
              <label>Sequence</label>
              <SeqSelect
                path={PATHWAYS[state.pathwayCardPath] ? state.pathwayCardPath : 'Fool'}
                value={state.pathwayCardSeq}
                onChange={(pathwayCardSeq) => set({ pathwayCardSeq })}
              />
            </div>
          )}

          <BackgroundField
            value={state.pathwayCardBackgroundImage}
            field="pathwayCardBackgroundImage"
            opacity={state.backgroundOpacity}
            set={set}
            onUploadImage={onUploadImage}
            help={defaultPathwayCardBackground
              ? `Using the default ${state.pathwayCardPath} background.`
              : `No default background exists for ${state.pathwayCardPath}.`}
          />

          <div className="field">
            <label htmlFor="pathway-card-explanation">Explanation points (one per line)</label>
            <p className="field-help" id="pathway-card-explanation-help">
              Each non-empty line becomes a bullet. A leading -, *, or • is optional.
            </p>
            <textarea
              className="tier-textarea"
              id="pathway-card-explanation"
              name="pathwayCardText"
              rows={10}
              value={state.pathwayCardText ?? ''}
              placeholder={'Strong at low sequences…\nFlexible across matchups…\nFalls off at the highest levels…'}
              aria-describedby="pathway-card-explanation-help"
              autoComplete="off"
              onChange={(e) => set({ pathwayCardText: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="pathway-card-footer-text">Large bottom text</label>
            <textarea
              id="pathway-card-footer-text"
              name="pathwayCardFooterText"
              rows={3}
              maxLength={240}
              value={state.pathwayCardFooterText ?? ''}
              placeholder="Add a final highlighted statement…"
              autoComplete="off"
              onChange={(event) => set({ pathwayCardFooterText: event.target.value })}
            />
            <p className="field-help">{(state.pathwayCardFooterText ?? '').length}/240 characters</p>
          </div>

          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>

          <p className="hint">
            Same layout as a Tier slide, without the rank badge — the pathway's own
            color tints the whole card instead.
          </p>
        </div>
      ) : isPathwayExplanation ? (
        <div key="pathway-explanation-fields">
          <div className="field">
            <label>Pathway (search all 22)</label>
            <PathwayCombo
              value={PATHWAYS[state.pathwayExplanationPath] ? state.pathwayExplanationPath : 'Fool'}
              onPick={(n) => set({ pathwayExplanationPath: n })}
            />
          </div>

          <div className="field">
            <label htmlFor="pathway-explanation-title">Title</label>
            <input
              id="pathway-explanation-title"
              maxLength={100}
              value={state.pathwayExplanationTitle ?? ''}
              placeholder="Door isn't a *teleport* pathway."
              autoComplete="off"
              onChange={(e) => set({ pathwayExplanationTitle: e.target.value })}
            />
            <p className="field-help">Wrap a word or phrase in *asterisks* to highlight it in the tier color.</p>
          </div>

          <div className="field">
            <label htmlFor="pathway-explanation-text">Description</label>
            <textarea
              id="pathway-explanation-text"
              rows={5}
              maxLength={240}
              value={state.pathwayExplanationText ?? ''}
              placeholder="It's access and exclusion."
              autoComplete="off"
              onChange={(e) => set({ pathwayExplanationText: e.target.value })}
            />
            <p className="field-help">{(state.pathwayExplanationText ?? '').length}/240 characters</p>
          </div>

          <BackgroundField
            value={state.pathwayExplanationBackgroundImage}
            field="pathwayExplanationBackgroundImage"
            opacity={state.backgroundOpacity}
            set={set}
            onUploadImage={onUploadImage}
            help={`Using the default ${state.pathwayExplanationPath || 'pathway'} background. Upload one to override it.`}
          />

          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>

          <p className="hint">
            The "N / 22 PATHWAYS" counter is automatic — it's the pathway's position
            in canon order, not something you set.
          </p>
        </div>
      ) : isBreakdown ? (
        <div key="breakdown-fields">
          <div className="field">
            <label htmlFor="breakdown-kicker">Kicker (optional)</label>
            <input
              id="breakdown-kicker"
              maxLength={40}
              value={state.breakdownKicker ?? ''}
              placeholder="e.g. Authority"
              autoComplete="off"
              onChange={(e) => set({ breakdownKicker: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="breakdown-title">Title</label>
            <input
              id="breakdown-title"
              maxLength={60}
              value={state.breakdownTitle ?? ''}
              placeholder="e.g. Replication"
              autoComplete="off"
              onChange={(e) => set({ breakdownTitle: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="breakdown-does">Does</label>
            <textarea
              id="breakdown-does"
              rows={3}
              maxLength={240}
              value={state.breakdownDoes ?? ''}
              placeholder="What this does…"
              autoComplete="off"
              onChange={(e) => set({ breakdownDoes: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="breakdown-doesnot">Doesn't</label>
            <textarea
              id="breakdown-doesnot"
              rows={3}
              maxLength={240}
              value={state.breakdownDoesNot ?? ''}
              placeholder="What it doesn't do…"
              autoComplete="off"
              onChange={(e) => set({ breakdownDoesNot: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="breakdown-edge-label">Third section label</label>
            <input
              id="breakdown-edge-label"
              maxLength={20}
              value={state.breakdownEdgeLabel ?? 'Edge'}
              placeholder="Edge"
              autoComplete="off"
              onChange={(e) => set({ breakdownEdgeLabel: e.target.value })}
            />
            <p className="field-help">e.g. "Edge" or "Caps at" — shown highlighted in the tier color.</p>
          </div>

          <div className="field">
            <label htmlFor="breakdown-edge-text">Third section text</label>
            <textarea
              id="breakdown-edge-text"
              rows={3}
              maxLength={240}
              value={state.breakdownEdgeText ?? ''}
              placeholder="The key nuance…"
              autoComplete="off"
              onChange={(e) => set({ breakdownEdgeText: e.target.value })}
            />
          </div>

          <BackgroundField
            value={state.breakdownBackgroundImage}
            field="breakdownBackgroundImage"
            opacity={state.backgroundOpacity}
            set={set}
            onUploadImage={onUploadImage}
            help="No background image selected."
          />

          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>
        </div>
      ) : isMap ? (
        <div key="map-fields">
          <div className="field">
            <label>Theme</label>
            <div className="toggle">
              <button
                className={'seg' + (!state.mapPathway ? ' sel' : '')}
                onClick={() => set({ mapPathway: null })}
              >
                Neutral
              </button>
              <button
                className={'seg' + (state.mapPathway ? ' sel' : '')}
                onClick={() => set({ mapPathway: state.mapPathway || 'Fool' })}
              >
                Pathway
              </button>
            </div>
            <p className="field-help">A pathway tints the card and adds its background art.</p>
          </div>

          {state.mapPathway && (
            <div className="field">
              <label>Pathway (search all 22)</label>
              <PathwayCombo
                value={PATHWAYS[state.mapPathway] ? state.mapPathway : 'Fool'}
                onPick={(n) => set({ mapPathway: n })}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="map-title">Title</label>
            <input
              id="map-title"
              maxLength={100}
              value={state.mapTitle ?? ''}
              placeholder="e.g. Where the powers come from"
              autoComplete="off"
              onChange={(e) => set({ mapTitle: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="map-entries">Rows (one per line, up to 8)</label>
            <p className="field-help" id="map-entries-help">
              Format: "tags -&gt; value". The arrow is optional — without it, the whole line becomes the value.
            </p>
            <textarea
              className="tier-textarea"
              id="map-entries"
              rows={8}
              value={state.mapEntriesText ?? ''}
              placeholder={'Door · Change · King of Space-Time -> Door, Space, Seals, Alternate Worlds\nBizarreness · Spirit World -> Replication'}
              aria-describedby="map-entries-help"
              autoComplete="off"
              onChange={(e) => set({ mapEntriesText: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="map-footer-text">Footer tagline (optional)</label>
            <textarea
              id="map-footer-text"
              rows={2}
              maxLength={160}
              value={state.mapFooterText ?? ''}
              placeholder="e.g. Three roots. Seven powers."
              autoComplete="off"
              onChange={(e) => set({ mapFooterText: e.target.value })}
            />
          </div>

          <BackgroundField
            value={state.mapBackgroundImage}
            field="mapBackgroundImage"
            opacity={state.backgroundOpacity}
            set={set}
            onUploadImage={onUploadImage}
            help={state.mapPathway
              ? `Using the default ${state.mapPathway} background. Upload one to override it.`
              : 'No background image selected.'}
          />

          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>
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
      ) : isFullImageCover ? (
        <div key="full-cover-fields">
          <div className="field">
            <label htmlFor="full-cover-title">Title</label>
            <input
              id="full-cover-title"
              maxLength={100}
              value={state.fullCoverTitle ?? ''}
              placeholder="Enter the cover title…"
              autoComplete="off"
              onChange={(event) => set({ fullCoverTitle: event.target.value })}
            />
          </div>
          <p className="hint">
            Click or drop an image onto the card. It fills the body while the title stays in the footer.
          </p>
          <div className="actions">
            <button className="btn-dl" style={{ background: accent.c }} onClick={onDownload}>Download PNG</button>
          </div>
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
