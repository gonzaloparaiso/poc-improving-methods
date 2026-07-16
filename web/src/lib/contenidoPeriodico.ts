// Respiraciones (o movilidad) que el cliente programa de forma periódica en SU
// calendario: se repiten cada semana en los días y hora elegidos. Igual que los
// usos/favoritas, es puramente local del navegador (localStorage) — solo lo ve
// este cliente, nunca la administración ni otros clientes.
const PREFIX = 'im_contenido_periodico_'

export interface ContenidoPeriodico {
  id: string
  contenidoId: string
  hora: string    // 'HH:MM'
  dias: number[]  // 0=Lun … 6=Dom
}

export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export function obtenerPeriodicas(clienteId: string): ContenidoPeriodico[] {
  const raw = localStorage.getItem(PREFIX + clienteId)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function guardar(clienteId: string, items: ContenidoPeriodico[]): void {
  localStorage.setItem(PREFIX + clienteId, JSON.stringify(items))
}

/**
 * Añade una programación periódica. La misma respiración puede repetirse
 * siempre que sea a una hora distinta.
 */
export function añadirPeriodica(
  clienteId: string,
  contenidoId: string,
  hora: string,
  dias: number[],
): { ok: true; item: ContenidoPeriodico } | { ok: false; error: string } {
  if (!/^\d{2}:\d{2}$/.test(hora)) return { ok: false, error: 'Elige una hora' }
  const diasValidos = [...new Set(dias)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b)
  if (diasValidos.length === 0) return { ok: false, error: 'Elige al menos un día de la semana' }

  const existentes = obtenerPeriodicas(clienteId)
  if (existentes.some(p => p.contenidoId === contenidoId && p.hora === hora)) {
    return { ok: false, error: `Ya tienes esta respiración programada a las ${hora}. Elige otra hora.` }
  }

  const item: ContenidoPeriodico = { id: genId(), contenidoId, hora, dias: diasValidos }
  guardar(clienteId, [...existentes, item])
  return { ok: true, item }
}

export function eliminarPeriodica(clienteId: string, id: string): ContenidoPeriodico[] {
  const next = obtenerPeriodicas(clienteId).filter(p => p.id !== id)
  guardar(clienteId, next)
  return next
}

/** Las programaciones que caen en un día de la semana dado (0=Lun…6=Dom), ordenadas por hora. */
export function periodicasDeDia(items: ContenidoPeriodico[], diaSemana: number): ContenidoPeriodico[] {
  return items
    .filter(p => p.dias.includes(diaSemana))
    .sort((a, b) => a.hora.localeCompare(b.hora))
}

/** Resumen legible de los días: "L · X · V" */
export function resumenDias(dias: number[]): string {
  return [...dias].sort((a, b) => a - b).map(d => DIAS_CORTOS[d]).join(' · ')
}
