// "Es probable que te guste": sugiere una respiración/movilidad nueva a partir
// de las etiquetas de lo que el cliente ya tiene marcado como favorito o
// programado en su calendario. Puramente local (no llama al servidor).
import { type ContenidoItem } from '../types'
import { type ContenidoPeriodico } from './contenidoPeriodico'

export interface Recomendacion {
  item: ContenidoItem
  etiquetasComunes: string[]
}

/**
 * Recomienda un elemento que el cliente todavía NO tiene en favoritos ni
 * programado, priorizando el que más etiquetas comparta con su "perfil"
 * (favoritos cuentan doble frente a lo programado). Sin señal ninguna,
 * cae de forma determinista al primero de la lista.
 */
export function recomendar(
  todos: ContenidoItem[],
  favoritos: string[],
  periodicas: ContenidoPeriodico[],
): Recomendacion | null {
  const programadosIds = new Set(periodicas.map(p => p.contenidoId))
  const candidatos = todos.filter(i => !favoritos.includes(i.id) && !programadosIds.has(i.id))
  if (candidatos.length === 0) return null

  // Perfil de etiquetas: favoritos pesan doble, lo programado pesa simple
  const peso = new Map<string, number>()
  const sumar = (item: ContenidoItem | undefined, valor: number) => {
    item?.etiquetas.forEach(tag => peso.set(tag, (peso.get(tag) ?? 0) + valor))
  }
  favoritos.forEach(id => sumar(todos.find(i => i.id === id), 2))
  periodicas.forEach(p => sumar(todos.find(i => i.id === p.contenidoId), 1))

  // En empate gana el primero en aparecer en `candidatos` (orden estable y determinista).
  let mejor: { item: ContenidoItem; puntos: number; comunes: string[] } | null = null
  for (const item of candidatos) {
    const comunes = item.etiquetas.filter(tag => peso.has(tag))
    const puntos = comunes.reduce((acc, tag) => acc + (peso.get(tag) ?? 0), 0)
    if (!mejor || puntos > mejor.puntos) {
      mejor = { item, puntos, comunes }
    }
  }

  return mejor && { item: mejor.item, etiquetasComunes: mejor.comunes }
}
