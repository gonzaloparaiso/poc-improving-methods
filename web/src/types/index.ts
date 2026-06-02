// ─── Roles ────────────────────────────────────────────────────────────────────
export type Rol = 'administrador' | 'head_coach' | 'coach' | 'cliente'

export const ROLES: { value: Rol; label: string; color: string }[] = [
  { value: 'administrador', label: 'Administrador', color: 'yellow' },
  { value: 'head_coach',    label: 'Head Coach',    color: 'purple' },
  { value: 'coach',         label: 'Coach',         color: 'blue'   },
  { value: 'cliente',       label: 'Cliente',       color: 'green'  },
]

// ─── Usuario ──────────────────────────────────────────────────────────────────
export interface Usuario {
  id: string
  nombre: string
  apellido: string
  email: string
  username: string
  password: string      // plain text para el POC
  rol: Rol
  activo: boolean
  creadoEn: string      // ISO date string
  bajaEn: string | null // ISO date string | null
}

// ─── Permisos (preparado para expansión) ─────────────────────────────────────
export type Seccion =
  | 'administracion'
  | 'clientes'
  | 'planificaciones'
  | 'entrenamientos'

export type Accion = 'ver' | 'crear' | 'editar' | 'borrar'

export type MatrizPermisos = Partial<Record<Seccion, Accion[]>>

export const PERMISOS: Record<Rol, MatrizPermisos> = {
  administrador: {
    administracion:  ['ver', 'crear', 'editar', 'borrar'],
    clientes:        ['ver', 'crear', 'editar', 'borrar'],
    planificaciones: ['ver', 'crear', 'editar', 'borrar'],
    entrenamientos:  ['ver', 'crear', 'editar', 'borrar'],
  },
  head_coach: {
    clientes:        ['ver'],
    planificaciones: ['ver', 'crear', 'editar', 'borrar'],
    entrenamientos:  ['ver', 'crear', 'editar', 'borrar'],
  },
  coach: {
    clientes:        ['ver'],
    planificaciones: ['ver', 'crear', 'editar'],
    entrenamientos:  ['ver', 'crear', 'editar'],
  },
  cliente: {
    planificaciones: ['ver'],
    entrenamientos:  ['ver'],
  },
}

export function puedeHacer(rol: Rol, seccion: Seccion, accion: Accion): boolean {
  return PERMISOS[rol]?.[seccion]?.includes(accion) ?? false
}
