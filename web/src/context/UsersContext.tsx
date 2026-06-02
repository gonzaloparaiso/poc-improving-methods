import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Usuario } from '../types'

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
}

// ─── Helpers de autenticación (usados por Login) ──────────────────────────────
export function loginConCredenciales(
  username: string,
  password: string,
): Usuario | null {
  const users = loadUsers()
  return (
    users.find(
      u => u.activo && u.username === username && u.password === password,
    ) ?? null
  )
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface UsersContextValue {
  users: Usuario[]
  crear: (data: Omit<Usuario, 'id' | 'creadoEn' | 'bajaEn'>) => void
  editar: (id: string, data: Partial<Omit<Usuario, 'id' | 'creadoEn'>>) => void
  borrar: (id: string) => void
  toggleActivo: (id: string) => void
}

const UsersContext = createContext<UsersContextValue | null>(null)

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<Usuario[]>(loadUsers)

  const update = useCallback((next: Usuario[]) => {
    setUsers(next)
    saveUsers(next)
  }, [])

  const crear = useCallback((data: Omit<Usuario, 'id' | 'creadoEn' | 'bajaEn'>) => {
    const nuevo: Usuario = {
      ...data,
      id: crypto.randomUUID(),
      creadoEn: new Date().toISOString(),
      bajaEn: null,
    }
    update([...loadUsers(), nuevo])
  }, [update])

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
