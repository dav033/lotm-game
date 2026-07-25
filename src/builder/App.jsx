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
import { sameCardState, useCardSession } from './useCardSession.js'

const COVER_ACCENT = { c: '#d9b869', d: '#4a3a17', pct: 100 }

// Una carta se crea directamente en el servidor, asi que su contenido inicial
// tiene que pasar la validacion: los textos obligatorios de cada tipo llevan un
// marcador que el usuario sobrescribe.
const NEW_CARD_SEEDS = {
  Character: { name: 'Nueva carta' },
  Artifact: { name: 'Nuevo artefacto' },
  Cover: { coverTitle: 'Nueva portada', coverPartNum: '1' },
  'Full Image Cover': { fullCoverTitle: 'Nueva portada' },
  Tier: {},
  Pathway: {},
  'Tier Explanation': { tierExplanationText: 'Nueva explicacion' },
  'General Explanation': {
    generalExplanationTitle: 'Nueva explicacion',
    generalExplanationText: 'Nueva explicacion',
  },
}

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
  const session = useCardSession()
  const { cards, ready, error: sessionError, saving } = session

  const [editingId, setEditingId] = useState(null)
  const [state, setState] = useState(DEFAULT_STATE)
  const [busy, setBusy] = useState(false)

  const stateRef = useRef(state)
  const editingIdRef = useRef(editingId)
  stateRef.current = state
  editingIdRef.current = editingId

  // Toda edicion se aplica al instante en pantalla y viaja al servidor, que es
  // quien manda. No hay copia local que reconciliar despues.
  const set = (patch) => {
    const next = { ...stateRef.current, ...patch }
    stateRef.current = next
    setState(next)
    if (editingIdRef.current) session.updateCard(editingIdRef.current, next)
  }

  const onUploadImage = async (file, field = 'image') => {
    if (!file) return
    const url = await session.uploadImage(file)
    if (url) set({ [field]: url })
  }

  // Selecciona una carta existente cuando no hay ninguna activa, y sale del
  // estado fantasma si la que se estaba editando desaparecio del servidor.
  useEffect(() => {
    if (!ready) return
    if (editingId && cards.some((card) => card.id === editingId)) return
    const fallback = cards[0] ?? null
    setEditingId(fallback?.id ?? null)
    if (fallback) {
      stateRef.current = fallback.state
      setState(fallback.state)
    }
  }, [cards, editingId, ready])

  // Adopta lo que llegue del servidor para la carta activa (una edicion del MCP,
  // por ejemplo). Mientras haya una escritura propia sin confirmar se respeta lo
  // que se esta escribiendo.
  useEffect(() => {
    if (!editingId || session.isPending(editingId)) return
    const active = cards.find((card) => card.id === editingId)
    if (!active || sameCardState(active.state, stateRef.current)) return
    stateRef.current = active.state
    setState(active.state)
  }, [cards, editingId, session])

  const captureCard = async () => {
    await waitForCardAssets(cardRef.current)
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    })
    return canvas.toDataURL('image/png')
  }

  // ---- Card operations ----

  // New card: keep the pathway/power setup you're working with, but clear the
  // identity (name + image) so batching variants is fast. Then select it.
  const onNewCard = async () => {
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
      ...(NEW_CARD_SEEDS[state.type] ?? {}),
    }
    const id = await session.createCard(fresh)
    if (!id) return
    setEditingId(id)
    stateRef.current = fresh
    setState(fresh)
  }

  const onLoadCard = (id) => {
    const item = cards.find((x) => x.id === id)
    if (!item) return
    setEditingId(id)
    stateRef.current = item.state
    setState(item.state)
  }

  const editingIndex = cards.findIndex((x) => x.id === editingId)

  const onStep = (dir) => {
    if (!cards.length) return
    let i = editingIndex === -1 ? (dir > 0 ? 0 : cards.length - 1) : editingIndex + dir
    i = Math.max(0, Math.min(cards.length - 1, i))
    onLoadCard(cards[i].id)
  }

  const onRemoveFromBatch = (id) => {
    // El efecto de seleccion elige la siguiente carta cuando desaparece la activa.
    void session.deleteCard(id)
  }

  // Drag-to-reorder a thumbnail from one slot to another.
  const onReorder = (from, to) => {
    if (from === to) return
    void session.reorder(from, to)
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
      const urls = (await Promise.all(images.map((file) => session.uploadImage(file)))).filter(Boolean)
      if (!urls.length) return
      // First image fills the current card; the rest become new cards.
      set({ image: urls[0] })
      for (const image of urls.slice(1)) {
        await session.createCard({ ...stateRef.current, image })
      }
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
    if (!cards.length || busy) return
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
      for (let i = 0; i < cards.length; i++) {
        const item = cards[i]
        flushSync(() => {
          setState(item.state)
          setEditingId(item.id)
        })
        const data = await captureCard()
        const base64 = data.split(',')[1]
        zip.file(`${String(i + 1).padStart(2, '0')}_${labelFor(item.state)}.png`, base64, { base64: true })
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
  const onGenerateTierBatch = async () => {
    if (busy) return
    setBusy(true)
    try {
      let first = null
      for (const path of PATH_NAMES) {
        const cardState = { ...state, type: 'Tier', tierPath: path, tierText: '' }
        const id = await session.createCard(cardState)
        if (id && !first) first = { id, state: cardState }
      }
      if (first) {
        setEditingId(first.id)
        stateRef.current = first.state
        setState(first.state)
      }
    } finally {
      setBusy(false)
    }
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

  if (!ready) {
    return <div className="app-loading">Loading your cards…</div>
  }

  // La carta activa se pinta con el estado vivo del editor, no con la copia de
  // la sesion, para que la miniatura siga lo que se escribe sin esperar al guardado.
  const filmstrip = cards.map((card) => {
    const cardState = card.id === editingId ? state : card.state
    return {
      id: card.id,
      label: labelFor(cardState),
      state: cardState,
      universe: card.universe,
      part: card.part,
    }
  })

  return (
    <div className="app">
      <section className="stage">
        <div className="stage-top">
          <div className="stage-nav">
            <button className="nav" onClick={() => onStep(-1)} aria-label="Previous">‹</button>
            <span className="pos">
              {editingIndex >= 0 ? editingIndex + 1 : '–'} / {cards.length}
            </span>
            <button className="nav" onClick={() => onStep(1)} aria-label="Next">›</button>
          </div>
          {/* Un guardado rechazado por el servidor tiene que verse: antes fallaba
              en silencio y la edicion se perdia sin aviso. */}
          <span
            className={'save-status ' + (sessionError ? 'error' : saving ? 'saving' : 'saved')}
            title={sessionError ?? undefined}
          >
            {sessionError ?? (saving ? 'Saving…' : 'All changes saved')}
          </span>
        </div>

        <div className="stage-canvas">
          {/* Sin cartas no hay nada que editar: escribir aqui no guardaria en
              ningun sitio, asi que se dice que hay que crear una. */}
          {cards.length === 0 ? (
            <div className="stage-empty">
              <p>La biblioteca del servidor esta vacia.</p>
              <button className="btn-new-card" onClick={onNewCard}>Crear la primera carta</button>
            </div>
          ) : isCover ? (
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
          batch={filmstrip}
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
