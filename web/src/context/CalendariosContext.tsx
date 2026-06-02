import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import {
  type CalendarioCliente, type SemanaCalendario, type DiaCalendario,
  type Bloque, type Programa,
} from '../types'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

/** Siguiente lunes estricto (si hoy es lunes, devuelve hoy mismo) */
export function siguienteLunes(): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dow = hoy.getDay() // 0=Dom,1=Lun…6=Sab
  const diasHasta = dow === 1 ? 0 : (1 - dow + 7) % 7
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() + diasHasta)
  return lunes.toISOString().split('T')[0]
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// ── Crear semanas con fechas reales desde el programa ─────────────────────────
function instanciarPrograma(programa: Programa, fechaInicio: string): SemanaCalendario[] {
  return programa.semanas.map((semana, si) => {
    const fechaLunes = addDays(fechaInicio, si * 7)
    const dias: DiaCalendario[] = semana.dias.map((dia, di) => ({
      fecha: addDays(fechaLunes, di),
      diaSemana: di,
      // deep-copy de los bloques para que sean independientes del programa
      bloques: JSON.parse(JSON.stringify(dia.bloques)) as Bloque[],
    }))
    return { id: genId(), numero: semana.numero, fechaLunes, dias }
  })
}

// ── Storage ───────────────────────────────────────────────────────────────────
const KEY = 'im_calendarios'
function load<T>(key: string, fb: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb }
}
function save<T>(key: string, v: T) { localStorage.setItem(key, JSON.stringify(v)) }

// ── Context ───────────────────────────────────────────────────────────────────
interface CalendariosCtxValue {
  calendarios: CalendarioCliente[]
  crearCalendario: (
    clienteId: string, suscripcionClienteId: string,
    programa: Programa, fechaInicio?: string, colorKey?: string,
  ) => CalendarioCliente
  borrarCalendario: (id: string) => void
  calendariosDeCliente: (clienteId: string) => CalendarioCliente[]

  // Edición de bloques en el calendario
  añadirBloque:  (calId: string, semanaId: string, diaIdx: number, data: Omit<Bloque, 'id' | 'creadoEn'>) => void
  editarBloque:  (calId: string, semanaId: string, diaIdx: number, bloqueId: string, data: Partial<Omit<Bloque, 'id' | 'creadoEn'>>) => void
  borrarBloque:  (calId: string, semanaId: string, diaIdx: number, bloqueId: string) => void
}

const Ctx = createContext<CalendariosCtxValue | null>(null)

export function CalendariosProvider({ children }: { children: ReactNode }) {
  const [calendarios, setCalendarios] = useState<CalendarioCliente[]>(() => load(KEY, []))

  const upd = useCallback((next: CalendarioCliente[]) => {
    setCalendarios(next); save(KEY, next)
  }, [])

  const mutarCal = useCallback((id: string, fn: (c: CalendarioCliente) => CalendarioCliente) => {
    upd(calendarios.map(c => c.id === id ? fn(c) : c))
  }, [calendarios, upd])

  const crearCalendario = useCallback((
    clienteId: string, suscripcionClienteId: string,
    programa: Programa, fechaInicio?: string, colorKey?: string,
  ): CalendarioCliente => {
    // Leer estado fresco (no del closure) para soportar varias llamadas seguidas
    const actuales = load<CalendarioCliente[]>(KEY, [])
    const inicio = fechaInicio ?? siguienteLunes()
    const palette = ['yellow','blue','purple','green','orange']

    // Color por suscripción: si ya existe un calendario de la misma suscripción, reutiliza su color
    const delCliente = actuales.filter(c => c.clienteId === clienteId)
    const mismaSusc = delCliente.find(c => c.suscripcionClienteId === suscripcionClienteId)
    const suscsDistintas = Array.from(new Set(delCliente.map(c => c.suscripcionClienteId)))
    const color = colorKey
      ?? mismaSusc?.colorKey
      ?? palette[suscsDistintas.length % palette.length]
    const nuevo: CalendarioCliente = {
      id: genId(),
      clienteId,
      suscripcionClienteId,
      programaId: programa.id,
      programaNombre: programa.nombre,
      fechaInicio: inicio,
      semanas: instanciarPrograma(programa, inicio),
      creadoEn: new Date().toISOString(),
      colorKey: color,
    }
    upd([...actuales, nuevo])
    return nuevo
  }, [upd])

  const borrarCalendario = useCallback((id: string) => {
    upd(calendarios.filter(c => c.id !== id))
  }, [calendarios, upd])

  const calendariosDeCliente = useCallback((clienteId: string) =>
    calendarios.filter(c => c.clienteId === clienteId),
  [calendarios])

  const añadirBloque = useCallback((
    calId: string, semanaId: string, diaIdx: number,
    data: Omit<Bloque, 'id' | 'creadoEn'>,
  ) => {
    const nuevo: Bloque = { ...data, id: genId(), creadoEn: new Date().toISOString() }
    mutarCal(calId, c => ({
      ...c,
      semanas: c.semanas.map(s => s.id !== semanaId ? s : {
        ...s, dias: s.dias.map((d, i) => i !== diaIdx ? d : { ...d, bloques: [...d.bloques, nuevo] }),
      }),
    }))
  }, [mutarCal])

  const editarBloque = useCallback((
    calId: string, semanaId: string, diaIdx: number,
    bloqueId: string, data: Partial<Omit<Bloque, 'id' | 'creadoEn'>>,
  ) => {
    mutarCal(calId, c => ({
      ...c,
      semanas: c.semanas.map(s => s.id !== semanaId ? s : {
        ...s, dias: s.dias.map((d, i) => i !== diaIdx ? d : {
          ...d, bloques: d.bloques.map(b => b.id !== bloqueId ? b : { ...b, ...data }),
        }),
      }),
    }))
  }, [mutarCal])

  const borrarBloque = useCallback((
    calId: string, semanaId: string, diaIdx: number, bloqueId: string,
  ) => {
    mutarCal(calId, c => ({
      ...c,
      semanas: c.semanas.map(s => s.id !== semanaId ? s : {
        ...s, dias: s.dias.map((d, i) => i !== diaIdx ? d : {
          ...d, bloques: d.bloques.filter(b => b.id !== bloqueId),
        }),
      }),
    }))
  }, [mutarCal])

  return (
    <Ctx.Provider value={{
      calendarios, crearCalendario, borrarCalendario, calendariosDeCliente,
      añadirBloque, editarBloque, borrarBloque,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCalendarios() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCalendarios debe usarse dentro de CalendariosProvider')
  return ctx
}
