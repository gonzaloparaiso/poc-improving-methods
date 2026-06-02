import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Cliente, type CatalogoSuscripcion, type SuscripcionCliente, type TipoSuscripcion } from '../types'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
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
  crearCatalogo: (data: { nombre: string; programaId: string | null; tipo: TipoSuscripcion }) => void
  editarCatalogo: (id: string, data: Partial<{ nombre: string; programaId: string | null; tipo: TipoSuscripcion }>) => void
  borrarCatalogo: (id: string) => void

  // Suscripciones de clientes
  suscripciones: SuscripcionCliente[]
  asignarSuscripcion: (clienteId: string, catalogoId: string) => void
  desactivarSuscripcion: (id: string) => void
  borrarSuscripcion: (id: string) => void
  suscripcionesDeCliente: (clienteId: string) => SuscripcionCliente[]

  // Auth portal clientes
  loginCliente: (email: string, password: string) => Cliente | null
}

const Ctx = createContext<ClientesContextValue | null>(null)

export function ClientesProvider({ children }: { children: ReactNode }) {
  const [clientes, setClientes]       = useState<Cliente[]>(() => load(KEY_CLIENTES, []))
  const [catalogo, setCatalogo]       = useState<CatalogoSuscripcion[]>(() => load(KEY_CATALOGO, []))
  const [suscripciones, setSuscs]     = useState<SuscripcionCliente[]>(() => load(KEY_SUSCS, []))

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
  const crearCatalogo = useCallback((data: { nombre: string; programaId: string | null; tipo: TipoSuscripcion }) => {
    const nueva: CatalogoSuscripcion = { ...data, id: genId(), creadoEn: new Date().toISOString() }
    updCatalogo([...catalogo, nueva])
  }, [catalogo, updCatalogo])

  const editarCatalogo = useCallback((id: string, data: Partial<{ nombre: string; programaId: string | null; tipo: TipoSuscripcion }>) => {
    updCatalogo(catalogo.map(c => c.id === id ? { ...c, ...data } : c))
  }, [catalogo, updCatalogo])

  const borrarCatalogo = useCallback((id: string) => {
    updCatalogo(catalogo.filter(c => c.id !== id))
  }, [catalogo, updCatalogo])

  // ── Suscripciones de clientes ──
  const asignarSuscripcion = useCallback((clienteId: string, catalogoId: string) => {
    const nueva: SuscripcionCliente = {
      id: genId(), catalogoId, clienteId,
      fechaInicio: new Date().toISOString(), activa: true,
    }
    updSuscs([...suscripciones, nueva])
  }, [suscripciones, updSuscs])

  const desactivarSuscripcion = useCallback((id: string) => {
    updSuscs(suscripciones.map(s => s.id === id ? { ...s, activa: false } : s))
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
      suscripciones, asignarSuscripcion, desactivarSuscripcion, borrarSuscripcion, suscripcionesDeCliente,
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
