// Capa de persistencia: el servidor es la fuente de verdad y localStorage
// queda como caché local (los contexts siguen leyendo de localStorage de forma
// síncrona, igual que antes).

const API = '/api'

export const SYNC_KEYS = [
  'im_users',
  'im_clientes',
  'im_suscripciones_catalogo',
  'im_suscripciones_clientes',
  'im_calendarios',
  'im_programas',
  'im_plantillas',
  'im_ejercicios',
  'im_tareas_completadas',
] as const

/** Guarda en localStorage (caché) y empuja al servidor en segundo plano */
export function saveKV(key: string, value: unknown) {
  const serialized = JSON.stringify(value)
  localStorage.setItem(key, serialized)
  void fetch(`${API}/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: serialized,
  }).catch(err => console.warn(`[sync] No se pudo guardar ${key} en el servidor:`, err))
}

/**
 * Sincronización inicial, antes de montar la app:
 * - Si el servidor tiene datos para una clave → sobreescribe la caché local.
 * - Si el servidor NO los tiene pero localStorage sí → migra lo local al servidor
 *   (cubre la transición desde el POC solo-localStorage).
 * - Si la API no responde → seguimos en modo solo-local sin romper nada.
 */
export async function bootSync(): Promise<void> {
  try {
    const res = await fetch(`${API}/data`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return
    const remote = (await res.json()) as Record<string, unknown>

    for (const key of SYNC_KEYS) {
      if (remote[key] !== undefined && remote[key] !== null) {
        localStorage.setItem(key, JSON.stringify(remote[key]))
      } else {
        const local = localStorage.getItem(key)
        if (local) {
          void fetch(`${API}/data/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: local,
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn('[sync] API no disponible, usando datos locales:', err)
  }
}
