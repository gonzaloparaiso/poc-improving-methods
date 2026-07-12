import { describe, it, expect } from 'vitest'
import { esNombreReservado, BASIC_PROGRAM_ID, BASIC_PROGRAM_NOMBRE } from '../types'

describe('esNombreReservado / BASIC_PROGRAM_ID', () => {
  it('detecta "Basic" sin distinguir mayúsculas ni espacios', () => {
    expect(esNombreReservado('Basic')).toBe(true)
    expect(esNombreReservado('BASIC')).toBe(true)
    expect(esNombreReservado('basic')).toBe(true)
    expect(esNombreReservado('  Basic  ')).toBe(true)
  })

  it('no marca como reservados nombres distintos', () => {
    expect(esNombreReservado('Basico')).toBe(false)
    expect(esNombreReservado('CrossFit Basic 2025')).toBe(false)
    expect(esNombreReservado('')).toBe(false)
  })

  it('el id centinela no coincide con ningún id generado real (uuid o genId)', () => {
    expect(BASIC_PROGRAM_ID).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/) // no es un uuid
    expect(BASIC_PROGRAM_NOMBRE).toBe('Basic')
  })
})
