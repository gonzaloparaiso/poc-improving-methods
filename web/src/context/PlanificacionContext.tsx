import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Programa, type Bloque, type Semana, type DiaPrograma, type Adjunto, esNombreReservado, BASIC_PROGRAM_NOMBRE } from '../types'
import { saveKV } from '../lib/storage'
import * as kv from '../lib/kv'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function diasVacios(): DiaPrograma[] {
  return Array.from({ length: 7 }, () => ({ bloques: [] }))
}

function semanaVacia(numero: number): Semana {
  return { id: genId(), numero, dias: diasVacios() }
}

function semanas4(): Semana[] {
  return [1, 2, 3, 4].map(semanaVacia)
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEY_PROGRAMAS  = 'im_programas'
const KEY_PLANTILLAS = 'im_plantillas'

function load<T>(key: string, fallback: T): T {
  try { const r = kv.get(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}
function save<T>(key: string, val: T) {
  saveKV(key, val)
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface PlanificacionContextValue {
  // Programas
  programas: Programa[]
  crearPrograma: (nombre: string, descripcion: string) => Programa
  editarPrograma: (id: string, data: Partial<Pick<Programa, 'nombre' | 'descripcion'>>) => void
  borrarPrograma: (id: string) => void
  añadirSemana: (programaId: string) => void
  borrarSemana: (programaId: string, semanaId: string) => void
  clonarPrograma: (id: string, nuevoNombre: string) => Programa | null

  // Adjuntos del programa
  añadirAdjunto: (programaId: string, adjunto: Omit<Adjunto, 'id' | 'subidoEn'>) => void
  borrarAdjunto: (programaId: string, adjuntoId: string) => void

  // Bloques dentro de días
  añadirBloqueAlDia: (programaId: string, semanaId: string, diaIdx: number, bloque: Omit<Bloque, 'id' | 'creadoEn'>) => void
  editarBloqueDelDia: (programaId: string, semanaId: string, diaIdx: number, bloqueId: string, data: Partial<Omit<Bloque, 'id' | 'creadoEn'>>) => void
  borrarBloqueDelDia: (programaId: string, semanaId: string, diaIdx: number, bloqueId: string) => void
  duplicarBloqueDelDia: (programaId: string, semanaId: string, diaIdx: number, bloqueId: string) => void
  /** Mueve (o copia) un bloque de un día a otro, posiblemente en otra semana */
  moverBloque: (programaId: string, origen: { semanaId: string; diaIdx: number; bloqueId: string }, destino: { semanaId: string; diaIdx: number }, copiar?: boolean) => void

  // Plantillas de bloques
  plantillas: Bloque[]
  crearPlantilla: (data: Omit<Bloque, 'id' | 'creadoEn' | 'esPlantilla'>) => void
  editarPlantilla: (id: string, data: Partial<Omit<Bloque, 'id' | 'creadoEn'>>) => void
  borrarPlantilla: (id: string) => void
  clonarPlantilla: (id: string, nuevoNombre: string) => Bloque | null
}

const Ctx = createContext<PlanificacionContextValue | null>(null)

export function PlanificacionProvider({ children }: { children: ReactNode }) {
  const [programas, setProgramas]   = useState<Programa[]>(() => load(KEY_PROGRAMAS, []))
  const [plantillas, setPlantillas] = useState<Bloque[]>(() => load(KEY_PLANTILLAS, []))

  // ── helpers ──
  const updateProgramas = useCallback((next: Programa[]) => {
    setProgramas(next); save(KEY_PROGRAMAS, next)
  }, [])
  const updatePlantillas = useCallback((next: Bloque[]) => {
    setPlantillas(next); save(KEY_PLANTILLAS, next)
  }, [])

  const mutarPrograma = useCallback((id: string, fn: (p: Programa) => Programa) => {
    updateProgramas(programas.map(p => p.id === id ? fn(p) : p))
  }, [programas, updateProgramas])

  // ── Programas ──
  const crearPrograma = useCallback((nombre: string, descripcion: string): Programa => {
    if (esNombreReservado(nombre)) {
      throw new Error(`"${BASIC_PROGRAM_NOMBRE}" es un nombre reservado y no se puede usar en un programa`)
    }
    const p: Programa = { id: genId(), nombre, descripcion, semanas: semanas4(), creadoEn: new Date().toISOString() }
    updateProgramas([...programas, p])
    return p
  }, [programas, updateProgramas])

  const editarPrograma = useCallback((id: string, data: Partial<Pick<Programa, 'nombre' | 'descripcion'>>) => {
    if (data.nombre != null && esNombreReservado(data.nombre)) {
      throw new Error(`"${BASIC_PROGRAM_NOMBRE}" es un nombre reservado y no se puede usar en un programa`)
    }
    mutarPrograma(id, p => ({ ...p, ...data }))
  }, [mutarPrograma])

  const borrarPrograma = useCallback((id: string) => {
    updateProgramas(programas.filter(p => p.id !== id))
  }, [programas, updateProgramas])

  /** Clona un programa con nuevo nombre. Regenera ids de semanas/bloques/ejercicios */
  const clonarPrograma = useCallback((id: string, nuevoNombre: string): Programa | null => {
    if (esNombreReservado(nuevoNombre)) {
      throw new Error(`"${BASIC_PROGRAM_NOMBRE}" es un nombre reservado y no se puede usar en un programa`)
    }
    const original = programas.find(p => p.id === id)
    if (!original) return null
    const clon: Programa = {
      ...JSON.parse(JSON.stringify(original)),
      id: genId(),
      nombre: nuevoNombre,
      creadoEn: new Date().toISOString(),
    }
    // Regenerar todos los ids internos
    clon.semanas = clon.semanas.map(s => ({
      ...s,
      id: genId(),
      dias: s.dias.map(d => ({
        ...d,
        bloques: d.bloques.map(b => ({
          ...b,
          id: genId(),
          ejercicios: b.ejercicios.map(e => ({ ...e, id: genId() })),
        })),
      })),
    }))
    if (clon.adjuntos) {
      clon.adjuntos = clon.adjuntos.map(a => ({ ...a, id: genId() }))
    }
    updateProgramas([...programas, clon])
    return clon
  }, [programas, updateProgramas])

  const añadirSemana = useCallback((programaId: string) => {
    mutarPrograma(programaId, p => ({
      ...p,
      semanas: [...p.semanas, semanaVacia(p.semanas.length + 1)],
    }))
  }, [mutarPrograma])

  const borrarSemana = useCallback((programaId: string, semanaId: string) => {
    mutarPrograma(programaId, p => ({
      ...p,
      semanas: p.semanas
        .filter(s => s.id !== semanaId)
        .map((s, i) => ({ ...s, numero: i + 1 })),
    }))
  }, [mutarPrograma])

  // ── Adjuntos del programa ──
  const añadirAdjunto = useCallback((programaId: string, adjunto: Omit<Adjunto, 'id' | 'subidoEn'>) => {
    const nuevo: Adjunto = {
      ...adjunto,
      id: genId(),
      subidoEn: new Date().toISOString(),
    }
    mutarPrograma(programaId, p => ({
      ...p,
      adjuntos: [...(p.adjuntos ?? []), nuevo],
    }))
  }, [mutarPrograma])

  const borrarAdjunto = useCallback((programaId: string, adjuntoId: string) => {
    mutarPrograma(programaId, p => ({
      ...p,
      adjuntos: (p.adjuntos ?? []).filter(a => a.id !== adjuntoId),
    }))
  }, [mutarPrograma])

  // ── Bloques en días ──
  const añadirBloqueAlDia = useCallback((
    programaId: string, semanaId: string, diaIdx: number,
    bloque: Omit<Bloque, 'id' | 'creadoEn'>,
  ) => {
    const nuevo: Bloque = { ...bloque, id: genId(), creadoEn: new Date().toISOString() }
    mutarPrograma(programaId, p => ({
      ...p,
      semanas: p.semanas.map(s => s.id !== semanaId ? s : {
        ...s,
        dias: s.dias.map((d, i) => i !== diaIdx ? d : {
          ...d, bloques: [...d.bloques, nuevo],
        }),
      }),
    }))
    // Si se marca como plantilla, guardarla también
    if (bloque.esPlantilla) {
      const plantilla: Bloque = { ...nuevo, esPlantilla: true }
      updatePlantillas([...plantillas, plantilla])
    }
  }, [mutarPrograma, plantillas, updatePlantillas])

  const editarBloqueDelDia = useCallback((
    programaId: string, semanaId: string, diaIdx: number,
    bloqueId: string, data: Partial<Omit<Bloque, 'id' | 'creadoEn'>>,
  ) => {
    mutarPrograma(programaId, p => ({
      ...p,
      semanas: p.semanas.map(s => s.id !== semanaId ? s : {
        ...s,
        dias: s.dias.map((d, i) => i !== diaIdx ? d : {
          ...d,
          bloques: d.bloques.map(b => b.id !== bloqueId ? b : { ...b, ...data }),
        }),
      }),
    }))
  }, [mutarPrograma])

  const borrarBloqueDelDia = useCallback((
    programaId: string, semanaId: string, diaIdx: number, bloqueId: string,
  ) => {
    mutarPrograma(programaId, p => ({
      ...p,
      semanas: p.semanas.map(s => s.id !== semanaId ? s : {
        ...s,
        dias: s.dias.map((d, i) => i !== diaIdx ? d : {
          ...d, bloques: d.bloques.filter(b => b.id !== bloqueId),
        }),
      }),
    }))
  }, [mutarPrograma])

  /** Copia profunda de un bloque con ids nuevos (bloque + ejercicios) */
  const clonarBloque = (b: Bloque): Bloque => ({
    ...JSON.parse(JSON.stringify(b)),
    id: genId(),
    creadoEn: new Date().toISOString(),
    esPlantilla: false,
    ejercicios: b.ejercicios.map(e => ({ ...e, id: genId() })),
  })

  const duplicarBloqueDelDia = useCallback((
    programaId: string, semanaId: string, diaIdx: number, bloqueId: string,
  ) => {
    mutarPrograma(programaId, p => ({
      ...p,
      semanas: p.semanas.map(s => s.id !== semanaId ? s : {
        ...s,
        dias: s.dias.map((d, i) => {
          if (i !== diaIdx) return d
          const idx = d.bloques.findIndex(b => b.id === bloqueId)
          if (idx < 0) return d
          const copia = clonarBloque(d.bloques[idx])
          const bloques = [...d.bloques]
          bloques.splice(idx + 1, 0, copia) // insertar justo después del original
          return { ...d, bloques }
        }),
      }),
    }))
  }, [mutarPrograma])

  const moverBloque = useCallback((
    programaId: string,
    origen: { semanaId: string; diaIdx: number; bloqueId: string },
    destino: { semanaId: string; diaIdx: number },
    copiar = false,
  ) => {
    // Mismo día y mismo sitio → nada que hacer
    if (!copiar && origen.semanaId === destino.semanaId && origen.diaIdx === destino.diaIdx) return

    mutarPrograma(programaId, p => {
      // Localizar el bloque de origen
      let bloque: Bloque | undefined
      p.semanas.forEach(s => {
        if (s.id !== origen.semanaId) return
        const dia = s.dias[origen.diaIdx]
        bloque = dia?.bloques.find(b => b.id === origen.bloqueId)
      })
      if (!bloque) return p

      const aInsertar = copiar ? clonarBloque(bloque) : bloque

      return {
        ...p,
        semanas: p.semanas.map(s => {
          let dias = s.dias
          // Quitar del origen (si no es copia)
          if (!copiar && s.id === origen.semanaId) {
            dias = dias.map((d, i) => i !== origen.diaIdx ? d : {
              ...d, bloques: d.bloques.filter(b => b.id !== origen.bloqueId),
            })
          }
          // Añadir al destino
          if (s.id === destino.semanaId) {
            dias = dias.map((d, i) => i !== destino.diaIdx ? d : {
              ...d, bloques: [...d.bloques, aInsertar],
            })
          }
          return dias === s.dias ? s : { ...s, dias }
        }),
      }
    })
  }, [mutarPrograma])

  // ── Plantillas ──
  const crearPlantilla = useCallback((data: Omit<Bloque, 'id' | 'creadoEn' | 'esPlantilla'>) => {
    const nueva: Bloque = { ...data, id: genId(), esPlantilla: true, creadoEn: new Date().toISOString() }
    updatePlantillas([...plantillas, nueva])
  }, [plantillas, updatePlantillas])

  const editarPlantilla = useCallback((id: string, data: Partial<Omit<Bloque, 'id' | 'creadoEn'>>) => {
    updatePlantillas(plantillas.map(p => p.id === id ? { ...p, ...data } : p))
  }, [plantillas, updatePlantillas])

  const borrarPlantilla = useCallback((id: string) => {
    updatePlantillas(plantillas.filter(p => p.id !== id))
  }, [plantillas, updatePlantillas])

  /** Clona una plantilla de bloque con nuevo nombre */
  const clonarPlantilla = useCallback((id: string, nuevoNombre: string): Bloque | null => {
    const original = plantillas.find(p => p.id === id)
    if (!original) return null
    const clon: Bloque = {
      ...JSON.parse(JSON.stringify(original)),
      id: genId(),
      nombre: nuevoNombre,
      creadoEn: new Date().toISOString(),
      ejercicios: original.ejercicios.map(e => ({ ...e, id: genId() })),
    }
    updatePlantillas([...plantillas, clon])
    return clon
  }, [plantillas, updatePlantillas])

  return (
    <Ctx.Provider value={{
      programas, crearPrograma, editarPrograma, borrarPrograma, añadirSemana, borrarSemana,
      añadirAdjunto, borrarAdjunto, clonarPrograma,
      añadirBloqueAlDia, editarBloqueDelDia, borrarBloqueDelDia, duplicarBloqueDelDia, moverBloque,
      plantillas, crearPlantilla, editarPlantilla, borrarPlantilla, clonarPlantilla,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePlanificacion() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlanificacion debe usarse dentro de PlanificacionProvider')
  return ctx
}
