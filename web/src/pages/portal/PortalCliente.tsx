import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react'
import { type Cliente, type Bloque, DIAS_SEMANA, CALENDAR_COLORS, type CalendarioCliente } from '../../types'
import { useCalendarios, fmtFecha, addDays } from '../../context/CalendariosContext'
import { useEjercicios } from '../../context/EjerciciosContext'
import { useClientes, suscripcionVigente } from '../../context/ClientesContext'
import BloqueDetalleModal from './BloqueDetalleModal'
import { exportarPDF, exportarExcel, exportarAimharder, exportarWodbuster } from './exporters'
import { apiPortalChangePassword } from '../../lib/storage'
import PasswordInput from '../../components/PasswordInput'

interface Props {
  cliente: Cliente
  onLogout: () => void
}

interface BloqueConColor extends Bloque {
  calId: string
  calNombre: string
  colorKey: string
}

interface DiaFusion {
  fecha: string
  diaSemana: number
  bloques: BloqueConColor[]
}

interface SemanaFusion {
  fechaLunes: string
  dias: DiaFusion[]
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function lunesDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return toISO(date)
}

function fmtFechaLarga(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long',
  })
}

function fusionarCalendarios(cals: CalendarioCliente[]): SemanaFusion[] {
  const semanaMap = new Map<string, DiaFusion[]>()

  cals.forEach(cal => {
    const colorKey = cal.colorKey ?? 'yellow'
    cal.semanas.forEach(semana => {
      const lunes = semana.fechaLunes ?? lunesDe(semana.dias[0]?.fecha ?? '')
      if (!semanaMap.has(lunes)) {
        const dias: DiaFusion[] = DIAS_SEMANA.map((_, i) => ({
          fecha: addDays(lunes, i), diaSemana: i, bloques: [],
        }))
        semanaMap.set(lunes, dias)
      }
      const dias = semanaMap.get(lunes)!
      semana.dias.forEach((dia, diaIdx) => {
        dia.bloques.forEach(bloque => {
          dias[diaIdx]?.bloques.push({ ...bloque, calId: cal.id, calNombre: cal.programaNombre, colorKey })
        })
      })
    })
  })

  return Array.from(semanaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fechaLunes, dias]) => ({ fechaLunes, dias }))
}

type Vista = 'semana' | 'todas' | 'dia'

