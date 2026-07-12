import { describe, it, expect } from 'vitest'
import { RESPIRACIONES_SEED } from '../data/respiraciones'

describe('RESPIRACIONES_SEED', () => {
  it('tiene 5 respiraciones de ejemplo', () => {
    expect(RESPIRACIONES_SEED).toHaveLength(5)
  })

  it('cada una tiene título, descripción y al menos una etiqueta', () => {
    RESPIRACIONES_SEED.forEach(r => {
      expect(r.titulo.length).toBeGreaterThan(0)
      expect(r.descripcion.length).toBeGreaterThan(0)
      expect(r.etiquetas.length).toBeGreaterThan(0)
    })
  })

  it('tiene ids únicos', () => {
    const ids = new Set(RESPIRACIONES_SEED.map(r => r.id))
    expect(ids.size).toBe(RESPIRACIONES_SEED.length)
  })

  it('no trae media ni miniatura reales (quedan por subir)', () => {
    RESPIRACIONES_SEED.forEach(r => {
      expect(r.mediaTipo).toBeNull()
      expect(r.mediaUrl).toBe('')
      expect(r.thumbnail).toBe('')
    })
  })
})
