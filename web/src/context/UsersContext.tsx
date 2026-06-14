import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { type Usuario } from '../types'
import { saveKV, apiCreateUser, refreshFromServer } from '../lib/storage'

// ─── Datos iniciales ──────────────────────────────────────────────────────────
const INITIAL_USERS: Usuario[] = [
  {
    id: '1',
    nombre: 'Administrador',
    apellido: '',
    email: 'admin@trainingnorte.com',
    username: 'admin',
    password: 'admin',
    rol: 'administrador',
    activo: true,
    creadoEn: '2024-01-01T00:00:00.000Z',
    bajaEn: null,
  },
]

const STORAGE_KEY = 'im_users'

function loadUsers(): Usuario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_USERS
    const parsed: Usuario[] = JSON.parse(raw)
    // Migración: si algún usuario antiguo no tiene username/password, lo inicializamos
    return parsed.map(u => ({
      ...u,
      username: u.username ?? '',
      password: u.password ?? '',
    }))
  } catch {
    return INITIAL_USERS
  }
}

function saveUsers(users: Usuario[]) {
  saveKV(STORAGE_KEY, users)
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface UsersContextValue {
  users: Usuario[]
  crear: (data: Omit<Usuario, 'id' | 'creadoEn' | 'bajaEn'>) => Promise<void>
  editar: (id: string, data: Partial<Omit<Usuario, 'id' | 'creadoEn'>>) => void
  borrar: (id: string) => void
  toggleActivo: (id: string) => void
}

const UsersContext = createContext<UsersContextValue | null>(null)

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<Usuario[]>(loadUsers)

  // Refrescar desde el servidor cuando otra operación lo solicita
  useEffect(() => {
    const h = () => setUsers(loadUsers())
    window.addEventListener('im-data-refreshed', h)
    return () => window.removeEventListener('im-data-refreshed', h)
  }, [])

  const update = useCallback((next: Usuario[]) => {
    setUsers(next)
    saveUsers(next)
  }, [])

  // Crear pasa por la API REST (validación y hash en el servidor)
  const crear = useCallback(async (data: Omit<Usuario, 'id' | 'creadoEn' | 'bajaEn'>) => {
    await apiCreateUser(data)
    await refreshFromServer()
  }, [])

  const editar = useCallback((id: string, data: Partial<Omit<Usuario, 'id' | 'creadoEn'>>) => {
    const current = loadUsers()
    const next = current.map(u => {
      if (u.id !== id) return u
      const updated = { ...u, ...data }
      if (!updated.activo && !u.bajaEn) updated.bajaEn = new Date().toISOString()
      if (updated.activo) updated.bajaEn = null
      return updated
    })
    update(next)
  }, [update])

  const borrar = useCallback((id: string) => {
    update(loadUsers().filter(u => u.id !== id))
  }, [update])

  const toggleActivo = useCallback((id: string) => {
    const u = loadUsers().find(u => u.id === id)
    if (u) editar(id, { activo: !u.activo })
  }, [editar])

  return (
    <UsersContext.Provider value={{ users, crear, editar, borrar, toggleActivo }}>
      {children}
    </UsersContext.Provider>
  )
}

export function useUsers() {
  const ctx = useContext(UsersContext)
  if (!ctx) throw new Error('useUsers debe usarse dentro de UsersProvider')
  return ctx
}
