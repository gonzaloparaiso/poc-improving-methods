import { puedeHacer as basePuedeHacer, type Rol, type Seccion, type Accion } from '../types'

interface UserSession {
  username: string
  role: string
  nombre: string
}

function getSession(): UserSession | null {
  try {
    const raw = sessionStorage.getItem('im_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function usePermisos() {
  const session = getSession()
  const rol = (session?.role ?? 'coach') as Rol

  return {
    rol,
    esAdmin:    rol === 'administrador',
    esHeadCoach: rol === 'head_coach',
    esCoach:    rol === 'coach',
    puede: (seccion: Seccion, accion: Accion): boolean =>
      basePuedeHacer(rol, seccion, accion),
  }
}
