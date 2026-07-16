import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  obtenerPeriodicas, añadirPeriodica, eliminarPeriodica, periodicasDeDia, resumenDias,
} from '../lib/contenidoPeriodico'

const CLIENTE = 'cli-test'

// El entorno de vitest es Node: stub mínimo de localStorage
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
})

beforeEach(() => localStorage.clear())

describe('contenidoPeriodico', () => {
  it('añade una programación válida y la recupera', () => {
    const res = añadirPeriodica(CLIENTE, 'resp-1', '08:00', [0, 2, 4])
    expect(res.ok).toBe(true)
    const items = obtenerPeriodicas(CLIENTE)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ contenidoId: 'resp-1', hora: '08:00', dias: [0, 2, 4] })
  })

  it('rechaza duplicado de misma respiración a la misma hora', () => {
    añadirPeriodica(CLIENTE, 'resp-1', '08:00', [0])
    const res = añadirPeriodica(CLIENTE, 'resp-1', '08:00', [3])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('otra hora')
    expect(obtenerPeriodicas(CLIENTE)).toHaveLength(1)
  })

  it('permite la misma respiración a horas distintas', () => {
    expect(añadirPeriodica(CLIENTE, 'resp-1', '08:00', [0]).ok).toBe(true)
    expect(añadirPeriodica(CLIENTE, 'resp-1', '21:30', [0]).ok).toBe(true)
    expect(obtenerPeriodicas(CLIENTE)).toHaveLength(2)
  })

  it('rechaza sin días o sin hora válida', () => {
    expect(añadirPeriodica(CLIENTE, 'resp-1', '08:00', []).ok).toBe(false)
    expect(añadirPeriodica(CLIENTE, 'resp-1', '', [1]).ok).toBe(false)
    expect(obtenerPeriodicas(CLIENTE)).toHaveLength(0)
  })

  it('elimina una programación', () => {
    const res = añadirPeriodica(CLIENTE, 'resp-1', '08:00', [0])
    if (!res.ok) throw new Error('no debería fallar')
    añadirPeriodica(CLIENTE, 'resp-2', '09:00', [1])
    const restantes = eliminarPeriodica(CLIENTE, res.item.id)
    expect(restantes).toHaveLength(1)
    expect(restantes[0].contenidoId).toBe('resp-2')
  })

  it('es privado por cliente: otro cliente no ve las programaciones', () => {
    añadirPeriodica(CLIENTE, 'resp-1', '08:00', [0])
    expect(obtenerPeriodicas('otro-cliente')).toHaveLength(0)
  })

  it('periodicasDeDia filtra por día de la semana y ordena por hora', () => {
    añadirPeriodica(CLIENTE, 'resp-1', '21:00', [0, 4])
    añadirPeriodica(CLIENTE, 'resp-2', '07:30', [0])
    const items = obtenerPeriodicas(CLIENTE)
    const lunes = periodicasDeDia(items, 0)
    expect(lunes.map(p => p.hora)).toEqual(['07:30', '21:00'])
    expect(periodicasDeDia(items, 4)).toHaveLength(1)
    expect(periodicasDeDia(items, 2)).toHaveLength(0)
  })

  it('resumenDias formatea con iniciales ordenadas', () => {
    expect(resumenDias([4, 0, 2])).toBe('L · X · V')
    expect(resumenDias([6])).toBe('D')
  })
})
