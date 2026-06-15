import { describe, it, expect } from 'vitest'
import { fusionarCalendarios, lunesDe } from '../lib/calendario'
import type { CalendarioCliente, Bloque } from '../types'

function bloque(nombre: string): Bloque {
  return { id: 'b-' + nombre, nombre, instrucciones: '', notas: '', cronometro: '', ejercicios: [], esPlantilla: false, creadoEn: '2024-01-01T00:00:00.000Z' }
}

function cal(id: string, nombre: string, colorKey: string | undefined, fechaLunes: string, diaIdx: number, nombreBloque: string): CalendarioCliente {
  const dias = Array.from({ length: 7 }, (_, i) => ({ fecha: '', diaSemana: i, bloques: i === diaIdx ? [bloque(nombreBloque)] : [] }))
  return {
    id, clienteId: 'c1', suscripcionClienteId: 's1', programaId: 'p1', programaNombre: nombre,
    fechaInicio: fechaLunes, creadoEn: '2024-01-01T00:00:00.000Z', colorKey: colorKey as string,
    semanas: [{ id: 'w', numero: 1, fechaLunes, dias }],
  }
}

describe('fusionarCalendarios', () => {
  it('combina dos calendarios de la misma semana en una sola semana', () => {
    const a = cal('A', 'Box', 'yellow', '2026-06-15', 0, 'WOD A')   // lunes
    const b = cal('B', 'Movilidad', 'blue', '2026-06-15', 0, 'Mov B') // lunes, misma semana
    const fus = fusionarCalendarios([a, b])
    expect(fus).toHaveLength(1)
    expect(fus[0].fechaLunes).toBe('2026-06-15')
    // El lunes (día 0) debe tener los bloques de ambos calendarios
    expect(fus[0].dias[0].bloques.map(x => x.nombre).sort()).toEqual(['Mov B', 'WOD A'])
    // Cada bloque conserva su origen (calId, programa, color)
    const wodA = fus[0].dias[0].bloques.find(x => x.nombre === 'WOD A')!
    expect(wodA.calId).toBe('A')
    expect(wodA.calNombre).toBe('Box')
    expect(wodA.colorKey).toBe('yellow')
  })

  it('coloca cada bloque en su día correspondiente', () => {
    const a = cal('A', 'Box', 'yellow', '2026-06-15', 2, 'Miércoles WOD') // día índice 2
    const fus = fusionarCalendarios([a])
    expect(fus[0].dias[2].bloques).toHaveLength(1)
    expect(fus[0].dias[0].bloques).toHaveLength(0)
  })

  it('agrupa y ordena por semana (lunes) ascendente', () => {
    const s2 = cal('A', 'Box', 'yellow', '2026-06-22', 0, 'Semana 2')
    const s1 = cal('A', 'Box', 'yellow', '2026-06-15', 0, 'Semana 1')
    const fus = fusionarCalendarios([s2, s1])
    expect(fus.map(s => s.fechaLunes)).toEqual(['2026-06-15', '2026-06-22'])
  })

  it('usa color "yellow" por defecto si el calendario no tiene colorKey', () => {
    const a = cal('A', 'Box', undefined, '2026-06-15', 0, 'WOD')
    const fus = fusionarCalendarios([a])
    expect(fus[0].dias[0].bloques[0].colorKey).toBe('yellow')
  })

  it('lunesDe devuelve el lunes de cualquier día de la semana', () => {
    expect(lunesDe('2026-06-17')).toBe('2026-06-15') // miércoles
    expect(lunesDe('2026-06-21')).toBe('2026-06-15') // domingo
  })
})
