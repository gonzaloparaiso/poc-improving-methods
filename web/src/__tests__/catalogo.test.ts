import { describe, it, expect } from 'vitest'
import { migrarCatalogo } from '../context/ClientesContext'

describe('migrarCatalogo', () => {
  it('mantiene el formato nuevo (programas[]) y aplica defaults de precio/prueba', () => {
    const c = migrarCatalogo({
      id: 'x', nombre: 'Plan', tipo: 'recurrente', creadoEn: '2024-01-01',
      programas: [{ programaId: 'p1', fechaInicio: null }],
    })
    expect(c.programas).toHaveLength(1)
    expect(c.precioMensual).toBe(0)
    expect(c.primerMesPrueba).toBe(false)
  })

  it('convierte el formato antiguo (programaId suelto) a programas[]', () => {
    const c = migrarCatalogo({
      id: 'y', nombre: 'Viejo', tipo: 'unico', creadoEn: '2024-01-01',
      programaId: 'prog9', fechaInicioPrograma: '2024-02-01',
    })
    expect(c.programas).toEqual([{ programaId: 'prog9', fechaInicio: '2024-02-01' }])
  })

  it('respeta precio y primerMesPrueba si vienen informados', () => {
    const c = migrarCatalogo({
      id: 'z', nombre: 'Pro', tipo: 'recurrente', creadoEn: '2024-01-01',
      programas: [], precioMensual: 49, primerMesPrueba: true,
    })
    expect(c.precioMensual).toBe(49)
    expect(c.primerMesPrueba).toBe(true)
  })

  it('formato antiguo sin programa deja programas vacío', () => {
    const c = migrarCatalogo({ id: 'w', nombre: 'Vacío', tipo: 'unico', creadoEn: '2024-01-01' })
    expect(c.programas).toEqual([])
  })
})
