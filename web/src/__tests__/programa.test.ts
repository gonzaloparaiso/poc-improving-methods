import { describe, it, expect } from 'vitest'
import { instanciarPrograma } from '../context/CalendariosContext'
import type { Programa } from '../types'

function programaDe(numSemanas: number): Programa {
  return {
    id: 'p', nombre: 'P', descripcion: '', creadoEn: '2024-01-01T00:00:00.000Z',
    semanas: Array.from({ length: numSemanas }, (_, i) => ({
      id: `w${i}`, numero: i + 1,
      dias: Array.from({ length: 7 }, () => ({ bloques: [] })),
    })),
  }
}

describe('instanciarPrograma', () => {
  it('crea una semana de calendario por semana del programa', () => {
    const cal = instanciarPrograma(programaDe(3), '2026-06-15') // lunes
    expect(cal).toHaveLength(3)
    expect(cal[0].fechaLunes).toBe('2026-06-15')
  })

  it('cada semana siguiente empieza 7 días después', () => {
    const cal = instanciarPrograma(programaDe(2), '2026-06-15')
    expect(cal[0].fechaLunes).toBe('2026-06-15')
    expect(cal[1].fechaLunes).toBe('2026-06-22')
  })

  it('cada semana tiene 7 días con fechas correlativas', () => {
    const cal = instanciarPrograma(programaDe(1), '2026-06-15')
    const dias = cal[0].dias
    expect(dias).toHaveLength(7)
    expect(dias[0].fecha).toBe('2026-06-15')
    expect(dias[6].fecha).toBe('2026-06-21')
  })

  it('copia profunda de los bloques (no comparte referencia con el programa)', () => {
    const prog = programaDe(1)
    prog.semanas[0].dias[0].bloques.push({
      id: 'b1', nombre: 'Calent', instrucciones: '', notas: '', cronometro: '',
      ejercicios: [], esPlantilla: false, creadoEn: '2024-01-01T00:00:00.000Z',
    })
    const cal = instanciarPrograma(prog, '2026-06-15')
    expect(cal[0].dias[0].bloques).toHaveLength(1)
    expect(cal[0].dias[0].bloques[0]).not.toBe(prog.semanas[0].dias[0].bloques[0])
  })
})
