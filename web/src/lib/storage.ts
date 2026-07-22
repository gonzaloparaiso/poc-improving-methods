// Capa de persistencia + sesión. El servidor (SQLite) es la fuente de verdad
// y la caché local (IndexedDB vía ./kv) guarda una copia. Todas las peticiones
// llevan el token. Los tokens siguen en sessionStorage (son pequeños y de sesión).

import * as kv from './kv'

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
  'im_respiraciones',
  'im_movilidad',
] as const

// ── Token de sesión ───────────────────────────────────────────────────────────
const TOKEN_STAFF = 'im_token'
const TOKEN_CLIENTE = 'im_cliente_token'

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_STAFF) || sessionStorage.getItem(TOKEN_CLIENTE)
}
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const t = getToken()
  return { ...(extra || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

export async function loginStaff(username: string, password: string) {
  const res = await fetch(`${API}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Error de acceso') }
  const { token, user } = await res.json()
  sessionStorage.setItem(TOKEN_STAFF, token)
  return user
}

export async function loginCliente(identificador: string, password: string) {
  const res = await fetch(`${API}/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador, password }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Error de acceso') }
  const { token, cliente } = await res.json()
  sessionStorage.setItem(TOKEN_CLIENTE, token)
  return cliente
}

export function logout() {
  const t = getToken()
  if (t) void fetch(`${API}/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {})
  sessionStorage.removeItem(TOKEN_STAFF)
  sessionStorage.removeItem(TOKEN_CLIENTE)
}

// ── API REST de dominio ───────────────────────────────────────────────────────
async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Error en la operación')
  return data
}

export const apiCreateUser    = (b: unknown) => apiPost('/users', b)
export const apiCreateProduct = (b: unknown) => apiPost('/products', b)
export const apiCreateClient  = (b: unknown) => apiPost('/clients', b)
export const apiAssignSubscription = (clienteId: string, b: unknown) => apiPost(`/clients/${clienteId}/subscriptions`, b)

/** El cliente del portal cambia su propia contraseña (verifica la actual). */
export const apiPortalChangePassword = (actual: string, nueva: string) =>
  apiPost('/portal/change-password', { actual, nueva })

/** Solicita un email de restablecimiento (público). Siempre responde ok. */
export const apiForgotPassword = (email: string) =>
  apiPost('/portal/forgot-password', { email })

/** Fija una nueva contraseña con el token recibido por email (público). */
export const apiResetPassword = (token: string, nueva: string) =>
  apiPost('/portal/reset-password', { token, nueva })

/** Igual que apiForgotPassword pero para el panel de administradores (staff). */
export const apiStaffForgotPassword = (email: string) =>
  apiPost('/staff/forgot-password', { email })

/** Igual que apiResetPassword pero para el panel de administradores (staff). */
export const apiStaffResetPassword = (token: string, nueva: string) =>
  apiPost('/staff/reset-password', { token, nueva })

/** Renueva (mode 'renew') o reactiva creando una nueva suscripción
 *  (mode 'resubscribe') en WooCommerce, cobrando al método guardado.
 *  Devuelve { status: 'paid' } o { status: 'needs_action', payment_url }. */
export const apiPortalRenew = (catalogoId: string, mode: 'renew' | 'resubscribe' = 'renew') =>
  apiPost('/portal/renew', { catalogoId, mode }) as Promise<{ status: 'paid' | 'needs_action'; payment_url?: string }>


/** Re-descarga los datos del servidor, reescribe la caché local y avisa a los
 *  contexts para que refresquen su estado (evento 'im-data-refreshed'). */
export async function refreshFromServer(): Promise<void> {
  const staff = sessionStorage.getItem(TOKEN_STAFF)
  if (!staff) return
  const res = await fetch(`${API}/data`, { headers: { Authorization: `Bearer ${staff}` } })
  if (!res.ok) return
  const remote = (await res.json()) as Record<string, unknown>
  for (const key of SYNC_KEYS) {
    if (remote[key] !== undefined && remote[key] !== null) kv.set(key, JSON.stringify(remote[key]))
    else kv.remove(key)
  }
  window.dispatchEvent(new Event('im-data-refreshed'))
}

// ── Persistencia (panel) ──────────────────────────────────────────────────────
/** Guarda en la caché local (IndexedDB) y empuja al servidor en segundo plano */
export function saveKV(key: string, value: unknown) {
  const serialized = JSON.stringify(value)
  kv.set(key, serialized)
  void fetch(`${API}/data/${key}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: serialized,
  }).catch(err => console.warn(`[sync] No se pudo guardar ${key}:`, err))
}

// ── Sincronización inicial ──────────────────────────────────────────────────────
/**
 * Carga los datos del servidor antes de montar la app, según la sesión:
 *  - Staff: GET /api/data (todas las colecciones).
 *  - Cliente: GET /api/portal/me (solo sus datos).
 *  - Sin sesión: no hace nada (las pantallas de login no necesitan datos).
 */
export async function bootSync(): Promise<void> {
  const staff = sessionStorage.getItem(TOKEN_STAFF)
  const cliente = sessionStorage.getItem(TOKEN_CLIENTE)
  try {
    if (staff) {
      const res = await fetch(`${API}/data`, { headers: { Authorization: `Bearer ${staff}` }, signal: AbortSignal.timeout(8000) })
      if (res.status === 401) return logout()
      if (!res.ok) return
      const remote = (await res.json()) as Record<string, unknown>
      for (const key of SYNC_KEYS) {
        if (remote[key] !== undefined && remote[key] !== null) kv.set(key, JSON.stringify(remote[key]))
        else kv.remove(key)
      }
    } else if (cliente) {
      const res = await fetch(`${API}/portal/me`, { headers: { Authorization: `Bearer ${cliente}` }, signal: AbortSignal.timeout(8000) })
      if (res.status === 401) return logout()
      if (!res.ok) return
      const me = await res.json() as Record<string, unknown>
      // Escribir solo las colecciones que el portal necesita (datos del propio cliente)
      kv.set('im_clientes', JSON.stringify([me.cliente]))
      for (const key of ['im_suscripciones_clientes', 'im_suscripciones_catalogo', 'im_calendarios', 'im_ejercicios', 'im_respiraciones', 'im_movilidad']) {
        kv.set(key, JSON.stringify(me[key] ?? []))
      }
    }
  } catch (err) {
    console.warn('[sync] API no disponible:', err)
  }
}
