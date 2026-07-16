// Favoritas de Contenido (Respiración/Movilidad): el cliente las marca/desmarca
// a mano con el corazón. Igual que las periódicas, es puramente local del
// navegador (localStorage) por cliente — no lo ve la administración ni otros clientes.
const PREFIX = 'im_contenido_favoritos_'

export function obtenerFavoritos(clienteId: string): string[] {
  const raw = localStorage.getItem(PREFIX + clienteId)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function esFavorito(favoritos: string[], itemId: string): boolean {
  return favoritos.includes(itemId)
}

/** Añade o quita el item de favoritos (según su estado actual) y devuelve la lista resultante. */
export function toggleFavorito(clienteId: string, itemId: string): string[] {
  const actuales = obtenerFavoritos(clienteId)
  const next = actuales.includes(itemId)
    ? actuales.filter(id => id !== itemId)
    : [itemId, ...actuales] // las más recientes primero
  localStorage.setItem(PREFIX + clienteId, JSON.stringify(next))
  return next
}
