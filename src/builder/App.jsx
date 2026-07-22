'use client'

import { useRef, useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import Card from './components/Card.jsx'
import CoverCard from './components/CoverCard.jsx'
import FullImageCoverCard from './components/FullImageCoverCard.jsx'
import TierCard from './components/TierCard.jsx'
import PathwayCard from './components/PathwayCard.jsx'
import TierExplanationCard from './components/TierExplanationCard.jsx'
import GeneralExplanationCard from './components/GeneralExplanationCard.jsx'
import Panel from './components/Panel.jsx'
import Filmstrip from './components/Filmstrip.jsx'
import { PATHWAYS, PATH_NAMES, tierColor, powerTier, TIER_RANKS, PATHWAY_COLORS } from './data/pathways.js'
import { PATHWAY_ICONS } from './data/pathwayIcons.js'
import { PATHWAY_BACKGROUNDS } from './data/pathwayBackgrounds.js'
import { loadData, saveData } from './storage.js'

const COVER_ACCENT = { c: '#d9b869', d: '#4a3a17', pct: 100 }

const DEFAULT_STATE = {
  type: 'Character',
  name: 'Yhwach',
  path: 'Wheel of Fortune',
  seq: 0,
  hasSecond: false,
  path2: 'Fool',
  seq2: 9,
  power: 'King of Angels',
  grade: '0',
  mod: '',
  dom: 'None',
  image: null,
  coverImage1: null,
  coverImage2: null,
  coverTitle: 'Fate',
  coverPartNum: '1',
  fullCoverImage: null,
  fullCoverTitle: '',
  tierPath: 'Fool',
  tierSeq: null,
  tierRank: 'S',
  tierText: '',
  tierFooterText: '',
  tierBackgroundImage: null,
  pathwayCardPath: 'Fool',
  pathwayCardSeq: null,
  pathwayCardText: '',
  pathwayCardFooterText: '',
  pathwayCardBackgroundImage: null,
  explanationPath: null,
  tierExplanationText: '',
  tierExplanationBackgroundImage: null,
  generalExplanationTitle: '',
  generalExplanationText: '',
}

const normalizeState = (value) => ({ ...DEFAULT_STATE, ...(value ?? {}) })

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve(ev.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

// html2canvas snapshots whatever is currently painted, so a capture taken
// before this card's own images/fonts/layout have actually settled can
// silently include stale or mid-transition content (e.g. a still-loading
// background image, or text captured mid-reflow). Wait for everything the
// card depends on before handing it to html2canvas.
const waitForCardAssets = async (root) => {
  if (document.fonts?.ready) {
    try { await document.fonts.ready } catch { /* ignore */ }
  }
  if (root) {
    const images = [...root.querySelectorAll('img')]
    const backgroundUrls = [...root.querySelectorAll('[style*="background-image"]')]
      .map((el) => el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1])
      .filter(Boolean)
    await Promise.all([
      ...images.map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())),
      ...backgroundUrls.map((src) => new Promise((resolve) => {
        const preload = new Image()
        preload.onload = resolve
        preload.onerror = resolve
        preload.src = src
      })),
    ])
  }
  // Give layout/paint a couple of frames to settle after the assets above
  // and any just-applied state update finish.
  await nextFrame()
  await nextFrame()
}

