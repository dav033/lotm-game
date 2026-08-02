'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fromBuilderCardState, toBuilderCardState } from '../cards/schema'
import { clearData, loadData, saveData } from './storage.js'

// La biblioteca del servidor es la unica fuente de verdad. Este hook mantiene
// un espejo local de esa sesion: cada edicion se aplica al instante en pantalla
// y se envia al servidor, y todo lo que llegue del servidor se adopta salvo en
// las cartas que aun tienen una escritura sin confirmar.
const SESSION_URL = '/api/cards/session'
const REVISION_URL = '/api/cards/revision'
const SAVE_DEBOUNCE_MS = 400
const POLL_MS = 1_000
const OFFLINE_MESSAGE = 'Sin conexion con el servidor.'

const IMAGE_FIELDS = [
  'image',
  'coverImage1',
  'coverImage2',
  'fullCoverImage',
  'tierBackgroundImage',
  'pathwayCardBackgroundImage',
  'tierExplanationBackgroundImage',
  'ritualBackgroundImage',
]

const toSessionCard = (card) => ({
  id: card.id,
  title: card.title,
  position: card.position,
  universe: card.universe,
  part: card.part,
  updatedAt: card.updatedAt,
  durationSeconds: card.durationSeconds ?? null,
  state: toBuilderCardState(card.content),
})

export const sameCardState = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function readError(response, fallback) {
  const body = await response.json().catch(() => null)
  return body?.error ?? `${fallback} (HTTP ${response.status}).`
}

