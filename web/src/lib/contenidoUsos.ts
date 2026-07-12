// Contador de aperturas de contenido (Respiración/Movilidad) por cliente, para
// poder mostrarle sus accesos rápidos. Es puramente local (no se sincroniza con
// el servidor ni entre dispositivos) — vive en localStorage del navegador.
const PREFIX = 'im_contenido_usos_'

export function registrarUso(clienteId: string, itemId: string): void {
  const key = PREFIX + clienteId
  const usos = obtenerUsos(clienteId)
  usos[itemId] = (usos[itemId] ?? 0) + 1
  localStorage.setItem(key, JSON.stringify(usos))
}

export function obtenerUsos(clienteId: string): Record<string, number> {
  const raw = localStorage.getItem(PREFIX + clienteId)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
