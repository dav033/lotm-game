import { useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import Card from './components/Card.jsx'
import Panel from './components/Panel.jsx'
import Filmstrip from './components/Filmstrip.jsx'
import { PATHWAYS, tierColor, powerTier } from './data/pathways.js'
import { PATHWAY_ICONS } from './data/pathwayIcons.js'
import { loadData, saveData } from './storage.js'

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

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve(ev.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

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
      const restoredBatch = data?.batch ?? []
      if (restoredBatch.length > 0) {
        const active =
          restoredBatch.find((c) => c.id === data?.editingId) ?? restoredBatch[0]
        setBatch(restoredBatch)
        setEditingId(active.id)
        setState(active.state ?? DEFAULT_STATE)
      } else {
        // Fresh start: seed one card so there is always something to edit.
        const id = newId()
        const seedState = data?.state ?? DEFAULT_STATE
        setBatch([{ id, label: labelFor(seedState), url: null, state: seedState }])
        setEditingId(id)
        setState(seedState)
      }
      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

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

  // ---- Auto-save: mirror the live form into the active card + refresh its
  // thumbnail, debounced so html2canvas doesn't run on every keystroke. ----
  useEffect(() => {
    if (!loaded || !editingId) return
    setSaveStatus('saving')
    clearTimeout(thumbTimer.current)
    thumbTimer.current = setTimeout(async () => {
      let url = null
      try { url = await captureCard() } catch { /* keep previous thumbnail */ }
      setBatch((b) =>
        b.map((c) =>
          c.id === editingId
            ? { ...c, label: labelFor(state), state: { ...state }, ...(url ? { url } : {}) }
            : c
        )
      )
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
    const fresh = { ...state, name: '', image: null }
    setBatch((b) => [...b, { id, label: labelFor(fresh), url: null, state: fresh }])
    setEditingId(id)
    setState(fresh)
  }

  const onLoadCard = (id) => {
    const item = batch.find((x) => x.id === id)
    if (!item) return
    setEditingId(id)
    setState(item.state)
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
    if (!batch.length) return
    const zip = new JSZip()
    // Make sure every card has an up-to-date thumbnail before zipping.
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]
      const data = item.url ?? (item.id === editingId ? await captureCard() : null)
      if (!data) continue
      const base64 = data.split(',')[1]
      zip.file(`${String(i + 1).padStart(2, '0')}_${item.label}.png`, base64, { base64: true })
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'lotm-cards.zip'
    a.click()
    URL.revokeObjectURL(a.href)
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

  const accent = powerTier(state.type, state.power, state.grade)
  const pathLabel = [...new Set(sequences.map((s) => s.path))].join(' · ')

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
      />
    </div>
  )
}

// Filename-friendly label for a card's current state.
function labelFor(s) {
  return `${s.name || 'card'}_seq${s.seq}`
}
