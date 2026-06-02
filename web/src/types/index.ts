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

// ─── Planificación ────────────────────────────────────────────────────────────

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export type DiaSemana = typeof DIAS_SEMANA[number]

export interface EjercicioEnBloque {
  id: string           // id local dentro del bloque
  ejercicioId: string  // ref a EJERCICIOS[]
  series: string       // "3", "AMRAP"
  reps: string         // "10", "10-12", "Max"
  descanso: string     // "60s", "2 min"
  notas: string
}

export interface Bloque {
  id: string
  nombre: string
  instrucciones: string
  notas: string
  cronometro: string           // "20:00", "" si no tiene
  ejercicios: EjercicioEnBloque[]
  esPlantilla: boolean
  creadoEn: string
}

export interface DiaPrograma {
  // índice 0-6 implícito por posición en el array
  bloques: Bloque[]
}

export interface Semana {
  id: string
  numero: number
  dias: DiaPrograma[]  // siempre 7 elementos
}

export interface Programa {
  id: string
  nombre: string
  descripcion: string
  semanas: Semana[]
  creadoEn: string
}