export default function App() {
  const cardRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [batch, setBatch] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [state, setState] = useState(DEFAULT_STATE)
  const [busy, setBusy] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved') // 'saving' | 'saved'

  const thumbTimer = useRef(null)
  const persistTimer = useRef(null)

  // ---- Initial load from IndexedDB (with legacy localStorage migration) ----
  useEffect(() => {
    let alive = true
    loadData().then((data) => {
      if (!alive) return
      const restoredBatch = (data?.batch ?? []).map((card) => ({
        ...card,
        state: normalizeState(card.state),
      }))
      if (restoredBatch.length > 0) {
        const active =
          restoredBatch.find((c) => c.id === data?.editingId) ?? restoredBatch[0]
        setBatch(restoredBatch)
        setEditingId(active.id)
        setState(active.state)
      } else {
        // Fresh start: seed one card so there is always something to edit.
        const id = newId()
        const seedState = normalizeState(data?.state)
        setBatch([{ id, label: labelFor(seedState), url: null, state: seedState }])
        setEditingId(id)
        setState(seedState)
      }
      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  const onUploadImage = (file, field = 'image') => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set({ [field]: ev.target.result })
    reader.readAsDataURL(file)
  }

  const captureCard = async () => {
    await waitForCardAssets(cardRef.current)
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    })
    return canvas.toDataURL('image/png')
  }

  // ---- Keep the active card's stored state/label in sync immediately. This
  // is what onDownloadZip reads per card, so it must never lag behind the
  // live editor — switching cards faster than the thumbnail debounce below
  // used to leave stale state/label behind (wrong background, missing text). ----
  useEffect(() => {
    if (!loaded || !editingId) return
    setBatch((b) =>
      b.map((c) => (c.id === editingId ? { ...c, label: labelFor(state), state: { ...state } } : c))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, editingId, loaded])

  // ---- Debounced thumbnail refresh for the filmstrip preview only — this is
  // just a UI preview, so it's fine for it to lag; the real export always
  // re-captures each card fresh (see onDownloadZip / onDownload). ----
  useEffect(() => {
    if (!loaded || !editingId) return
    setSaveStatus('saving')
    clearTimeout(thumbTimer.current)
    thumbTimer.current = setTimeout(async () => {
      let url = null
      try { url = await captureCard() } catch { /* keep previous thumbnail */ }
      if (url) setBatch((b) => b.map((c) => (c.id === editingId ? { ...c, url } : c)))
      setSaveStatus('saved')
    }, 500)
    return () => clearTimeout(thumbTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, editingId, loaded])

  // ---- Persist the whole snapshot to IndexedDB (debounced). ----
  useEffect(() => {
    if (!loaded) return
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      saveData({ batch, state, editingId })
    }, 400)
    return () => clearTimeout(persistTimer.current)
  }, [batch, state, editingId, loaded])

  // ---- Card operations ----

  // New card: keep the pathway/power setup you're working with, but clear the
  // identity (name + image) so batching variants is fast. Then select it.
  const onNewCard = () => {
    const id = newId()
    const fresh = {
      ...state,
      name: '',
      image: null,
      coverImage1: null,
      coverImage2: null,
      fullCoverImage: null,
      tierText: '',
      tierFooterText: '',
      tierBackgroundImage: null,
      pathwayCardText: '',
      pathwayCardFooterText: '',
      pathwayCardBackgroundImage: null,
      tierExplanationText: '',
      tierExplanationBackgroundImage: null,
      generalExplanationTitle: '',
      generalExplanationText: '',
    }
    setBatch((b) => [...b, { id, label: labelFor(fresh), url: null, state: fresh }])
    setEditingId(id)
    setState(fresh)
  }

  const onLoadCard = (id) => {
    const item = batch.find((x) => x.id === id)
    if (!item) return
    setEditingId(id)
    setState(normalizeState(item.state))
  }

  const editingIndex = batch.findIndex((x) => x.id === editingId)

  const onStep = (dir) => {
    if (!batch.length) return
    let i = editingIndex === -1 ? (dir > 0 ? 0 : batch.length - 1) : editingIndex + dir
    i = Math.max(0, Math.min(batch.length - 1, i))
    onLoadCard(batch[i].id)
  }

  const onRemoveFromBatch = (id) => {
    setBatch((b) => {
      const next = b.filter((x) => x.id !== id)
      if (id === editingId) {
        if (next.length) {
          const fallback = next[Math.min(editingIndex, next.length - 1)]
          setEditingId(fallback.id)
          setState(fallback.state)
        } else {
          // Never leave the editor empty — seed a fresh card.
          const nid = newId()
          setEditingId(nid)
          setState(DEFAULT_STATE)
          return [{ id: nid, label: labelFor(DEFAULT_STATE), url: null, state: DEFAULT_STATE }]
        }
      }
      return next
    })
  }

  // Drag-to-reorder a thumbnail from one slot to another.
  const onReorder = (from, to) => {
    if (from === to) return
    setBatch((b) => {
      const next = [...b]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  // Drop several images at once -> one card per image (same fields, swapped art).
  const onDropImages = async (files) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    if (images.length === 1) {
      onUploadImage(images[0])
      return
    }
    if (busy) return
    setBusy(true)
    try {
      const dataUrls = await Promise.all(images.map(readFileAsDataURL))
      // First image fills the current card; the rest become new cards.
      set({ image: dataUrls[0] })
      const added = dataUrls.slice(1).map((image) => {
        const cardState = { ...state, image }
        return { id: newId(), label: labelFor(cardState), url: null, state: cardState }
      })
      if (added.length) setBatch((b) => [...b, ...added])
    } finally {
      setBusy(false)
    }
  }

  const onDownload = async () => {
    const url = await captureCard()
    const a = document.createElement('a')
    a.download = `${labelFor(state)}.png`
    a.href = url
    a.click()
  }

  const onDownloadZip = async () => {
    if (!batch.length || busy) return
    setBusy(true)
    const previousState = state
    const previousEditingId = editingId
    try {
      const zip = new JSZip()
      // Render every card fresh instead of trusting each item's auto-saved
      // thumbnail — that thumbnail is captured on a debounce while editing,
      // so switching cards quickly can leave it stale or mid-transition
      // (wrong background, clipped text). Loading each card into the live
      // editor and re-capturing guarantees the export matches its final state.
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i]
        flushSync(() => {
          setState(item.state)
          setEditingId(item.id)
        })
        const data = await captureCard()
        const base64 = data.split(',')[1]
        zip.file(`${String(i + 1).padStart(2, '0')}_${item.label}.png`, base64, { base64: true })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'lotm-cards.zip'
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      flushSync(() => {
        setState(previousState)
        setEditingId(previousEditingId)
      })
      setBusy(false)
    }
  }

  // One tier slide per pathway, in canon order, keeping the current rank as a
  // starting point — then jump to the first one so you can start judging.
  const onGenerateTierBatch = () => {
    const cards = PATH_NAMES.map((path) => {
      const cardState = { ...state, type: 'Tier', tierPath: path, tierText: '' }
      return { id: newId(), label: labelFor(cardState), url: null, state: cardState }
    })
    setBatch((b) => [...b, ...cards])
    setEditingId(cards[0].id)
    setState(cards[0].state)
  }

  // ---- Derived values for rendering ----
  const isCharacter = state.type === 'Character'
  const baseValue = isCharacter ? state.power : state.grade
  const powerValue = baseValue + (state.mod.trim() ? ` (${state.mod.trim()})` : '')

  const rawSequences = [
    { path: state.path, seq: state.seq },
    ...(state.hasSecond ? [{ path: state.path2, seq: state.seq2 }] : []),
  ]
  const sequences = rawSequences
    .filter((s) => PATHWAYS[s.path])
    .map((s) => ({
      ...s,
      rank: PATHWAYS[s.path][9 - s.seq],
      icon: PATHWAY_ICONS[s.path],
      tier: tierColor(s.seq),
    }))

  const isCover = state.type === 'Cover'
  const isFullImageCover = state.type === 'Full Image Cover'
  const isTier = state.type === 'Tier'
  const isPathwayCard = state.type === 'Pathway'
  const isTierExplanation = state.type === 'Tier Explanation'
  const isGeneralExplanation = state.type === 'General Explanation'
  // Older saved cards predate the tier fields — fall back to sane defaults.
  const tierPath = PATHWAYS[state.tierPath] ? state.tierPath : 'Fool'
  const tierSeq = Number.isInteger(state.tierSeq) && state.tierSeq >= 0 && state.tierSeq <= 9
    ? state.tierSeq
    : null
  const tierRank = TIER_RANKS[state.tierRank] ? state.tierRank : 'S'
  const pathwayCardPath = PATHWAYS[state.pathwayCardPath] ? state.pathwayCardPath : 'Fool'
  const pathwayCardSeq = Number.isInteger(state.pathwayCardSeq) && state.pathwayCardSeq >= 0 && state.pathwayCardSeq <= 9
    ? state.pathwayCardSeq
    : null
  const accent = isCover || isFullImageCover
    ? COVER_ACCENT
    : isTier || isTierExplanation
      ? { ...TIER_RANKS[tierRank], pct: 100 }
      : isPathwayCard
        ? { ...PATHWAY_COLORS[pathwayCardPath], pct: 100 }
      : isGeneralExplanation
        ? COVER_ACCENT
      : powerTier(state.type, state.power, state.grade)
  const pathLabel = [...new Set(sequences.map((s) => s.path))].join(' · ')
  const explanationPath = PATHWAYS[state.explanationPath] ? state.explanationPath : null
  const explanationScope = isTierExplanation ? 'All pathways' : explanationPath ?? 'All pathways'
  const tierBackgroundImage = state.tierBackgroundImage || PATHWAY_BACKGROUNDS[tierPath] || null
  const pathwayCardBackgroundImage = state.pathwayCardBackgroundImage || PATHWAY_BACKGROUNDS[pathwayCardPath] || null

  if (!loaded) {
    return <div className="app-loading">Loading your cards…</div>
  }

  return (
    <div className="app">
      <section className="stage">
        <div className="stage-top">
          <div className="stage-nav">
            <button className="nav" onClick={() => onStep(-1)} aria-label="Previous">‹</button>
            <span className="pos">
              {editingIndex >= 0 ? editingIndex + 1 : '–'} / {batch.length}
            </span>
            <button className="nav" onClick={() => onStep(1)} aria-label="Next">›</button>
          </div>
          <span className={'save-status ' + saveStatus}>
            {saveStatus === 'saving' ? 'Saving…' : 'All changes saved'}
          </span>
        </div>

        <div className="stage-canvas">
          {isCover ? (
            <CoverCard
              ref={cardRef}
              image1={state.coverImage1}
              image2={state.coverImage2}
              title={state.coverTitle}
              part={state.coverPartNum}
              onUploadImage={onUploadImage}
            />
          ) : isFullImageCover ? (
            <FullImageCoverCard
              ref={cardRef}
              image={state.fullCoverImage}
              title={state.fullCoverTitle}
              onUploadImage={onUploadImage}
            />
          ) : isTier ? (
            <TierCard
              ref={cardRef}
              path={tierPath}
              icon={PATHWAY_ICONS[tierPath]}
              sequence={tierSeq}
              sequenceName={tierSeq === null ? null : PATHWAYS[tierPath][9 - tierSeq]}
              rank={tierRank}
              tier={TIER_RANKS[tierRank]}
              text={state.tierText ?? ''}
              footerText={state.tierFooterText ?? ''}
              backgroundImage={tierBackgroundImage}
            />
          ) : isPathwayCard ? (
            <PathwayCard
              ref={cardRef}
              path={pathwayCardPath}
              icon={PATHWAY_ICONS[pathwayCardPath]}
              sequence={pathwayCardSeq}
              sequenceName={pathwayCardSeq === null ? null : PATHWAYS[pathwayCardPath][9 - pathwayCardSeq]}
              tier={PATHWAY_COLORS[pathwayCardPath]}
              text={state.pathwayCardText ?? ''}
              footerText={state.pathwayCardFooterText ?? ''}
              backgroundImage={pathwayCardBackgroundImage}
            />
          ) : isTierExplanation ? (
            <TierExplanationCard
              ref={cardRef}
              rank={tierRank}
              tier={TIER_RANKS[tierRank]}
              description={state.tierExplanationText ?? ''}
              backgroundImage={state.tierExplanationBackgroundImage}
              scope={explanationScope}
            />
          ) : isGeneralExplanation ? (
            <GeneralExplanationCard
              ref={cardRef}
              title={state.generalExplanationTitle ?? ''}
              description={state.generalExplanationText ?? ''}
              scope={explanationScope}
            />
          ) : (
            <Card
              ref={cardRef}
              name={state.name}
              image={state.image}
              accent={accent}
              sequences={sequences}
              pathLabel={pathLabel}
              dom={state.dom}
              powerLabel={isCharacter ? 'Power' : 'Grade'}
              powerValue={powerValue}
              onUploadImage={onUploadImage}
              onDropImages={onDropImages}
            />
          )}
        </div>

        <Filmstrip
          batch={batch}
          editingId={editingId}
          accent={accent}
          busy={busy}
          onLoadCard={onLoadCard}
          onNewCard={onNewCard}
          onRemoveFromBatch={onRemoveFromBatch}
          onReorder={onReorder}
          onDownloadZip={onDownloadZip}
        />
      </section>

      <Panel
        state={state}
        set={set}
        accent={accent}
        onUploadImage={onUploadImage}
        onDownload={onDownload}
        onGenerateTierBatch={onGenerateTierBatch}
      />
    </div>
  )
}

// Filename-friendly label for a card's current state.
function labelFor(s) {
  if (s.type === 'Cover') return `${s.coverTitle || 'cover'}_part${s.coverPartNum || ''}`.replace(/\s+/g, '_')
  if (s.type === 'Full Image Cover') return `full_cover_${s.fullCoverTitle || 'untitled'}`.replace(/\s+/g, '_')
  if (s.type === 'Tier') {
    return `tier_${s.tierRank || 'S'}_${s.tierPath || 'pathway'}${Number.isInteger(s.tierSeq) ? `_seq${s.tierSeq}` : ''}`.replace(/\s+/g, '_')
  }
  if (s.type === 'Pathway') {
    return `pathway_${s.pathwayCardPath || 'pathway'}${Number.isInteger(s.pathwayCardSeq) ? `_seq${s.pathwayCardSeq}` : ''}`.replace(/\s+/g, '_')
  }
  if (s.type === 'Tier Explanation') {
    return `tier_explanation_${s.tierRank || 'S'}${s.explanationPath ? `_${s.explanationPath}` : ''}`.replace(/\s+/g, '_')
  }
  if (s.type === 'General Explanation') {
    return `general_explanation_${s.generalExplanationTitle || 'untitled'}${s.explanationPath ? `_${s.explanationPath}` : ''}`.replace(/\s+/g, '_')
  }
  return `${s.name || 'card'}_seq${s.seq}`
}