export function useCardSession() {
  const [cards, setCards] = useState([])
  const [projects, setProjects] = useState([])
  const [images, setImages] = useState([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [savingIds, setSavingIds] = useState([])

  const pending = useRef(new Set())
  const timers = useRef(new Map())
  const editSeq = useRef(new Map())
  const pullRequest = useRef(0)
  const revisionRef = useRef(null)
  const cardsRef = useRef([])
  cardsRef.current = cards

  const publishPending = useCallback(() => setSavingIds([...pending.current]), [])

  const markPending = useCallback((id) => {
    pending.current.add(id)
    publishPending()
  }, [publishPending])

  const clearPending = useCallback((id) => {
    if (!pending.current.delete(id)) return
    publishPending()
  }, [publishPending])

  const pull = useCallback(async () => {
    const requestId = ++pullRequest.current
    try {
      const response = await fetch(SESSION_URL, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const session = await response.json()
      // Una respuesta que llega tarde no puede pisar a una mas reciente.
      if (requestId !== pullRequest.current) return
      revisionRef.current = session.revision
      setProjects(session.projects ?? [])
      setImages(session.images ?? [])
      setCards((previous) => {
        const local = new Map(previous.map((card) => [card.id, card]))
        return session.cards.map((card) => {
          const mine = local.get(card.id)
          return mine && pending.current.has(card.id) ? mine : toSessionCard(card)
        })
      })
      setReady(true)
      setError((current) => (current === OFFLINE_MESSAGE ? null : current))
    } catch {
      if (requestId === pullRequest.current) setError(OFFLINE_MESSAGE)
    }
  }, [])

  const flush = useCallback(async (id, state, seq) => {
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card: fromBuilderCardState(state) }),
      })
      if (!response.ok) {
        // Sigue pendiente a proposito: mientras el contenido no sea valido no
        // dejamos que la version del servidor pise lo que se esta escribiendo.
        setError(await readError(response, 'No se pudo guardar la carta'))
        return
      }
      setError(null)
      if (editSeq.current.get(id) === seq) clearPending(id)
    } catch {
      setError(OFFLINE_MESSAGE)
    }
  }, [clearPending])

  const updateCard = useCallback((id, state) => {
    setCards((previous) => previous.map((card) => (card.id === id ? { ...card, state } : card)))
    markPending(id)
    const seq = (editSeq.current.get(id) ?? 0) + 1
    editSeq.current.set(id, seq)
    clearTimeout(timers.current.get(id))
    timers.current.set(id, setTimeout(() => void flush(id, state, seq), SAVE_DEBOUNCE_MS))
  }, [flush, markPending])

  const createCard = useCallback(async (state) => {
    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card: fromBuilderCardState(state) }),
      })
      if (!response.ok) {
        setError(await readError(response, 'No se pudo crear la carta'))
        return null
      }
      const { card } = await response.json()
      setError(null)
      setCards((previous) => [...previous, toSessionCard(card)])
      return card.id
    } catch {
      setError(OFFLINE_MESSAGE)
      return null
    }
  }, [])

  const deleteCard = useCallback(async (id) => {
    clearTimeout(timers.current.get(id))
    clearPending(id)
    setCards((previous) => previous.filter((card) => card.id !== id))
    try {
      const response = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) {
        setError(await readError(response, 'No se pudo borrar la carta'))
        void pull()
      }
    } catch {
      setError(OFFLINE_MESSAGE)
      void pull()
    }
  }, [clearPending, pull])

  // Soltar una carta sobre otra la lleva a esa posicion. Si la de destino es de
  // otra seccion, la carta cambia de seccion en el mismo gesto.
  // Va por id y no por indice: el editor solo muestra las cartas del proyecto
  // activo, asi que sus indices no son los de esta lista, que las tiene todas.
  const reorder = useCallback(async (fromId, toId) => {
    const list = cardsRef.current
    const from = list.findIndex((card) => card.id === fromId)
    const to = list.findIndex((card) => card.id === toId)
    const moved = list[from]
    const target = list[to]
    if (!moved || !target) return

    // La carta adopta la seccion de destino ya en el optimista: si no, el
    // filmstrip la agrupa aparte y parte el grupo en dos hasta el siguiente pull.
    const samePart = moved.part.id === target.part.id
    const next = [...list]
    next.splice(from, 1)
    next.splice(to, 0, samePart ? moved : { ...moved, part: target.part })
    setCards(next)
    const cardIds = next.filter((card) => card.part.id === target.part.id).map((card) => card.id)

    // Mover acepta la seccion de destino entera en el orden que debe quedar, asi
    // que un solo POST cambia de seccion y coloca en su sitio a la vez. El numero
    // se omite a proposito: mandarlo renumeraria la seccion de destino.
    // ponytail: /api/cards/move corta en 100 cartas por llamada; una seccion mas
    // larga que eso necesitaria trocear el envio.
    const { url, body, fallback } = samePart
      ? { url: '/api/cards/reorder', body: { partId: target.part.id, cardIds }, fallback: 'No se pudo reordenar' }
      : { url: '/api/cards/move', body: { cardIds, part: { name: target.part.name } }, fallback: 'No se pudo mover la carta' }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) setError(await readError(response, fallback))
      void pull()
    } catch {
      setError(OFFLINE_MESSAGE)
      void pull()
    }
  }, [pull])

  // Mueve cartas a una seccion, creandola si el nombre es nuevo. Sin universo
  // explicito se quedan en el suyo; con el, cambian tambien de universo.
  const moveCards = useCallback(async (cardIds, target) => {
    try {
      const response = await fetch('/api/cards/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds, ...target }),
      })
      if (!response.ok) {
        setError(await readError(response, 'No se pudieron mover las cartas'))
        return false
      }
      setError(null)
      await pull()
      return true
    } catch {
      setError(OFFLINE_MESSAGE)
      return false
    }
  }, [pull])

  const renameSection = useCallback(async (partId, patch) => {
    try {
      const response = await fetch(`/api/cards/sections/${partId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) {
        setError(await readError(response, 'No se pudo renombrar la seccion'))
        return false
      }
      setError(null)
      await pull()
      return true
    } catch {
      setError(OFFLINE_MESSAGE)
      return false
    }
  }, [pull])

  // Duracion propia de una carta o imagen. `seconds: null` la devuelve a la
  // global. Se aplica ya en pantalla y se confirma contra el servidor.
  const setDuration = useCallback(async (kind, id, seconds) => {
    const apply = (list) => list.map((item) => (
      item.id === id ? { ...item, durationSeconds: seconds } : item
    ))
    if (kind === 'card') setCards(apply)
    else setImages(apply)
    try {
      const response = await fetch('/api/cards/duration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, seconds }),
      })
      if (!response.ok) {
        setError(await readError(response, 'No se pudo cambiar la duracion'))
        void pull()
        return false
      }
      setError(null)
      return true
    } catch {
      setError(OFFLINE_MESSAGE)
      void pull()
      return false
    }
  }, [pull])

  const createProject = useCallback(async (name) => {
    try {
      const response = await fetch('/api/cards/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        setError(await readError(response, 'No se pudo crear el proyecto'))
        return null
      }
      setError(null)
      const { project } = await response.json()
      await pull()
      return project
    } catch {
      setError(OFFLINE_MESSAGE)
      return null
    }
  }, [pull])

  // Importa imagenes tal cual en un proyecto. No se convierten en carta ni se
  // editan: solo se ordenan y se exportan.
  const importImages = useCallback(async (universeId, files) => {
    if (!files.length) return false
    const form = new FormData()
    form.append('universeId', universeId)
    for (const file of files) form.append('files', file)
    try {
      const response = await fetch('/api/cards/imported', { method: 'POST', body: form })
      if (!response.ok) {
        setError(await readError(response, 'No se pudieron importar las imagenes'))
        return false
      }
      setError(null)
      await pull()
      return true
    } catch {
      setError(OFFLINE_MESSAGE)
      return false
    }
  }, [pull])

  const deleteImage = useCallback(async (id) => {
    setImages((previous) => previous.filter((image) => image.id !== id))
    try {
      const response = await fetch(`/api/cards/imported/${id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) {
        setError(await readError(response, 'No se pudo borrar la imagen'))
        void pull()
      }
    } catch {
      setError(OFFLINE_MESSAGE)
      void pull()
    }
  }, [pull])

  const reorderImages = useCallback(async (universeId, imageIds) => {
    try {
      const response = await fetch('/api/cards/imported', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universeId, imageIds }),
      })
      if (!response.ok) {
        setError(await readError(response, 'No se pudieron reordenar las imagenes'))
        void pull()
        return false
      }
      setError(null)
      await pull()
      return true
    } catch {
      setError(OFFLINE_MESSAGE)
      return false
    }
  }, [pull])

  const uploadImage = useCallback(async (file) => {
    const form = new FormData()
    form.append('file', file)
    try {
      const response = await fetch('/api/cards/images', { method: 'POST', body: form })
      if (!response.ok) {
        setError(await readError(response, 'No se pudo subir la imagen'))
        return null
      }
      setError(null)
      return (await response.json()).url
    } catch {
      setError(OFFLINE_MESSAGE)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const timersAtMount = timers.current

    async function start() {
      const migration = await migrateOnce(uploadImage)
      if (cancelled) return
      if (migration?.failed) {
        setError(`No se pudieron subir ${migration.failed} carta(s) guardadas en este navegador; siguen aqui y se reintentan al recargar.`)
      }
      await pull()
    }
    void start()

    // Sondeo del navegador: pide solo la revision y recarga la sesion cuando
    // cambia, venga el cambio del MCP, de otra pestana o de este mismo editor.
    const poll = setInterval(async () => {
      if (cancelled || document.hidden) return
      try {
        const response = await fetch(REVISION_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const { revision } = await response.json()
        if (revision !== revisionRef.current) await pull()
        else setError((current) => (current === OFFLINE_MESSAGE ? null : current))
      } catch {
        if (!cancelled) setError(OFFLINE_MESSAGE)
      }
    }, POLL_MS)

    // Al volver a la pestana se comprueba enseguida, sin esperar al siguiente turno.
    const onVisible = () => { if (!document.hidden) void pull() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      for (const timer of timersAtMount.values()) clearTimeout(timer)
    }
  }, [pull, uploadImage])

  // Secciones que existen ahora mismo, en el orden en que se muestran.
  const sections = []
  for (const card of cards) {
    if (sections.some((section) => section.id === card.part.id)) continue
    sections.push({ id: card.part.id, ...card.part, universe: card.universe })
  }

  return {
    cards,
    sections,
    projects,
    images,
    ready,
    error,
    saving: savingIds.length > 0,
    isPending: useCallback((id) => pending.current.has(id), []),
    createCard,
    updateCard,
    deleteCard,
    reorder,
    moveCards,
    renameSection,
    uploadImage,
    createProject,
    setDuration,
    importImages,
    deleteImage,
    reorderImages,
  }
}

// En desarrollo React monta el efecto dos veces; sin esta guarda cada carta
// local se subiria por duplicado.
let migrationRun = null
const migrateOnce = (uploadImage) => (migrationRun ??= migrateLocalCards(uploadImage))

const PLACEHOLDER = 'Sin titulo'

// Una carta a medio escribir (sin nombre, sin texto) no pasa la validacion del
// servidor. Antes que dejarla fuera se completa con un marcador visible.
function withPlaceholders(state) {
  const next = { ...state }
  const fill = (field, value = PLACEHOLDER) => {
    if (!String(next[field] ?? '').trim()) next[field] = value
  }
  if (state.type === 'Character' || state.type === 'Artifact') fill('name')
  if (state.type === 'Cover') { fill('coverTitle'); fill('coverPartNum', '1') }
  if (state.type === 'Full Image Cover') fill('fullCoverTitle')
  if (state.type === 'Tier Explanation') fill('tierExplanationText')
  if (state.type === 'General Explanation') {
    fill('generalExplanationTitle')
    fill('generalExplanationText')
  }
  if (state.type === 'Tarot Member') {
    fill('tarotMemberName', 'New member')
    fill('tarotMemberTitle', 'The Unknown')
    fill('tarotMemberDescription', 'What the Club sees.')
    fill('tarotMemberDetailLabel', 'Club function')
    fill('tarotMemberDetailText', 'What is actually happening.')
  }
  if (state.type === 'Corruption File') {
    fill('corruptionIncident', 'New incident')
    fill('corruptionCaseLabel', 'Normal explanation')
    fill('corruptionExplanation', 'What happened.')
    fill('corruptionReactionLabel', 'Fandom reaction')
    fill('corruptionReaction', 'What the fandom did with it.')
  }
  if (state.type === 'Ritual Logic') {
    fill('ritualSequenceName', 'New sequence')
    fill('ritualText', 'What the ritual requires.')
    fill('ritualSurvival', 'What the ritual helps the aspirant survive.')
    fill('ritualPreparation', 'What the ritual rehearses before the new powers arrive.')
  }
  return next
}

async function createLegacyCard(state) {
  const post = (card) => fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card, part: { name: 'Migradas del editor', number: 1 } }),
  })
  const response = await post(fromBuilderCardState(state))
  if (response.ok) return true
  if (response.status !== 400) return false
  return (await post(fromBuilderCardState(withPlaceholders(state)))).ok
}

