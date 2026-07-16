import { describe, it, expect, beforeEach, vi } from 'vitest'
import { obtenerFavoritos, esFavorito, toggleFavorito } from '../lib/contenidoFavoritos'

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

describe('contenidoFavoritos', () => {
  it('empieza vacío', () => {
    expect(obtenerFavoritos(CLIENTE)).toEqual([])
  })

  it('añade a favoritos al hacer toggle sobre un item no favorito', () => {
    const next = toggleFavorito(CLIENTE, 'resp-1')
    expect(next).toEqual(['resp-1'])
    expect(obtenerFavoritos(CLIENTE)).toEqual(['resp-1'])
    expect(esFavorito(next, 'resp-1')).toBe(true)
  })

  it('quita de favoritos al hacer toggle sobre un item ya favorito', () => {
    toggleFavorito(CLIENTE, 'resp-1')
    const next = toggleFavorito(CLIENTE, 'resp-1')
    expect(next).toEqual([])
    expect(esFavorito(next, 'resp-1')).toBe(false)
  })

  it('los más recientes van primero', () => {
    toggleFavorito(CLIENTE, 'resp-1')
    toggleFavorito(CLIENTE, 'resp-2')
    const next = toggleFavorito(CLIENTE, 'resp-3')
    expect(next).toEqual(['resp-3', 'resp-2', 'resp-1'])
  })

  it('es privado por cliente: otro cliente no ve los favoritos', () => {
    toggleFavorito(CLIENTE, 'resp-1')
    expect(obtenerFavoritos('otro-cliente')).toEqual([])
  })
})
