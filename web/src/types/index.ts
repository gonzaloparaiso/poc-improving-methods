// ─── Roles (sin cliente — los clientes tienen su propio módulo) ───────────────
export type Rol = 'administrador' | 'head_coach' | 'coach'

export const ROLES: { value: Rol; label: string; color: string }[] = [
  { value: 'administrador', label: 'Administrador', color: 'yellow' },
  { value: 'head_coach',    label: 'Head Coach',    color: 'purple' },
  { value: 'coach',         label: 'Coach',         color: 'blue'   },
]

// ─── Usuario (staff del sistema) ──────────────────────────────────────────────
export interface Usuario {
  id: string
  nombre: string
  apellido: string
  email: string
  username: string
  password: string      // plain text para el POC
  rol: Rol
  activo: boolean
  creadoEn: string
  bajaEn: string | null
}

// ─── Permisos ─────────────────────────────────────────────────────────────────
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
}

export function puedeHacer(rol: Rol, seccion: Seccion, accion: Accion): boolean {
  return PERMISOS[rol]?.[seccion]?.includes(accion) ?? false
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
export interface Cliente {
  id: string
  nombre: string
  apellido: string
  email: string         // usado para login del portal cliente
  username: string      // alias / nombre de usuario
  password: string      // usado para login del portal cliente
  activo: boolean
  creadoEn: string
  bajaEn: string | null
  suscripcionesIds: string[]  // refs a SuscripcionCliente[]
}

// ─── Suscripciones ────────────────────────────────────────────────────────────
export type TipoSuscripcion = 'unico' | 'recurrente'

export interface CatalogoSuscripcion {
  id: string
  nombre: string
  programaId: string | null     // ref a Programa (puede no tener programa aún)
  tipo: TipoSuscripcion
  creadoEn: string
}

export interface SuscripcionCliente {
  id: string
  catalogoId: string            // ref a CatalogoSuscripcion
  clienteId: string
  fechaInicio: string
  activa: boolean
}

// ─── Planificación ────────────────────────────────────────────────────────────
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export type DiaSemana = typeof DIAS_SEMANA[number]

export interface EjercicioEnBloque {
  id: string
  ejercicioId: string
  series: string
  reps: string
  descanso: string
  notas: string
}

export interface Bloque {
  id: string
  nombre: string
  instrucciones: string
  notas: string
  cronometro: string
  ejercicios: EjercicioEnBloque[]
  esPlantilla: boolean
  creadoEn: string
}

export interface DiaPrograma {
  bloques: Bloque[]
}

export interface Semana {
  id: string
  numero: number
  dias: DiaPrograma[]
}

export interface Programa {
  id: string
  nombre: string
  descripcion: string
  semanas: Semana[]
  creadoEn: string
}
