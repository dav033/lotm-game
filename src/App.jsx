import { useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import Card from './components/Card.jsx'
import Panel from './components/Panel.jsx'
import { PATHWAYS, tierColor, powerTier } from './data/pathways.js'
import { PATHWAY_ICONS } from './data/pathwayIcons.js'

const STORAGE_KEY = 'lotm-cards-v1'

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
}

// Read the persisted batch + form state (if any) from localStorage.
const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupt or unavailable storage */ }
  return null
}

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve(ev.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function App() {
  const cardRef = useRef(null)
  const stored = loadStored()
  const [batch, setBatch] = useState(stored?.batch ?? [])
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [state, setState] = useState(stored?.state ?? DEFAULT_STATE)

  // Persist batch + form state so reloading the page keeps your work.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ batch, state }))
    } catch { /* quota exceeded — keep working in-memory */ }
  }, [batch, state])

  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  const onUploadImage = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set({ image: ev.target.result })
    reader.readAsDataURL(file)
  }

  const captureCard = async () => {
    if (document.fonts?.ready) {
      try { await document.fonts.ready } catch { /* ignore */ }
    }
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    })
    return canvas.toDataURL('image/png')
  }

  const cardLabel = () => `${state.name || 'card'}_seq${state.seq}`

  const onDownload = async () => {
    const url = await captureCard()
    const a = document.createElement('a')
    a.download = `${cardLabel()}.png`
    a.href = url
    a.click()
  }

  // Snapshot the current card (PNG + full form state) and add it as a new batch entry.
  const onAddToBatch = async () => {
    if (busy) return
    setBusy(true)
    try {
      const url = await captureCard()
      const id = crypto.randomUUID()
      setBatch((b) => [...b, { id, label: cardLabel(), url, state: { ...state } }])
      setEditingId(id)
    } finally {
      setBusy(false)
    }
  }

  // Update the card image and wait for React + the browser to paint it,
  // so the next html2canvas capture reflects the new image.
  const setImageAndPaint = (image) =>
    new Promise((resolve) => {
      set({ image })
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })

  // Drag-and-drop entry point. A single image just fills the current card;
  // multiple images generate one batch card per image (same fields, swapped art).
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
      const baseState = { ...state }
      const dataUrls = await Promise.all(images.map(readFileAsDataURL))
      const added = []
      for (const dataUrl of dataUrls) {
        await setImageAndPaint(dataUrl)
        const url = await captureCard()
        added.push({
          id: crypto.randomUUID(),
          label: cardLabel(),
          url,
          state: { ...baseState, image: dataUrl },
        })
      }
      setBatch((b) => [...b, ...added])
      setEditingId(added[added.length - 1].id)
    } finally {
      setBusy(false)
    }
  }

  // Overwrite the currently-selected batch entry with the live card.
  const onUpdateCard = async () => {
    if (busy || !editingId) return
    setBusy(true)
    try {
      const url = await captureCard()
      setBatch((b) =>
        b.map((x) => (x.id === editingId ? { ...x, label: cardLabel(), url, state: { ...state } } : x))
      )
    } finally {
      setBusy(false)
    }
  }

  // Load a saved card back into the editor.
  const onLoadCard = (id) => {
    const item = batch.find((x) => x.id === id)
    if (!item) return
    setState(item.state)
    setEditingId(id)
  }

  const editingIndex = batch.findIndex((x) => x.id === editingId)

  // Step to the previous/next saved card and load it.
  const onStep = (dir) => {
    if (!batch.length) return
    let i = editingIndex === -1 ? (dir > 0 ? 0 : batch.length - 1) : editingIndex + dir
    i = Math.max(0, Math.min(batch.length - 1, i))
    onLoadCard(batch[i].id)
  }

  const onNewCard = () => setEditingId(null)

  const onRemoveFromBatch = (id) => {
    setBatch((b) => b.filter((x) => x.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const onClearBatch = () => {
    setBatch([])
    setEditingId(null)
  }

  const onDownloadZip = async () => {
    if (!batch.length) return
    const zip = new JSZip()
    batch.forEach((item, i) => {
      const base64 = item.url.split(',')[1]
      zip.file(`${String(i + 1).padStart(2, '0')}_${item.label}.png`, base64, { base64: true })
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'lotm-cards.zip'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const isCharacter = state.type === 'Character'
  const base = isCharacter ? state.power : state.grade
  const powerValue = base + (state.mod.trim() ? ` (${state.mod.trim()})` : '')

  // One or two sequences. The number keeps its own per-sequence color.
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

  // Power level drives the card accent and the progress bar.
  const accent = powerTier(state.type, state.power, state.grade)
  const pathLabel = [...new Set(sequences.map((s) => s.path))].join(' · ')

  return (
    <>
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
      <Panel
        state={state}
        set={set}
        accent={accent}
        batch={batch}
        busy={busy}
        editingId={editingId}
        editingIndex={editingIndex}
        onUploadImage={onUploadImage}
        onDownload={onDownload}
        onAddToBatch={onAddToBatch}
        onUpdateCard={onUpdateCard}
        onLoadCard={onLoadCard}
        onStep={onStep}
        onNewCard={onNewCard}
        onRemoveFromBatch={onRemoveFromBatch}
        onClearBatch={onClearBatch}
        onDownloadZip={onDownloadZip}
      />
    </>
  )
}
