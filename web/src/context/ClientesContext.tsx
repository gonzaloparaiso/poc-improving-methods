import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Cliente, type CatalogoSuscripcion, type SuscripcionCliente, type TipoSuscripcion, type ProgramaAsociado } from '../types'

/** Migra un catalogo item antiguo al nuevo formato (programas[] + precio/prueba) */
function migrarCatalogo(raw: Record<string, unknown>): CatalogoSuscripcion {
  // Defaults para campos nuevos
  const precioMensual = typeof raw.precioMensual === 'number' ? raw.precioMensual : 0
  const primerMesPrueba = raw.primerMesPrueba === true

  if (Array.isArray(raw.programas)) {
    return { ...(raw as unknown as CatalogoSuscripcion), precioMensual, primerMesPrueba }
  }
  // formato antiguo (programaId / fechaInicioPrograma)
  const programaId = raw.programaId as string | null
  const fechaInicio = (raw.fechaInicioPrograma ?? null) as string | null
  return {
    id: raw.id as string,
    nombre: raw.nombre as string,
    tipo: raw.tipo as TipoSuscripcion,
    creadoEn: raw.creadoEn as string,
    programas: programaId ? [{ programaId, fechaInicio }] : [],
    precioMensual,
    primerMesPrueba,
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

/** Una suscripción está vigente si HOY está dentro de [fechaInicio, fechaFin] (ambos inclusive) */
export function suscripcionVigente(s: SuscripcionCliente): boolean {
  if (!s.activa) return false
  const hoy = new Date()
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const inicioISO = s.fechaInicio.split('T')[0]
  return hoyISO >= inicioISO && hoyISO <= s.fechaFin
}

const KEY_CLIENTES    = 'im_clientes'
const KEY_CATALOGO    = 'im_suscripciones_catalogo'
const KEY_SUSCS       = 'im_suscripciones_clientes'

function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}
function save<T>(key: string, val: T) { localStorage.setItem(key, JSON.stringify(val)) }

// ─── Context value ────────────────────────────────────────────────────────────
interface ClientesContextValue {
  // Clientes
  clientes: Cliente[]
  crearCliente: (data: Omit<Cliente, 'id' | 'creadoEn' | 'bajaEn' | 'suscripcionesIds'>) => void
  editarCliente: (id: string, data: Partial<Omit<Cliente, 'id' | 'creadoEn' | 'suscripcionesIds'>>) => void
  borrarCliente: (id: string) => void
  toggleActivoCliente: (id: string) => void

  // Catálogo de suscripciones
  catalogo: CatalogoSuscripcion[]
  crearCatalogo: (data: { nombre: string; programas: ProgramaAsociado[]; tipo: TipoSuscripcion; precioMensual: number; primerMesPrueba: boolean }) => CatalogoSuscripcion
  editarCatalogo: (id: string, data: Partial<{ nombre: string; programas: ProgramaAsociado[]; tipo: TipoSuscripcion; precioMensual: number; primerMesPrueba: boolean }>) => void
  borrarCatalogo: (id: string) => void

  // Suscripciones de clientes
  suscripciones: SuscripcionCliente[]
  asignarSuscripcion: (clienteId: string, catalogoId: string) => void
  desactivarSuscripcion: (id: string) => void
  borrarSuscripcion: (id: string) => void
  editarFechaFin: (id: string, fechaFin: string) => void
  suscripcionesDeCliente: (clienteId: string) => SuscripcionCliente[]

  // Auth portal clientes
  loginCliente: (email: string, password: string) => Cliente | null
}

const Ctx = createContext<ClientesContextValue | null>(null)

export function ClientesProvider({ children }: { children: ReactNode }) {
  const [clientes, setClientes]       = useState<Cliente[]>(() => load(KEY_CLIENTES, []))
  const [catalogo, setCatalogo] = useState<CatalogoSuscripcion[]>(() =>
    (load(KEY_CATALOGO, []) as Record<string, unknown>[]).map(migrarCatalogo)
  )
  const [suscripciones, setSuscs]     = useState<SuscripcionCliente[]>(() =>
    load<SuscripcionCliente[]>(KEY_SUSCS, []).map(s => {
      if (s.fechaFin) return s
      // Migración: calcular fin = inicio + 1 mes + 3 días
      const ini = new Date(s.fechaInicio)
      const fin = new Date(ini)
      fin.setMonth(fin.getMonth() + 1)
      fin.setDate(fin.getDate() + 3)
      return { ...s, fechaFin: `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}` }
    })
  )

  const updClientes = useCallback((next: Cliente[]) => { setClientes(next); save(KEY_CLIENTES, next) }, [])
  const updCatalogo = useCallback((next: CatalogoSuscripcion[]) => { setCatalogo(next); save(KEY_CATALOGO, next) }, [])
  const updSuscs    = useCallback((next: SuscripcionCliente[]) => { setSuscs(next); save(KEY_SUSCS, next) }, [])

  // ── Clientes ──
  const crearCliente = useCallback((data: Omit<Cliente, 'id' | 'creadoEn' | 'bajaEn' | 'suscripcionesIds'>) => {
    const nuevo: Cliente = { ...data, id: genId(), creadoEn: new Date().toISOString(), bajaEn: null, suscripcionesIds: [] }
    updClientes([...clientes, nuevo])
  }, [clientes, updClientes])

  const editarCliente = useCallback((id: string, data: Partial<Omit<Cliente, 'id' | 'creadoEn' | 'suscripcionesIds'>>) => {
    updClientes(clientes.map(c => {
      if (c.id !== id) return c
      const updated = { ...c, ...data }
      if (!updated.activo && !c.bajaEn) updated.bajaEn = new Date().toISOString()
      if (updated.activo) updated.bajaEn = null
      return updated
    }))
  }, [clientes, updClientes])

  const borrarCliente = useCallback((id: string) => {
    updClientes(clientes.filter(c => c.id !== id))
    updSuscs(suscripciones.filter(s => s.clienteId !== id))
  }, [clientes, suscripciones, updClientes, updSuscs])

  const toggleActivoCliente = useCallback((id: string) => {
    const c = clientes.find(c => c.id === id)
    if (c) editarCliente(id, { activo: !c.activo })
  }, [clientes, editarCliente])

  // ── Catálogo ──
  const crearCatalogo = useCallback((data: { nombre: string; programas: ProgramaAsociado[]; tipo: TipoSuscripcion; precioMensual: number; primerMesPrueba: boolean }) => {
    const nueva: CatalogoSuscripcion = { ...data, id: genId(), creadoEn: new Date().toISOString() }
    updCatalogo([...catalogo, nueva])
    return nueva
  }, [catalogo, updCatalogo])

  const editarCatalogo = useCallback((id: string, data: Partial<{ nombre: string; programas: ProgramaAsociado[]; tipo: TipoSuscripcion; precioMensual: number; primerMesPrueba: boolean }>) => {
    updCatalogo(catalogo.map(c => c.id === id ? { ...c, ...data } : c))
  }, [catalogo, updCatalogo])

  const borrarCatalogo = useCallback((id: string) => {
    updCatalogo(catalogo.filter(c => c.id !== id))
  }, [catalogo, updCatalogo])

  // ── Suscripciones de clientes ──
  const asignarSuscripcion = useCallback((clienteId: string, catalogoId: string) => {
    const inicio = new Date()
    // Fin = 1 mes después + 3 días
    const fin = new Date(inicio)
    fin.setMonth(fin.getMonth() + 1)
    fin.setDate(fin.getDate() + 3)
    const finISO = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`

    const nueva: SuscripcionCliente = {
      id: genId(), catalogoId, clienteId,
      fechaInicio: inicio.toISOString(),
      fechaFin: finISO,
      activa: true,
    }
    updSuscs([...suscripciones, nueva])
  }, [suscripciones, updSuscs])

  const desactivarSuscripcion = useCallback((id: string) => {
    updSuscs(suscripciones.map(s => s.id === id ? { ...s, activa: false } : s))
  }, [suscripciones, updSuscs])

  const editarFechaFin = useCallback((id: string, fechaFin: string) => {
    updSuscs(suscripciones.map(s => s.id === id ? { ...s, fechaFin } : s))
  }, [suscripciones, updSuscs])

  const borrarSuscripcion = useCallback((id: string) => {
    updSuscs(suscripciones.filter(s => s.id !== id))
  }, [suscripciones, updSuscs])

  const suscripcionesDeCliente = useCallback((clienteId: string) =>
    suscripciones.filter(s => s.clienteId === clienteId),
  [suscripciones])

  // ── Auth portal clientes ──
  const loginCliente = useCallback((email: string, password: string): Cliente | null =>
    clientes.find(c => c.activo && c.email === email && c.password === password) ?? null,
  [clientes])

  return (
    <Ctx.Provider value={{
      clientes, crearCliente, editarCliente, borrarCliente, toggleActivoCliente,
      catalogo, crearCatalogo, editarCatalogo, borrarCatalogo,
      suscripciones, asignarSuscripcion, desactivarSuscripcion, borrarSuscripcion, editarFechaFin, suscripcionesDeCliente,
      loginCliente,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useClientes() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useClientes debe usarse dentro de ClientesProvider')
  return ctx
}
