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
import TarotMemberCard from './components/TarotMemberCard.jsx'
import CorruptionFileCard from './components/CorruptionFileCard.jsx'
import Panel from './components/Panel.jsx'
import Filmstrip from './components/Filmstrip.jsx'
import ProjectTabs, { MAX_OPEN_PROJECTS } from './components/ProjectTabs.jsx'
import ImageTray from './components/ImageTray.jsx'
import SectionField from './components/SectionField.jsx'
import { PATHWAYS, PATH_NAMES, tierColor, powerTier, TIER_RANKS, PATHWAY_COLORS, tarotMemberTheme } from './data/pathways.js'
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
  'Tarot Member': {
    tarotMemberName: 'New member',
    tarotMemberTitle: 'The Unknown',
    tarotMemberDescription: 'What the Club sees.',
    tarotMemberDetailText: 'What is actually happening.',
  },
  'Corruption File': {
    corruptionIncident: 'New incident',
    corruptionExplanation: 'What happened.',
    corruptionReaction: 'What the fandom did with it.',
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
  generalExplanationBackgroundImage: null,
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
  mapPathway: null,
  tarotMemberVariant: 'Portrait',
  tarotMemberName: '',
  tarotMemberTitle: '',
  tarotMemberDescription: '',
  tarotMemberDetailLabel: 'Club function',
  tarotMemberDetailText: '',
  tarotMemberFooterText: '',
  tarotMemberPathway: null,
  tarotMemberAccentColor: null,
  tarotMemberImage: null,
  corruptionVariant: 'Warning',
  corruptionIncident: '',
  corruptionCaseLabel: 'Normal explanation',
  corruptionExplanation: '',
  corruptionReactionLabel: 'Fandom reaction',
  corruptionReaction: '',
  corruptionFooterText: '',
  corruptionLevel: 'Severe',
  corruptionAccentColor: '#d84a4a',
  corruptionImage: null,
  backgroundOpacity: 65,
}

// Tamaño real de toda carta y margen que se le deja al encajarla en la ventana.
const CARD_W = 480
const CARD_H = 640
const CARD_MARGIN = 16
const MIN_FIT = 0.25

