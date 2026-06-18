// Persistent storage backed by IndexedDB so the app can hold many image-heavy
// cards without hitting the ~5MB localStorage quota (which used to fail silently
// and lose progress on reload). A single key holds the whole app snapshot.

const DB_NAME = 'lotm-cards'
const STORE = 'kv'
const KEY = 'app'
const LEGACY_LS_KEY = 'lotm-cards-v1'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Load the saved snapshot. Falls back to (and migrates from) the old
// localStorage key the first time, so existing work is never lost.
export async function loadData() {
  try {
    const db = await openDB()
    const data = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
    if (data) return data
  } catch { /* IndexedDB unavailable — try legacy storage below */ }

  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY)
    if (raw) {
      const legacy = JSON.parse(raw)
      await saveData(legacy)
      localStorage.removeItem(LEGACY_LS_KEY)
      return legacy
    }
  } catch { /* nothing to migrate */ }

  return null
}

// Persist the whole snapshot. Returns true on success so the UI can show status.
export async function saveData(data) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(data, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
}