// Sube al servidor las cartas que quedaron en IndexedDB de la version anterior.
// Cada carta se quita del lote local en cuanto sube, asi que un reintento ni la
// duplica ni la pierde.
async function migrateLocalCards(uploadImage) {
  let snapshot = null
  try {
    snapshot = await loadData()
  } catch {
    return null
  }
  const batch = snapshot?.batch ?? []
  if (!batch.length) {
    if (snapshot) await clearData()
    return null
  }

  let remaining = batch
  let saved = 0
  for (const item of batch) {
    try {
      const state = await uploadStateImages(item.state, uploadImage)
      if (!(await createLegacyCard(state))) continue
      saved += 1
      remaining = remaining.filter((card) => card.id !== item.id)
      await saveData({ ...snapshot, batch: remaining })
    } catch { /* se queda en el lote local para el proximo intento */ }
  }
  if (!remaining.length) await clearData()
  return { saved, failed: remaining.length }
}

async function uploadStateImages(state, uploadImage) {
  const next = { ...state }
  for (const field of IMAGE_FIELDS) {
    const value = next[field]
    if (typeof value !== 'string' || !value.startsWith('data:')) continue
    const blob = await (await fetch(value)).blob()
    const url = await uploadImage(new File([blob], 'imagen', { type: blob.type }))
    next[field] = url
  }
  return next
}
