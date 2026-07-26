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
import PathwayExplanationCard from './components/PathwayExplanationCard.jsx'
import BreakdownCard from './components/BreakdownCard.jsx'
import MapCard from './components/MapCard.jsx'
import Panel from './components/Panel.jsx'
import Filmstrip from './components/Filmstrip.jsx'
import SectionField from './components/SectionField.jsx'
import { PATHWAYS, PATH_NAMES, tierColor, powerTier, TIER_RANKS, PATHWAY_COLORS } from './data/pathways.js'
import { PATHWAY_ICONS } from './data/pathwayIcons.js'
import { PATHWAY_BACKGROUNDS } from './data/pathwayBackgrounds.js'
import { sameCardState, useCardSession } from './useCardSession.js'
import { slugify } from '../cards/schema'

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
  'Pathway Explanation': {
    pathwayExplanationTitle: 'Nueva explicacion',
    pathwayExplanationText: 'Nueva explicacion',
  },
  Breakdown: {
    breakdownTitle: 'Nuevo concepto',
    breakdownDoes: 'Que hace.',
    breakdownDoesNot: 'Que no hace.',
    breakdownEdgeText: 'El matiz clave.',
  },
  Map: {
    mapTitle: 'Nuevo mapa',
    mapEntriesText: 'Etiqueta -> Valor',
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
  pathwayExplanationPath: 'Fool',
  pathwayExplanationTitle: '',
  pathwayExplanationText: '',
  pathwayExplanationBackgroundImage: null,
  breakdownKicker: '',
  breakdownTitle: '',
  breakdownDoes: '',
  breakdownDoesNot: '',
  breakdownEdgeLabel: 'Edge',
  breakdownEdgeText: '',
  breakdownBackgroundImage: null,
  mapTitle: '',
  mapEntriesText: '',
  mapFooterText: '',
  mapBackgroundImage: null,
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
  const { cards, sections, ready, error: sessionError, saving } = session

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
      pathwayExplanationTitle: '',
      pathwayExplanationText: '',
      pathwayExplanationBackgroundImage: null,
      breakdownKicker: '',
      breakdownTitle: '',
      breakdownDoes: '',
      breakdownDoesNot: '',
      breakdownEdgeText: '',
      breakdownBackgroundImage: null,
      mapTitle: '',
      mapEntriesText: '',
      mapFooterText: '',
      mapBackgroundImage: null,
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
    a.download = `${fileSafe(labelFor(state))}.png`
    a.href = url
    a.click()
  }

  // Exporta las cartas indicadas. Sin argumentos, el lote entero; con una
  // seccion, solo la suya, y entonces el ZIP se agrupa en carpeta por seccion
  // igual que hace el export del MCP.
  const onDownloadZip = async (subset = null, zipName = 'lotm-cards') => {
    // Si llega el evento de un onClick en vez de una lista, se exporta todo.
    const chosen = Array.isArray(subset) ? subset : cards
    if (!chosen.length || busy) return
    setBusy(true)
    const previousState = state
    const previousEditingId = editingId
    try {
      const zip = new JSZip()
      const grouped = new Set(chosen.map((card) => card.part.id)).size > 1
      // Render every card fresh instead of trusting each item's auto-saved
      // thumbnail — that thumbnail is captured on a debounce while editing,
      // so switching cards quickly can leave it stale or mid-transition
      // (wrong background, clipped text). Loading each card into the live
      // editor and re-capturing guarantees the export matches its final state.
      for (let i = 0; i < chosen.length; i++) {
        const item = chosen[i]
        flushSync(() => {
          setState(item.state)
          setEditingId(item.id)
        })
        const data = await captureCard()
        const base64 = data.split(',')[1]
        const name = `${String(i + 1).padStart(2, '0')}_${fileSafe(labelFor(item.state))}.png`
        zip.file(grouped ? `${slugify(item.part.name)}/${name}` : name, base64, { base64: true })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${zipName}.zip`
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
  const isPathwayExplanation = state.type === 'Pathway Explanation'
  const isBreakdown = state.type === 'Breakdown'
  const isMap = state.type === 'Map'
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
  const mapPathway = PATHWAYS[state.mapPathway] ? state.mapPathway : null
  // Una imagen propia manda sobre el fondo que aporta el pathway.
  const mapBackgroundImage = state.mapBackgroundImage
    || (mapPathway ? PATHWAY_BACKGROUNDS[mapPathway] ?? null : null)
  const accent = isCover || isFullImageCover
    ? COVER_ACCENT
    : isTier || isTierExplanation
      ? { ...TIER_RANKS[tierRank], pct: 100 }
      : isPathwayCard
        ? { ...PATHWAY_COLORS[pathwayCardPath], pct: 100 }
      : isMap && mapPathway
        ? { ...PATHWAY_COLORS[mapPathway], pct: 100 }
      : isGeneralExplanation || isPathwayExplanation || isBreakdown || isMap
        ? COVER_ACCENT
      : powerTier(state.type, state.power, state.grade)
  const pathLabel = [...new Set(sequences.map((s) => s.path))].join(' · ')
  const explanationPath = PATHWAYS[state.explanationPath] ? state.explanationPath : null
  const explanationScope = isTierExplanation ? 'All pathways' : explanationPath ?? 'All pathways'
  const tierBackgroundImage = state.tierBackgroundImage || PATHWAY_BACKGROUNDS[tierPath] || null
  const pathwayCardBackgroundImage = state.pathwayCardBackgroundImage || PATHWAY_BACKGROUNDS[pathwayCardPath] || null
  const pathwayExplanationPath = PATHWAYS[state.pathwayExplanationPath] ? state.pathwayExplanationPath : 'Fool'
  // Como el resto de la familia, hereda el arte de su pathway y la imagen
  // propia solo lo sustituye.
  const pathwayExplanationBackground = state.pathwayExplanationBackgroundImage
    || PATHWAY_BACKGROUNDS[pathwayExplanationPath]
    || null

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

        <SectionField
          section={cards.find((card) => card.id === editingId)?.part ?? null}
          sections={sections}
          onMove={(target) => session.moveCards([editingId], target)}
        />

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
              pathway={explanationPath}
              icon={explanationPath ? PATHWAY_ICONS[explanationPath] : null}
              backgroundImage={explanationPath ? PATHWAY_BACKGROUNDS[explanationPath] ?? null : null}
            />
          ) : isPathwayExplanation ? (
            <PathwayExplanationCard
              ref={cardRef}
              pathway={pathwayExplanationPath}
              index={PATH_NAMES.indexOf(pathwayExplanationPath) + 1}
              total={PATH_NAMES.length}
              title={state.pathwayExplanationTitle ?? ''}
              description={state.pathwayExplanationText ?? ''}
              backgroundImage={pathwayExplanationBackground}
              tier={PATHWAY_COLORS[pathwayExplanationPath]}
            />
          ) : isBreakdown ? (
            <BreakdownCard
              ref={cardRef}
              kicker={state.breakdownKicker ?? ''}
              title={state.breakdownTitle ?? ''}
              does={state.breakdownDoes ?? ''}
              doesNot={state.breakdownDoesNot ?? ''}
              edgeLabel={state.breakdownEdgeLabel ?? 'Edge'}
              edgeText={state.breakdownEdgeText ?? ''}
              backgroundImage={state.breakdownBackgroundImage}
            />
          ) : isMap ? (
            <MapCard
              ref={cardRef}
              title={state.mapTitle ?? ''}
              entriesText={state.mapEntriesText ?? ''}
              footerText={state.mapFooterText ?? ''}
              pathway={mapPathway}
              tier={mapPathway ? PATHWAY_COLORS[mapPathway] : null}
              backgroundImage={mapBackgroundImage}
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
          onRenameSection={(partId, name) => session.renameSection(partId, { name })}
          onDownloadSection={(partId) => {
            const seccion = cards.filter((card) => card.part.id === partId)
            if (seccion.length) void onDownloadZip(seccion, slugify(seccion[0].part.name))
          }}
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

// labelFor puede traer caracteres que no valen en un nombre de archivo. Una
// barra ademas crea una carpeta dentro del ZIP: un titulo como "Part 2/3"
// acababa como carpeta "Part_2" con un "3.png" dentro.
function fileSafe(label) {
  return label.replace(/[/\\:*?"<>|]+/g, '-').replace(/\.+$/, '').trim() || 'carta'
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
  if (s.type === 'Pathway Explanation') {
    return `pathway_explanation_${s.pathwayExplanationPath || 'pathway'}`.replace(/\s+/g, '_')
  }
  if (s.type === 'Breakdown') {
    return `breakdown_${s.breakdownTitle || 'untitled'}`.replace(/\s+/g, '_')
  }
  if (s.type === 'Map') {
    return `map_${s.mapTitle || 'untitled'}`.replace(/\s+/g, '_')
  }
  return `${s.name || 'card'}_seq${s.seq}`
}
