import { describe, it, expect } from 'vitest'
import { recomendar } from '../lib/contenidoRecomendacion'
import { type ContenidoItem } from '../types'
import { type ContenidoPeriodico } from '../lib/contenidoPeriodico'

function item(id: string, etiquetas: string[]): ContenidoItem {
  return {
    id, titulo: id, descripcion: '', etiquetas,
    mediaTipo: null, mediaUrl: '', mediaNombre: '', mediaSize: 0, thumbnail: '', creadoEn: '',
  }
}

const relajacion1 = item('relajacion1', ['relajación', 'básica'])
const relajacion2 = item('relajacion2', ['relajación', 'sueño'])
const energia = item('energia', ['energizante', 'activación'])
const neutro = item('neutro', [])

const todos = [relajacion1, relajacion2, energia, neutro]

describe('recomendar', () => {
  it('sin favoritos ni periódicas, cae de forma determinista al primero de la lista', () => {
    const rec = recomendar(todos, [], [])
    expect(rec?.item.id).toBe('relajacion1')
    expect(rec?.etiquetasComunes).toEqual([])
  })

  it('recomienda algo con etiquetas afines a los favoritos, no ya favorito', () => {
    // favorita relajacion1 (relajación, básica) → debería sugerir relajacion2 (comparte "relajación")
    const rec = recomendar(todos, ['relajacion1'], [])
    expect(rec?.item.id).toBe('relajacion2')
    expect(rec?.etiquetasComunes).toEqual(['relajación'])
  })

  it('nunca recomienda algo ya favorito', () => {
    const rec = recomendar(todos, ['relajacion1', 'relajacion2'], [])
    expect(rec?.item.id).not.toBe('relajacion1')
    expect(rec?.item.id).not.toBe('relajacion2')
  })

  it('nunca recomienda algo ya programado en el calendario', () => {
    const periodicas: ContenidoPeriodico[] = [{ id: 'p1', contenidoId: 'relajacion1', hora: '08:00', dias: [0] }]
    const rec = recomendar(todos, [], periodicas)
    expect(rec?.item.id).not.toBe('relajacion1')
  })

  it('las etiquetas de favoritos pesan más que las de programadas', () => {
    // favorita "energia" (energizante, activación); programada "relajacion1" (relajación, básica)
    // candidatos: relajacion2 (relajación, sueño) puntúa 1 por "relajación" programada
    // no hay candidato con etiquetas de "energia", así que relajacion2 debería ganar sobre neutro
    const periodicas: ContenidoPeriodico[] = [{ id: 'p1', contenidoId: 'relajacion1', hora: '08:00', dias: [0] }]
    const rec = recomendar(todos, ['energia'], periodicas)
    expect(rec?.item.id).toBe('relajacion2')
  })

  it('devuelve null si no queda ningún candidato', () => {
    const rec = recomendar([relajacion1], ['relajacion1'], [])
    expect(rec).toBeNull()
  })
})