// Los dos archivos que sale cada exportacion de video, en el orden en que se
// bajan. Los tamaños los pone el servidor: ver VIDEO_FORMATS en src/cards/video.
const VIDEO_FORMATS = ['card', 'shorts']

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
  const canvasRef = useRef(null)
  const session = useCardSession()
  const {
    cards: allCards, sections, projects, images: allImages,
    ready, error: sessionError, saving,
  } = session

  const [editingId, setEditingId] = useState(null)
  const [state, setState] = useState(DEFAULT_STATE)
  const [busy, setBusy] = useState(false)
  const [zipError, setZipError] = useState(null)
  const [videoError, setVideoError] = useState(null)
  // Segundos que dura cada carta o imagen en el MP4. Vive aqui porque lo
  // comparten el filmstrip y la bandeja de imagenes.
  const [seconds, setSeconds] = useState(4)
  const [openProjectIds, setOpenProjectIds] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)

  // Al cargar la sesion se abre el primer proyecto; y si el activo desaparece
  // (lo borro el MCP, por ejemplo) se cae al primero que quede.
  useEffect(() => {
    if (!projects.length) return
    setOpenProjectIds((previous) => {
      const alive = previous.filter((id) => projects.some((project) => project.id === id))
      return alive.length ? alive : [projects[0].id]
    })
    setActiveProjectId((previous) => (
      previous && projects.some((project) => project.id === previous) ? previous : projects[0].id
    ))
  }, [projects])

  // Todo lo que se ve en el editor pertenece al proyecto activo.
  const cards = allCards.filter((card) => card.universe.id === activeProjectId)
  const images = allImages.filter((image) => image.universeId === activeProjectId)

  const onOpenProject = (id) => {
    setOpenProjectIds((previous) => (
      previous.includes(id) || previous.length >= MAX_OPEN_PROJECTS ? previous : [...previous, id]
    ))
    setActiveProjectId(id)
    setEditingId(null)
  }

  // El siguiente estado se calcula fuera del updater: React puede invocarlo mas
  // de una vez (StrictMode lo hace en desarrollo) y tiene que ser puro.
  const onCloseProject = (id) => {
    const next = openProjectIds.filter((open) => open !== id)
    setOpenProjectIds(next)
    if (id === activeProjectId) {
      setActiveProjectId(next[0] ?? null)
      setEditingId(null)
    }
  }

  const onCreateProject = async (name) => {
    const project = await session.createProject(name)
    if (project) onOpenProject(project.id)
  }

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

  // La carta mide 480x640 fijos y el editor ocupa exactamente la ventana, asi
  // que en pantallas bajas no cabe: quedaba recortada tras una barra de scroll y
  // solo se veia su tercio superior. Se lleva a la escala que quepa, como el
  // zoom-to-fit de cualquier editor. Tambien hacia arriba: es lo que se esta
  // editando y con la tira al costado sobra alto para agrandarla. El PNG no se
  // entera, que sale de captureCard con --fit a 1.
  useEffect(() => {
    const stage = canvasRef.current
    if (!stage) return
    const fitToStage = () => {
      const { width, height } = stage.getBoundingClientRect()
      const scale = Math.min((width - CARD_MARGIN) / CARD_W, (height - CARD_MARGIN) / CARD_H)
      stage.style.setProperty('--fit', String(Math.max(MIN_FIT, scale)))
    }
    fitToStage()
    const observer = new ResizeObserver(fitToStage)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [ready])

  const captureCard = async () => {
    // El zoom-to-fit es solo de pantalla: el PNG sigue saliendo a 960x1280, asi
    // que se captura con la carta a su tamaño real.
    const stage = canvasRef.current
    const fit = stage?.style.getPropertyValue('--fit')
    stage?.style.setProperty('--fit', '1')
    try {
      await waitForCardAssets(cardRef.current)
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      })
      return canvas.toDataURL('image/png')
    } finally {
      if (fit) stage.style.setProperty('--fit', fit)
    }
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
      generalExplanationBackgroundImage: null,
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
      corruptionIncident: '',
      corruptionExplanation: '',
      corruptionReaction: '',
      corruptionFooterText: '',
      corruptionImage: null,
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
  const onReorder = (fromId, toId) => {
    if (fromId === toId) return
    void session.reorder(fromId, toId)
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
    setZipError(null)
    const universeSlugs = [...new Set(chosen.map((card) => card.universe.slug))]
    if (universeSlugs.length === 1) {
      const partSlugs = [...new Set(chosen.map((card) => card.part.slug))]
      const params = new URLSearchParams({ universe: universeSlugs[0], filename: zipName })
      if (partSlugs.length === 1) params.set('part', partSlugs[0])
      const a = document.createElement('a')
      a.href = `/api/cards/export?${params}`
      a.download = `${zipName}.zip`
      setBusy(false)
      a.click()
      return
    }
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
      setTimeout(() => URL.revokeObjectURL(a.href), 1_000)
    } catch (error) {
      setZipError(error?.message ?? 'No se pudo generar el ZIP.')
    } finally {
      flushSync(() => {
        setState(previousState)
        setEditingId(previousEditingId)
      })
      setBusy(false)
    }
  }

  // Encadena una seccion en un MP4, cada carta en pantalla los segundos
  // pedidos. Las cartas se capturan aqui igual que en el ZIP —cargandolas una a
  // una en el editor— y el servidor solo las une con ffmpeg, asi que el video
  // muestra exactamente lo mismo que el ZIP.
  const onDownloadSectionVideo = async (partId, secondsPerCard) => {
    const chosen = cards.filter((card) => card.part.id === partId)
    if (!chosen.length || busy) return
    setBusy(true)
    setVideoError(null)
    const previousState = state
    const previousEditingId = editingId
    try {
      const form = new FormData()
      form.append('secondsPerCard', String(secondsPerCard))
      form.append('name', slugify(chosen[0].part.name))
      for (const item of chosen) {
        flushSync(() => {
          setState(item.state)
          setEditingId(item.id)
        })
        const data = await captureCard()
        form.append('frames', await (await fetch(data)).blob(), `${item.id}.png`)
        // Vacio = esta carta no tiene excepcion y usa la duracion global.
        form.append('durations', item.durationSeconds ?? '')
      }

      await sendVideo(form)
    } catch {
      setVideoError('Sin conexion con el servidor.')
    } finally {
      flushSync(() => {
        setState(previousState)
        setEditingId(previousEditingId)
      })
      setBusy(false)
    }
  }

  // Mismo MP4, pero a partir de las imagenes importadas. Se pasan a PNG en el
  // navegador porque el servidor lee el tamaño de la cabecera IHDR y las
  // importadas pueden venir en JPG, WebP o cualquier otro formato.
  const onExportImagesVideo = async () => {
    if (!images.length || busy) return
    setBusy(true)
    setVideoError(null)
    try {
      const project = projects.find((item) => item.id === activeProjectId)
      const form = new FormData()
      form.append('secondsPerCard', String(seconds))
      form.append('name', `${slugify(project?.name ?? 'proyecto')}-imagenes`)
      for (const image of images) {
        form.append('frames', await imageToPng(image.url), `${image.id}.png`)
        form.append('durations', image.durationSeconds ?? '')
      }
      await sendVideo(form)
    } catch (error) {
      setVideoError(error?.message ?? 'Sin conexion con el servidor.')
    } finally {
      setBusy(false)
    }
  }

  // Cada exportacion baja dos archivos: el de la carta tal cual (3:4) y el
  // vertical 9:16 para Shorts, TikTok y Reels. Se reaprovecha el mismo FormData
  // en las dos peticiones porque los fotogramas ya estan capturados: lo unico
  // que se repite es la subida, no el renderizado de las cartas, que es lo caro.
  // El navegador pide permiso una vez para bajar varios archivos de un sitio.
  const sendVideo = async (form) => {
    for (const format of VIDEO_FORMATS) {
      form.set('format', format)
      const response = await fetch('/api/cards/video', { method: 'POST', body: form })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setVideoError(body?.error ?? `No se pudo generar el video (HTTP ${response.status}).`)
        return
      }
      const blob = await response.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filenameFromResponse(response) ?? `cartas-${format}.mp4`
      a.click()
      URL.revokeObjectURL(a.href)
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
  const isTarotMember = state.type === 'Tarot Member'
  const isCorruptionFile = state.type === 'Corruption File'
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
      : isTarotMember
        ? { ...tarotMemberTheme(state.tarotMemberPathway, state.tarotMemberAccentColor), pct: 100 }
      : isCorruptionFile
        ? { c: state.corruptionAccentColor || '#d84a4a', d: '#351317', pct: 100 }
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
  // Igual, salvo que aqui el pathway es opcional: sin el no hay arte heredado,
  // pero una imagen propia se pinta lo mismo.
  const generalExplanationBackground = state.generalExplanationBackgroundImage
    || (explanationPath ? PATHWAY_BACKGROUNDS[explanationPath] ?? null : null)

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
      durationSeconds: card.durationSeconds ?? null,
    }
  })
  // Lo que resume el muelle plegado, para saber que hay ahi debajo sin abrirlo.
  const sectionCount = new Set(cards.map((card) => card.part.id)).size

  return (
    <div className="app">
      <section className="stage">
        <ProjectTabs
          projects={projects}
          openIds={openProjectIds}
          activeId={activeProjectId}
          busy={busy}
          onActivate={setActiveProjectId}
          onOpen={onOpenProject}
          onClose={onCloseProject}
          onCreate={onCreateProject}
        />
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

        {/* Solo las secciones de este proyecto: elegir una de otro se llevaria la
            carta fuera del editor abierto, y desde un campo que se llama
            "Sección" nadie espera cambiar de proyecto. */}
        <SectionField
          section={cards.find((card) => card.id === editingId)?.part ?? null}
          sections={sections.filter((section) => section.universe.id === activeProjectId)}
          onMove={(target) => session.moveCards([editingId], target)}
        />

        <div className="stage-canvas" ref={canvasRef}>
          {/* Pasar de carta sin subir hasta la barra de arriba: el hueco que
              queda a los lados del lienzo no servia para nada. Se colocan
              respecto al borde de la carta, que cambia de ancho con --fit. */}
          {cards.length > 1 && (
            <>
              <button
                className="stage-arrow prev"
                disabled={editingIndex <= 0}
                aria-label="Carta anterior"
                title="Carta anterior"
                onClick={() => onStep(-1)}
              >‹</button>
              <button
                className="stage-arrow next"
                disabled={editingIndex < 0 || editingIndex >= cards.length - 1}
                aria-label="Carta siguiente"
                title="Carta siguiente"
                onClick={() => onStep(1)}
              >›</button>
            </>
          )}
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
              backgroundOpacity={state.backgroundOpacity}
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
              backgroundOpacity={state.backgroundOpacity}
            />
          ) : isTierExplanation ? (
            <TierExplanationCard
              ref={cardRef}
              rank={tierRank}
              tier={TIER_RANKS[tierRank]}
              description={state.tierExplanationText ?? ''}
              backgroundImage={state.tierExplanationBackgroundImage}
              backgroundOpacity={state.backgroundOpacity}
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
              backgroundImage={generalExplanationBackground}
              backgroundOpacity={state.backgroundOpacity}
              onDropBackground={(file) => onUploadImage(file, 'generalExplanationBackgroundImage')}
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
              backgroundOpacity={state.backgroundOpacity}
              tier={PATHWAY_COLORS[pathwayExplanationPath]}
              onDropBackground={(file) => onUploadImage(file, 'pathwayExplanationBackgroundImage')}
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
              backgroundOpacity={state.backgroundOpacity}
              onDropBackground={(file) => onUploadImage(file, 'breakdownBackgroundImage')}
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
              backgroundOpacity={state.backgroundOpacity}
              onDropBackground={(file) => onUploadImage(file, 'mapBackgroundImage')}
            />
          ) : isTarotMember ? (
            <TarotMemberCard
              ref={cardRef}
              variant={state.tarotMemberVariant}
              name={state.tarotMemberName}
              tarotTitle={state.tarotMemberTitle}
              description={state.tarotMemberDescription}
              detailLabel={state.tarotMemberDetailLabel}
              detailText={state.tarotMemberDetailText}
              footerText={state.tarotMemberFooterText}
              image={state.tarotMemberImage || (state.tarotMemberPathway ? PATHWAY_BACKGROUNDS[state.tarotMemberPathway] ?? null : null)}
              backgroundOpacity={state.backgroundOpacity}
              tier={tarotMemberTheme(state.tarotMemberPathway, state.tarotMemberAccentColor)}
              onDropBackground={(file) => onUploadImage(file, 'tarotMemberImage')}
            />
          ) : isCorruptionFile ? (
            <CorruptionFileCard
              ref={cardRef}
              variant={state.corruptionVariant}
              incident={state.corruptionIncident}
              caseLabel={state.corruptionCaseLabel}
              explanation={state.corruptionExplanation}
              reactionLabel={state.corruptionReactionLabel}
              reaction={state.corruptionReaction}
              footerText={state.corruptionFooterText}
              corruptionLevel={state.corruptionLevel}
              accentColor={state.corruptionAccentColor}
              image={state.corruptionImage}
              backgroundOpacity={state.backgroundOpacity}
              onDropBackground={(file) => onUploadImage(file, 'corruptionImage')}
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

        {/* La tira y la bandeja viven plegadas al pie y se abren al pasar por
            encima. Se despliegan sobre el lienzo, no lo empujan: ver .stage-dock
            en styles.css. */}
        <div className="stage-dock">
          <div className="stage-dock-panel">
            <div className="stage-dock-handle">
              {filmstrip.length} cartas · {sectionCount} {sectionCount === 1 ? 'sección' : 'secciones'}
              {images.length ? ` · ${images.length} imágenes` : ''}
            </div>

            <div className="stage-dock-body">
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
              onDownloadSectionVideo={onDownloadSectionVideo}
              zipError={zipError}
              videoError={videoError}
              seconds={seconds}
              onSeconds={setSeconds}
              onCardDuration={(id, value) => session.setDuration('card', id, value)}
            />

            <ImageTray
              images={images}
              busy={busy}
              seconds={seconds}
              onImport={(files) => session.importImages(activeProjectId, files)}
              onDelete={session.deleteImage}
              onReorder={(imageIds) => session.reorderImages(activeProjectId, imageIds)}
              onExportVideo={onExportImagesVideo}
              onImageDuration={(id, value) => session.setDuration('image', id, value)}
            />
            </div>
          </div>
        </div>
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

// Limite del lado mayor de una imagen importada al pasarla a fotograma. Sin
// tope, una foto de movil genera un PNG de decenas de MB por fotograma.
const MAX_FRAME_SIDE = 1920

// Pasa una imagen importada a PNG. El servidor deduce el tamaño de la cabecera
// IHDR, asi que un JPG o un WebP no le sirven tal cual.
function imageToPng(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error(`No se pudo convertir ${url}.`))),
        'image/png',
      )
    }
    image.onerror = () => reject(new Error(`No se pudo cargar ${url}.`))
    image.src = url
  })
}

// El servidor ya nombra el archivo segun la seccion; se reutiliza ese nombre
// en vez de recomponerlo en el cliente.
function filenameFromResponse(response) {
  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')
  return match?.[1] ?? null
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
  if (s.type === 'Tarot Member') {
    return `tarot_member_${s.tarotMemberTitle || 'arcana'}_${s.tarotMemberName || 'member'}`.replace(/\s+/g, '_')
  }
  if (s.type === 'Corruption File') return `corruption_file_${s.corruptionIncident || 'incident'}`.replace(/\s+/g, '_')
  return `${s.name || 'card'}_seq${s.seq}`
}
