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

export interface ProgramaAsociado {
  programaId: string
  /** Solo para recurrentes: lunes de inicio de este programa */
  fechaInicio: string | null
}

export interface CatalogoSuscripcion {
  id: string
  nombre: string
  programas: ProgramaAsociado[]   // lista (antes era un solo programaId)
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

// ─── Calendario personal de cliente ──────────────────────────────────────────
export interface DiaCalendario {
  fecha: string        // "2025-06-02"
  diaSemana: number    // 0=Lun … 6=Dom
  bloques: Bloque[]    // copia editable del programa original
}

export interface SemanaCalendario {
  id: string
  numero: number
  fechaLunes: string   // "2025-06-02"
  dias: DiaCalendario[]  // siempre 7
}

// Paleta de colores para diferenciar calendarios
export const CALENDAR_COLORS = [
  { key: 'yellow',  accent: '#F5C300', cls: 'border-tn-yellow/60 bg-tn-yellow/5',  badge: 'bg-tn-yellow/20 text-tn-yellow'   },
  { key: 'blue',    accent: '#60A5FA', cls: 'border-blue-400/60 bg-blue-400/5',    badge: 'bg-blue-400/20 text-blue-400'      },
  { key: 'purple',  accent: '#A78BFA', cls: 'border-purple-400/60 bg-purple-400/5',badge: 'bg-purple-400/20 text-purple-400'  },
  { key: 'green',   accent: '#34D399', cls: 'border-green-400/60 bg-green-400/5',  badge: 'bg-green-400/20 text-green-400'    },
  { key: 'orange',  accent: '#FB923C', cls: 'border-orange-400/60 bg-orange-400/5',badge: 'bg-orange-400/20 text-orange-400'  },
] as const

export interface CalendarioCliente {
  id: string
  clienteId: string
  suscripcionClienteId: string
  programaId: string
  programaNombre: string
  fechaInicio: string
  semanas: SemanaCalendario[]
  creadoEn: string
  colorKey: string   // ref a CALENDAR_COLORS[].key
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
