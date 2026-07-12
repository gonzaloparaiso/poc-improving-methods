import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { type ContenidoItem } from '../types'
import { RESPIRACIONES_SEED } from '../data/respiraciones'
import { saveKV } from '../lib/storage'
import * as kv from '../lib/kv'

function genId(prefijo: string) {
  return `${prefijo}_` + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const KEY_RESPIRACIONES = 'im_respiraciones'
const KEY_MOVILIDAD = 'im_movilidad'

function loadRespiraciones(): ContenidoItem[] {
  try {
    const raw = kv.get(KEY_RESPIRACIONES)
    if (!raw) return RESPIRACIONES_SEED
    const parsed = JSON.parse(raw) as ContenidoItem[]
    return parsed.length > 0 ? parsed : RESPIRACIONES_SEED
  } catch { return RESPIRACIONES_SEED }
}
function loadMovilidad(): ContenidoItem[] {
  try {
    const raw = kv.get(KEY_MOVILIDAD)
    return raw ? (JSON.parse(raw) as ContenidoItem[]) : []
  } catch { return [] }
}

type DatosContenido = Omit<ContenidoItem, 'id' | 'creadoEn'>

interface CtxValue {
  respiraciones: ContenidoItem[]
  crearRespiracion: (data: DatosContenido) => ContenidoItem
  editarRespiracion: (id: string, data: Partial<DatosContenido>) => void
  borrarRespiracion: (id: string) => void

  movilidad: ContenidoItem[]
  crearMovilidad: (data: DatosContenido) => ContenidoItem
  editarMovilidad: (id: string, data: Partial<DatosContenido>) => void
  borrarMovilidad: (id: string) => void
}

const Ctx = createContext<CtxValue | null>(null)

export function ContenidoProvider({ children }: { children: ReactNode }) {
  const [respiraciones, setRespiraciones] = useState<ContenidoItem[]>(() => loadRespiraciones())
  const [movilidad, setMovilidad] = useState<ContenidoItem[]>(() => loadMovilidad())

  // Refrescar desde el servidor cuando otra operación lo solicita
  useEffect(() => {
    const h = () => { setRespiraciones(loadRespiraciones()); setMovilidad(loadMovilidad()) }
    window.addEventListener('im-data-refreshed', h)
    return () => window.removeEventListener('im-data-refreshed', h)
  }, [])

  const updRespiraciones = useCallback((next: ContenidoItem[]) => {
    setRespiraciones(next); saveKV(KEY_RESPIRACIONES, next)
  }, [])
  const updMovilidad = useCallback((next: ContenidoItem[]) => {
    setMovilidad(next); saveKV(KEY_MOVILIDAD, next)
  }, [])

  const crearRespiracion = useCallback((data: DatosContenido): ContenidoItem => {
    const nuevo: ContenidoItem = { ...data, id: genId('resp'), creadoEn: new Date().toISOString() }
    updRespiraciones([...respiraciones, nuevo])
    return nuevo
  }, [respiraciones, updRespiraciones])

  const editarRespiracion = useCallback((id: string, data: Partial<DatosContenido>) => {
    updRespiraciones(respiraciones.map(r => r.id === id ? { ...r, ...data } : r))
  }, [respiraciones, updRespiraciones])

  const borrarRespiracion = useCallback((id: string) => {
    updRespiraciones(respiraciones.filter(r => r.id !== id))
  }, [respiraciones, updRespiraciones])

  const crearMovilidad = useCallback((data: DatosContenido): ContenidoItem => {
    const nuevo: ContenidoItem = { ...data, id: genId('mov'), creadoEn: new Date().toISOString() }
    updMovilidad([...movilidad, nuevo])
    return nuevo
  }, [movilidad, updMovilidad])

  const editarMovilidad = useCallback((id: string, data: Partial<DatosContenido>) => {
    updMovilidad(movilidad.map(r => r.id === id ? { ...r, ...data } : r))
  }, [movilidad, updMovilidad])

  const borrarMovilidad = useCallback((id: string) => {
    updMovilidad(movilidad.filter(r => r.id !== id))
  }, [movilidad, updMovilidad])

  return (
    <Ctx.Provider value={{
      respiraciones, crearRespiracion, editarRespiracion, borrarRespiracion,
      movilidad, crearMovilidad, editarMovilidad, borrarMovilidad,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useContenido() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useContenido debe usarse dentro de ContenidoProvider')
  return ctx
}