export default function PortalCliente({ cliente, onLogout }: Props) {
  const { calendariosDeCliente } = useCalendarios()
  const { ejercicios } = useEjercicios()
  const { suscripciones, catalogo } = useClientes()
  const todosCalendarios = calendariosDeCliente(cliente.id)

  // ¿Una suscripción concede acceso a sus programas HOY?
  //  - Pago único: SIEMPRE (no caduca; se ve en la fecha en que se asignó)
  //  - Recurrente: solo si hoy está dentro de [inicio, fin] y activa
  const suscConcedeAcceso = (s: typeof suscripciones[number]): boolean => {
    const cat = catalogo.find(c => c.id === s.catalogoId)
    if (!cat) return false
    if (cat.tipo === 'unico') return s.activa
    return suscripcionVigente(s)
  }

  // Programas a los que el cliente tiene acceso HOY
  const programasVigentes = (() => {
    const ids = new Set<string>()
    suscripciones
      .filter(s => s.clienteId === cliente.id && suscConcedeAcceso(s))
      .forEach(s => {
        const cat = catalogo.find(c => c.id === s.catalogoId)
        cat?.programas.forEach(pa => ids.add(pa.programaId))
      })
    return ids
  })()

  // Un calendario es visible si su programa está cubierto por una suscripción con acceso
  const calVigente = (c: CalendarioCliente) => programasVigentes.has(c.programaId)

  const miscalendarios = todosCalendarios.filter(calVigente)
  const calendariosBloqueados = todosCalendarios.filter(c => !calVigente(c))

  // Suscripciones del cliente que conceden acceso (recurrentes vigentes + pago único)
  const misSuscripcionesVigentes = suscripciones
    .filter(s => s.clienteId === cliente.id && suscConcedeAcceso(s))
    .map(s => ({ susc: s, cat: catalogo.find(c => c.id === s.catalogoId) }))
    .filter(x => x.cat)

  // Suscripciones caducadas: recurrentes del cliente que ya NO conceden acceso
  const misSuscripcionesCaducadas = suscripciones
    .filter(s => s.clienteId === cliente.id && !suscConcedeAcceso(s))
    .map(s => ({ susc: s, cat: catalogo.find(c => c.id === s.catalogoId) }))
    .filter(x => x.cat && x.cat.tipo === 'recurrente')
    .sort((a, b) => b.susc.fechaFin.localeCompare(a.susc.fechaFin)) // más reciente primero

  // Selección de calendarios — por defecto todos los vigentes seleccionados
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    () => new Set(miscalendarios.map(c => c.id))
  )

  // Si aparecen calendarios nuevos vigentes, añadirlos; quitar los que dejen de estar vigentes
  useEffect(() => {
    setSeleccionados(prev => {
      const vigentesIds = new Set(miscalendarios.map(c => c.id))
      const next = new Set<string>()
      // mantener los previos que sigan vigentes
      prev.forEach(id => { if (vigentesIds.has(id)) next.add(id) })
      // añadir nuevos vigentes
      miscalendarios.forEach(c => next.add(c.id))
      // comparar para evitar re-render innecesario
      if (next.size === prev.size && [...next].every(id => prev.has(id))) return prev
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosCalendarios, suscripciones])

  const calsActivos = miscalendarios.filter(c => seleccionados.has(c.id))
  const semanas = useMemo(() => fusionarCalendarios(calsActivos), [calsActivos])

  // En móvil abrimos en vista 'día' (más cómoda); en escritorio, semana completa
  const [vista, setVista]         = useState<Vista>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'dia' : 'semana')
  const [semanaIdx, setSemanaIdx] = useState(0)

  // Indice del día actual relativo al inicio
  const hoyISO = toISO(new Date())
  // Buscar semana de hoy
  const idxHoy = semanas.findIndex(s =>
    s.dias.some(d => d.fecha === hoyISO)
  )

  // Estado para vista día: índice de día seleccionado dentro de la semana
  const [diaIdx, setDiaIdx] = useState(0)

  // Al cargar, saltar a la semana y día de HOY (una sola vez)
  const saltadoAHoy = useRef(false)
  useEffect(() => {
    if (saltadoAHoy.current || semanas.length === 0) return
    if (idxHoy >= 0) {
      setSemanaIdx(idxHoy)
      const d = semanas[idxHoy].dias.findIndex(x => x.fecha === hoyISO)
      if (d >= 0) setDiaIdx(d)
    }
    saltadoAHoy.current = true
  }, [semanas, idxHoy, hoyISO])

  // Bloque seleccionado para ver detalle
  const [bloqueSel, setBloqueSel] = useState<{ bloque: BloqueConColor; fecha: string } | null>(null)

  // Menú de exportar
  const [menuExport, setMenuExport] = useState(false)

  const nombreCompleto = `${cliente.nombre}${cliente.apellido ? ' ' + cliente.apellido : ''}`
  const calsAExportar = calsActivos.length > 0 ? calsActivos : miscalendarios

  const handleExport = (tipo: 'pdf' | 'excel' | 'aimharder' | 'wodbuster') => {
    setMenuExport(false)
    if (tipo === 'pdf')       exportarPDF(calsAExportar, nombreCompleto, ejercicios)
    if (tipo === 'excel')     exportarExcel(calsAExportar, nombreCompleto, ejercicios)
    if (tipo === 'aimharder') exportarAimharder(calsAExportar, nombreCompleto, ejercicios)
    if (tipo === 'wodbuster') exportarWodbuster(calsAExportar, nombreCompleto, ejercicios)
  }

  const toggleCal = (id: string) => {
    const next = new Set(seleccionados)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSeleccionados(next)
  }

  // ─── Renders ────────────────────────────────────────────────────────────────

  const renderBloque = (bloque: BloqueConColor, fecha: string) => {
    const colorDef = CALENDAR_COLORS.find(c => c.key === bloque.colorKey) ?? CALENDAR_COLORS[0]
    return (
      <button
        key={`${bloque.id}-${bloque.calId}`}
        onClick={() => setBloqueSel({ bloque, fecha })}
        className="w-full text-left card p-3 border-l-4 hover:border-tn-yellow/60 transition-all group cursor-pointer"
        style={{ borderLeftColor: colorDef.accent }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorDef.accent }} />
          <span className="text-tn-muted text-xs truncate">{bloque.calNombre}</span>
        </div>
        <p className="text-white font-semibold text-sm leading-tight mb-1 group-hover:text-tn-yellow transition-colors">
          {bloque.nombre}
        </p>
        {bloque.cronometro && (
          <p className="text-xs font-mono mb-1" style={{ color: colorDef.accent }}>
            ⏱ {bloque.cronometro}
          </p>
        )}
        {bloque.ejercicios.length > 0 && (
          <div className="space-y-0.5 mt-1">
            {bloque.ejercicios.slice(0, 3).map(ej => {
              const ejercicio = ejercicios.find(e => e.id === ej.ejercicioId)
              return (
                <p key={ej.id} className="text-tn-muted text-xs truncate">
                  · {ejercicio?.nombre ?? '—'}
                  {ej.series && ej.reps && <span className="text-tn-muted/60"> {ej.series}×{ej.reps}</span>}
                </p>
              )
            })}
            {bloque.ejercicios.length > 3 && (
              <p className="text-tn-muted/60 text-xs">+{bloque.ejercicios.length - 3} más</p>
            )}
          </div>
        )}
      </button>
    )
  }

  const renderSemanaGrid = (semana: SemanaFusion) => (
    <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
      <div className="grid grid-cols-7 gap-2 min-w-[800px]">
        {semana.dias.map(dia => {
          const esHoy = dia.fecha === hoyISO
          return (
            <div key={dia.fecha} className="flex flex-col gap-2">
              <div className={`text-center rounded-lg py-2 ${esHoy ? 'bg-tn-yellow/10 border border-tn-yellow/30' : 'bg-tn-dark border border-tn-border'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${esHoy ? 'text-tn-yellow' : 'text-tn-muted'}`}>
                  {DIAS_SEMANA[dia.diaSemana].slice(0, 3)}
                </p>
                <p className={`text-sm font-black mt-0.5 ${esHoy ? 'text-tn-yellow' : 'text-white'}`}>
                  {new Date(dia.fecha + 'T00:00:00').getDate()}
                </p>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {dia.bloques.length === 0
                  ? <div className="border border-dashed border-tn-border/40 rounded-xl h-12 flex items-center justify-center">
                      <span className="text-tn-muted/40 text-xs">descanso</span>
                    </div>
                  : dia.bloques.map(b => renderBloque(b, dia.fecha))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ─── Render principal ───────────────────────────────────────────────────────

  if (miscalendarios.length === 0) {
    // Distinguir: ¿no tiene nada, o tiene pero todo fuera de fecha (bloqueado)?
    const soloBloqueados = calendariosBloqueados.length > 0
    return (
      <div className="min-h-screen bg-tn-black flex flex-col">
        <Header cliente={cliente} onLogout={onLogout} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-8 text-center">
            {soloBloqueados ? (
              <>
                <div className="w-16 h-16 bg-red-400/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-white font-bold text-xl mb-2">Suscripción caducada</h2>
                <p className="text-tn-muted text-sm mb-5">
                  Tu suscripción no está vigente ahora mismo. Renuévala para volver a ver tu planificación.
                </p>

                {/* Suscripciones recurrentes caducadas del cliente */}
                <div className="space-y-3 text-left">
                  {suscripciones
                    .filter(x => x.clienteId === cliente.id)
                    .map(x => ({ susc: x, cat: catalogo.find(c => c.id === x.catalogoId) }))
                    .filter(x => x.cat && x.cat.tipo === 'recurrente')
                    .map(({ susc, cat }) => (
                      <div key={susc.id} className="bg-tn-dark border border-tn-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{cat!.nombre}</p>
                            <p className="text-red-400/80 text-xs">Caducó el {fmtFecha(susc.fechaFin)}</p>
                          </div>
                          {cat!.precioMensual ? (
                            <span className="text-white font-bold text-sm whitespace-nowrap">{cat!.precioMensual} €/mes</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Renovar ahora{cat!.precioMensual ? ` por ${cat!.precioMensual} €` : ''}
                        </button>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-tn-yellow/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-8 h-8 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-white font-bold text-xl mb-2">Aún no tienes planificación</h2>
                <p className="text-tn-muted text-sm mb-6">
                  Todavía no tienes ningún programa asignado. Descubre nuestros programas en la tienda.
                </p>
                <a
                  href="https://trainingnorte.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Ir a la tienda
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const semanaActual = semanas[semanaIdx]

  return (
    <div className="min-h-screen bg-tn-black flex flex-col">
      <Header cliente={cliente} onLogout={onLogout} />

      <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-5">

        {/* Saludo */}
        <div className="card p-5 lg:p-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 bg-tn-yellow rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-tn-black font-black text-lg">{cliente.nombre.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-[8rem]">
            <h1 className="text-white font-black text-xl truncate">¡Hola, {cliente.nombre}!</h1>
            <p className="text-tn-muted text-sm capitalize">{fmtFechaLarga(hoyISO)}</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <p className="text-tn-yellow font-black text-2xl leading-none">{miscalendarios.length}</p>
              <p className="text-tn-muted text-xs">programa{miscalendarios.length !== 1 ? 's' : ''} activo{miscalendarios.length !== 1 ? 's' : ''}</p>
            </div>
            {/* Botón exportar */}
            <div className="relative">
              <button
                onClick={() => setMenuExport(v => !v)}
                className="btn-secondary flex items-center gap-2 text-sm py-2 px-3"
                title="Exportar planificación"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Exportar</span>
                <svg className={`w-3 h-3 transition-transform ${menuExport ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuExport && (
                <>
                  {/* Backdrop para cerrar al hacer click fuera */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuExport(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 card shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-tn-border">
                      <p className="text-white font-bold text-sm">Exportar planificación</p>
                      <p className="text-tn-muted text-xs mt-0.5">
                        {calsAExportar.length} programa{calsAExportar.length !== 1 ? 's' : ''} seleccionado{calsAExportar.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="py-1">
                      {[
                        { id: 'pdf' as const,       label: 'PDF',        desc: 'Documento imprimible',           color: 'text-red-400' },
                        { id: 'excel' as const,     label: 'Excel',      desc: 'Hoja por programa',              color: 'text-green-400' },
                        { id: 'aimharder' as const, label: 'Aimharder',  desc: 'CSV importable',                 color: 'text-blue-400' },
                        { id: 'wodbuster' as const, label: 'Wodbuster',  desc: 'CSV importable',                 color: 'text-purple-400' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleExport(opt.id)}
                          disabled={calsAExportar.length === 0}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-tn-dark transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className={`w-5 h-5 ${opt.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">{opt.label}</p>
                            <p className="text-tn-muted text-xs">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Suscripciones del cliente */}
        {misSuscripcionesVigentes.length > 0 && (
          <div className="space-y-2">
            {misSuscripcionesVigentes.map(({ susc, cat }) => {
              const esUnico = cat!.tipo === 'unico'
              return (
                <div key={susc.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${esUnico ? 'bg-green-400/10' : 'bg-tn-yellow/10'}`}>
                      <svg className={`w-5 h-5 ${esUnico ? 'text-green-400' : 'text-tn-yellow'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{cat!.nombre}</p>
                      <p className="text-tn-muted text-xs">
                        {esUnico
                          ? `Acceso permanente${cat!.precioMensual ? ` · ${cat!.precioMensual} €` : ''}`
                          : `Activa hasta ${fmtFecha(susc.fechaFin)}${cat!.precioMensual ? ` · ${cat!.precioMensual} €/mes` : ''}`}
                      </p>
                    </div>
                  </div>
                  {esUnico ? (
                    <a
                      href="https://trainingnorte.com/atletas/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex items-center gap-2 text-sm py-2 px-4 whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      Ver programas para atletas
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href="https://trainingnorte.com/tn-box/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary flex items-center gap-2 text-sm py-2 px-4 whitespace-nowrap"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        Ver otras suscripciones
                      </a>
                      <button
                        type="button"
                        className="btn-primary flex items-center gap-2 text-sm py-2 px-4 whitespace-nowrap"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Renovar ahora{cat!.precioMensual ? ` por ${cat!.precioMensual} €` : ''}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Selector de programas */}
        {miscalendarios.length > 1 && (
          <div className="space-y-2">
            <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">Programas</p>
            <div className="flex flex-wrap gap-2">
              {miscalendarios.map(cal => {
                const colorDef = CALENDAR_COLORS.find(c => c.key === cal.colorKey) ?? CALENDAR_COLORS[0]
                const active = seleccionados.has(cal.id)
                return (
                  <button
                    key={cal.id}
                    onClick={() => toggleCal(cal.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      active ? colorDef.cls : 'border-tn-border text-tn-muted hover:border-tn-muted opacity-60'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorDef.accent }} />
                    <span style={active ? { color: colorDef.accent } : {}}>{cal.programaNombre}</span>
                    {active && (
                      <svg className="w-3.5 h-3.5" style={{ color: colorDef.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-tn-muted text-xs">Toca para mostrar u ocultar un programa del calendario</p>
          </div>
        )}

        {/* PDFs adjuntos de los programas seleccionados */}
        {(() => {
          const pdfs = calsActivos.flatMap(cal =>
            (cal.adjuntos ?? []).map(a => ({ ...a, programa: cal.programaNombre, colorKey: cal.colorKey }))
          )
          if (pdfs.length === 0) return null
          const descargar = (dataUrl: string, nombre: string) => {
            const a = document.createElement('a')
            a.href = dataUrl; a.download = nombre
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
          }
          return (
            <div className="space-y-2">
              <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Documentos
              </p>
              <div className="flex flex-wrap gap-2">
                {pdfs.map(p => {
                  const colorDef = CALENDAR_COLORS.find(c => c.key === p.colorKey) ?? CALENDAR_COLORS[0]
                  return (
                    <button key={p.id}
                      onClick={() => descargar(p.dataUrl, p.nombre)}
                      className="flex items-center gap-2.5 bg-tn-card border border-tn-border rounded-xl px-3 py-2 hover:border-tn-yellow transition-all group max-w-full">
                      <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
                        </svg>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-white text-sm font-semibold truncate max-w-[180px] group-hover:text-tn-yellow transition-colors">
                          {p.nombre}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorDef.accent }} />
                          <span className="text-tn-muted text-xs truncate">{p.programa}</span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-tn-muted group-hover:text-tn-yellow flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Selector vista */}
        <div className="flex gap-1 bg-tn-dark border border-tn-border rounded-xl p-1 w-fit">
          {([
            { id: 'dia' as Vista,    label: 'Día'    },
            { id: 'semana' as Vista, label: 'Semana' },
            { id: 'todas' as Vista,  label: 'Todas'  },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => {
                setVista(t.id)
                if (t.id === 'dia' || t.id === 'semana') {
                  // Si no estamos en una semana válida, ir a la de hoy si existe
                  if (idxHoy >= 0) setSemanaIdx(idxHoy)
                  if (t.id === 'dia' && idxHoy >= 0) {
                    const di = semanas[idxHoy]?.dias.findIndex(d => d.fecha === hoyISO) ?? 0
                    setDiaIdx(Math.max(0, di))
                  }
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                vista === t.id ? 'bg-tn-yellow text-tn-black' : 'text-tn-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Vista DÍA */}
        {vista === 'dia' && semanaActual && (
          <div className="space-y-4">
            {/* Navegación día */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  if (diaIdx > 0) setDiaIdx(diaIdx - 1)
                  else if (semanaIdx > 0) { setSemanaIdx(semanaIdx - 1); setDiaIdx(6) }
                }}
                disabled={diaIdx === 0 && semanaIdx === 0}
                className="p-3 text-tn-muted hover:text-tn-yellow disabled:opacity-30 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex-1 text-center">
                {semanaActual.dias[diaIdx] && (
                  <>
                    <p className="text-tn-muted text-xs uppercase tracking-wider">
                      Semana {semanaIdx + 1}
                    </p>
                    <h2 className="text-white font-black text-xl capitalize mt-1">
                      {fmtFechaLarga(semanaActual.dias[diaIdx].fecha)}
                    </h2>
                    {semanaActual.dias[diaIdx].fecha === hoyISO && (
                      <span className="inline-block mt-1 bg-tn-yellow text-tn-black text-xs font-bold px-2 py-0.5 rounded-full">
                        HOY
                      </span>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  if (diaIdx < 6) setDiaIdx(diaIdx + 1)
                  else if (semanaIdx < semanas.length - 1) { setSemanaIdx(semanaIdx + 1); setDiaIdx(0) }
                }}
                disabled={diaIdx === 6 && semanaIdx === semanas.length - 1}
                className="p-3 text-tn-muted hover:text-tn-yellow disabled:opacity-30 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Bloques del día */}
            {semanaActual.dias[diaIdx] && (
              <div className="space-y-3 max-w-2xl mx-auto">
                {semanaActual.dias[diaIdx].bloques.length === 0 ? (
                  <div className="card py-12 text-center">
                    <div className="w-14 h-14 bg-tn-border rounded-2xl flex items-center justify-center mb-3 mx-auto">
                      <svg className="w-7 h-7 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-white font-bold mb-1">Día de descanso 😴</p>
                    <p className="text-tn-muted text-sm">Aprovecha para recuperar bien</p>
                  </div>
                ) : (
                  semanaActual.dias[diaIdx].bloques.map(b =>
                    <div key={b.id + b.calId}>{renderBloque(b, semanaActual.dias[diaIdx].fecha)}</div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Vista SEMANA */}
        {vista === 'semana' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
              {semanas.map((s, i) => (
                <button
                  key={s.fechaLunes}
                  onClick={() => setSemanaIdx(i)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    semanaIdx === i ? 'bg-tn-yellow text-tn-black' : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
                  }`}
                >
                  <span>Semana {i + 1}</span>
                  <span className="hidden sm:inline text-xs ml-2 opacity-70">{fmtFecha(s.fechaLunes)}</span>
                </button>
              ))}
            </div>
            {semanaActual && renderSemanaGrid(semanaActual)}
          </div>
        )}

        {/* Vista TODAS */}
        {vista === 'todas' && (
          <div className="space-y-8">
            {semanas.map((s, i) => (
              <div key={s.fechaLunes} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold whitespace-nowrap">Semana {i + 1}</h3>
                  <span className="text-tn-muted text-xs">
                    {fmtFecha(s.fechaLunes)} → {fmtFecha(addDays(s.fechaLunes, 6))}
                  </span>
                  <div className="flex-1 h-px bg-tn-border" />
                  <span className="text-tn-muted text-xs whitespace-nowrap">
                    {s.dias.reduce((a, d) => a + d.bloques.length, 0)} bloques
                  </span>
                </div>
                {renderSemanaGrid(s)}
              </div>
            ))}
          </div>
        )}

        {seleccionados.size === 0 && (
          <div className="card py-10 text-center">
            <p className="text-tn-muted text-sm">Selecciona al menos un programa para ver tu entrenamiento</p>
          </div>
        )}

        {/* Suscripciones caducadas (histórico) */}
        {misSuscripcionesCaducadas.length > 0 && (
          <div className="pt-4 mt-4 border-t border-tn-border space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">
                Suscripciones caducadas
              </p>
            </div>
            <div className="space-y-2">
              {misSuscripcionesCaducadas.map(({ susc, cat }) => (
                <div
                  key={susc.id}
                  className="card p-4 flex items-center justify-between gap-4 flex-wrap opacity-75 hover:opacity-100 transition-opacity"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-tn-border/40 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-tn-light font-bold text-sm truncate">{cat!.nombre}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-tn-border/50 text-tn-muted">
                          Caducada
                        </span>
                      </div>
                      <p className="text-tn-muted text-xs">
                        Caducó el {fmtFecha(susc.fechaFin)}
                        {cat!.precioMensual ? ` · ${cat!.precioMensual} €/mes` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary flex items-center gap-2 text-sm py-2 px-4 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reactivar{cat!.precioMensual ? ` por ${cat!.precioMensual} €` : ''}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal detalle */}
      {bloqueSel && (
        <BloqueDetalleModal
          bloque={bloqueSel.bloque}
          programaNombre={bloqueSel.bloque.calNombre}
          colorKey={bloqueSel.bloque.colorKey}
          fecha={bloqueSel.fecha}
          onClose={() => setBloqueSel(null)}
        />
      )}
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function CambiarPasswordModal({ onClose }: { onClose: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!actual) return setError('Introduce tu contraseña actual')
    if (nueva.length < 4) return setError('La nueva contraseña debe tener al menos 4 caracteres')
    if (nueva !== confirmar) return setError('Las contraseñas nuevas no coinciden')
    setSaving(true)
    try {
      await apiPortalChangePassword(actual, nueva)
      setOk(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl">
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <h3 className="text-white font-bold text-lg">Cambiar contraseña</h3>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {ok ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-3 mx-auto">
              <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-bold">Contraseña actualizada</p>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <label className="label">Contraseña actual</label>
              <PasswordInput value={actual} autoFocus
                onChange={e => setActual(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <label className="label">Nueva contraseña</label>
              <PasswordInput value={nueva}
                onChange={e => setNueva(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <label className="label">Repetir nueva contraseña</label>
              <PasswordInput value={confirmar}
                onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Guardando...' : 'Cambiar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Header({ cliente, onLogout }: { cliente: Cliente; onLogout: () => void }) {
  const [menu, setMenu] = useState(false)
  const [cambiarPass, setCambiarPass] = useState(false)
  return (
    <header className="bg-tn-dark border-b border-tn-border px-4 lg:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/tn-logo.png" alt="Training Norte" className="w-10 h-10 object-contain" />
        <div className="hidden sm:block">
          <p className="text-white font-bold text-sm leading-tight">Improving Methods</p>
          <p className="text-tn-muted text-xs">Training Norte</p>
        </div>
      </div>

      {/* Menú de usuario */}
      <div className="relative">
        <button
          onClick={() => setMenu(v => !v)}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-tn-card transition-all"
        >
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-semibold leading-tight">{cliente.nombre} {cliente.apellido}</p>
            <p className="text-tn-muted text-xs">@{cliente.username}</p>
          </div>
          <div className="w-9 h-9 bg-tn-yellow rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-tn-black font-black text-sm">{cliente.nombre.charAt(0).toUpperCase()}</span>
          </div>
          <svg className={`w-4 h-4 text-tn-muted transition-transform ${menu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-56 card shadow-2xl z-50 overflow-hidden py-1">
              <div className="px-4 py-2.5 border-b border-tn-border sm:hidden">
                <p className="text-white text-sm font-semibold">{cliente.nombre} {cliente.apellido}</p>
                <p className="text-tn-muted text-xs">@{cliente.username}</p>
              </div>
              <button
                onClick={() => { setMenu(false); setCambiarPass(true) }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-tn-dark transition-colors text-left text-white text-sm"
              >
                <svg className="w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Cambiar contraseña
              </button>
              <button
                onClick={onLogout}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-400/5 transition-colors text-left text-red-400 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>

      {cambiarPass && <CambiarPasswordModal onClose={() => setCambiarPass(false)} />}
    </header>
  )
}
