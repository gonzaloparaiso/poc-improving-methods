import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Ejercicio, type Programa, type Bloque, type CalendarioCliente } from '../types'
import { EJERCICIOS_SEED } from '../data/ejercicios'

function genId() {
  return 'ej_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const KEY = 'im_ejercicios'

function load(): Ejercicio[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EJERCICIOS_SEED
    const parsed = JSON.parse(raw) as Ejercicio[]
    return parsed.length > 0 ? parsed : EJERCICIOS_SEED
  } catch { return EJERCICIOS_SEED }
}
function save(v: Ejercicio[]) { localStorage.setItem(KEY, JSON.stringify(v)) }

/** Devuelve dónde está usado un ejercicio: programas y plantillas (calendarios = copia ya entregada) */
export function buscarUsos(ejercicioId: string): {
  programas: string[]   // nombres de programas
  plantillas: string[]  // nombres de plantillas
  calendarios: number   // cuántos calendarios de cliente ya lo tienen
} {
  const programas: string[] = []
  const plantillas: string[] = []
  let calendarios = 0
  try {
    const progs = JSON.parse(localStorage.getItem('im_programas') ?? '[]') as Programa[]
    progs.forEach(p => {
      const usado = p.semanas.some(s => s.dias.some(d => d.bloques.some(b =>
        b.ejercicios.some(e => e.ejercicioId === ejercicioId))))
      if (usado) programas.push(p.nombre)
    })
  } catch { /* */ }
  try {
    const plants = JSON.parse(localStorage.getItem('im_plantillas') ?? '[]') as Bloque[]
    plants.forEach(b => {
      if (b.ejercicios.some(e => e.ejercicioId === ejercicioId)) plantillas.push(b.nombre)
    })
  } catch { /* */ }
  try {
    const cals = JSON.parse(localStorage.getItem('im_calendarios') ?? '[]') as CalendarioCliente[]
    cals.forEach(c => {
      const usado = c.semanas.some(s => s.dias.some(d => d.bloques.some(b =>
        b.ejercicios.some(e => e.ejercicioId === ejercicioId))))
      if (usado) calendarios++
    })
  } catch { /* */ }
  return { programas, plantillas, calendarios }
}

interface CtxValue {
  ejercicios: Ejercicio[]
  crear:   (data: Omit<Ejercicio, 'id'>) => Ejercicio
  editar:  (id: string, data: Partial<Omit<Ejercicio, 'id'>>) => void
  borrar:  (id: string) => void
  clonar:  (id: string, nuevoNombre: string) => Ejercicio | null
  /** Devuelve si está en uso (programas o plantillas) — los calendarios son copias ya entregadas */
  estaEnUso: (id: string) => boolean
}

const Ctx = createContext<CtxValue | null>(null)

export function EjerciciosProvider({ children }: { children: ReactNode }) {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>(() => load())

  const upd = useCallback((next: Ejercicio[]) => {
    setEjercicios(next); save(next)
  }, [])

  const crear = useCallback((data: Omit<Ejercicio, 'id'>): Ejercicio => {
    const nuevo: Ejercicio = { ...data, id: genId() }
    upd([...ejercicios, nuevo])
    return nuevo
  }, [ejercicios, upd])

  const editar = useCallback((id: string, data: Partial<Omit<Ejercicio, 'id'>>) => {
    upd(ejercicios.map(e => e.id === id ? { ...e, ...data } : e))
  }, [ejercicios, upd])

  const borrar = useCallback((id: string) => {
    upd(ejercicios.filter(e => e.id !== id))
  }, [ejercicios, upd])

  const clonar = useCallback((id: string, nuevoNombre: string): Ejercicio | null => {
    const original = ejercicios.find(e => e.id === id)
    if (!original) return null
    const clon: Ejercicio = { ...original, id: genId(), nombre: nuevoNombre }
    upd([...ejercicios, clon])
    return clon
  }, [ejercicios, upd])

  const estaEnUso = useCallback((id: string): boolean => {
    const usos = buscarUsos(id)
    return usos.programas.length > 0 || usos.plantillas.length > 0
  }, [])

  return (
    <Ctx.Provider value={{ ejercicios, crear, editar, borrar, clonar, estaEnUso }}>
      {children}
    </Ctx.Provider>
  )
}

export function useEjercicios() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEjercicios debe usarse dentro de EjerciciosProvider')
  return ctx
}
