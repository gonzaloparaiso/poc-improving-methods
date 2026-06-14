// Almacén clave-valor con espejo en memoria y persistencia en IndexedDB.
// Sustituye a localStorage para los datos `im_*`, que superan la cuota de
// localStorage (~5 MB en Safari/Firefox). IndexedDB admite cientos de MB.
//
// La API de lectura/escritura es SÍNCRONA (respaldada por el Map en memoria);
// la escritura a IndexedDB ocurre en segundo plano. Por eso hay que llamar
// (y esperar) a `hydrate()` antes de montar la app: rellena la memoria desde
// IndexedDB y migra, una sola vez, los datos antiguos que hubiera en localStorage.

const DB_NAME = 'im_store'
const STORE = 'kv'
const mem = new Map<string, string>()

// Claves que antes vivían en localStorage (migración única a IndexedDB)
const MIGRATE_KEYS = [
  'im_users', 'im_clientes', 'im_suscripciones_catalogo', 'im_suscripciones_clientes',
  'im_calendarios', 'im_programas', 'im_plantillas', 'im_ejercicios', 'im_tareas_completadas',
]

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> { return (dbPromise ??= openDB()) }

async function idbSet(key: string, value: string): Promise<void> {
  const d = await db()
  await new Promise<void>((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

async function idbDel(key: string): Promise<void> {
  const d = await db()
  await new Promise<void>((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

/** Rellena la memoria desde IndexedDB. Debe esperarse antes de montar la app. */
export async function hydrate(): Promise<void> {
  try {
    const d = await db()
    const entries: [string, string][] = await new Promise((res, rej) => {
      const out: [string, string][] = []
      const tx = d.transaction(STORE, 'readonly')
      const cur = tx.objectStore(STORE).openCursor()
      cur.onsuccess = () => {
        const c = cur.result
        if (c) { out.push([String(c.key), c.value as string]); c.continue() }
        else res(out)
      }
      cur.onerror = () => rej(cur.error)
    })
    for (const [k, v] of entries) mem.set(k, v)

    // Migración única desde localStorage (datos previos a IndexedDB)
    if (entries.length === 0) {
      for (const k of MIGRATE_KEYS) {
        const v = localStorage.getItem(k)
        if (v != null) { mem.set(k, v); void idbSet(k, v).catch(() => {}) }
      }
    }
  } catch (err) {
    console.warn('[kv] IndexedDB no disponible, se usa solo memoria:', err)
  }
}

/** Lee el valor (string JSON) o null. Síncrono: lee del espejo en memoria. */
export function get(key: string): string | null {
  return mem.has(key) ? mem.get(key)! : null
}

/** Escribe en memoria (inmediato) y persiste en IndexedDB (en segundo plano). */
export function set(key: string, value: string): void {
  mem.set(key, value)
  void idbSet(key, value).catch(err => console.warn(`[kv] no se pudo persistir ${key}:`, err))
}

/** Elimina la clave de memoria y de IndexedDB. */
export function remove(key: string): void {
  mem.delete(key)
  void idbDel(key).catch(() => {})
}
