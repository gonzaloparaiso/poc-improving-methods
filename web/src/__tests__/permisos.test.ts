import { describe, it, expect } from 'vitest'
import { puedeHacer } from '../types'

describe('puedeHacer (permisos por rol)', () => {
  it('el administrador puede todo en administración', () => {
    expect(puedeHacer('administrador', 'administracion', 'ver')).toBe(true)
    expect(puedeHacer('administrador', 'administracion', 'crear')).toBe(true)
    expect(puedeHacer('administrador', 'administracion', 'borrar')).toBe(true)
  })
  it('un coach no puede ver administración', () => {
    expect(puedeHacer('coach', 'administracion', 'ver')).toBe(false)
  })
  it('el coach puede crear/editar planificaciones pero NO borrar', () => {
    expect(puedeHacer('coach', 'planificaciones', 'crear')).toBe(true)
    expect(puedeHacer('coach', 'planificaciones', 'editar')).toBe(true)
    expect(puedeHacer('coach', 'planificaciones', 'borrar')).toBe(false)
  })
  it('el head_coach ve clientes pero no los crea', () => {
    expect(puedeHacer('head_coach', 'clientes', 'ver')).toBe(true)
    expect(puedeHacer('head_coach', 'clientes', 'crear')).toBe(false)
  })
  it('rol o sección desconocidos devuelven false', () => {
    // @ts-expect-error rol inválido a propósito
    expect(puedeHacer('intruso', 'clientes', 'ver')).toBe(false)
  })
})
