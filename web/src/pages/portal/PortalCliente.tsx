import { useState, useMemo, useEffect } from 'react'
import { type Cliente, type Bloque, DIAS_SEMANA, CALENDAR_COLORS, type CalendarioCliente } from '../../types'
import { useCalendarios, fmtFecha, addDays } from '../../context/CalendariosContext'
import { useEjercicios } from '../../context/EjerciciosContext'
import { useClientes, suscripcionVigente } from '../../context/ClientesContext'
import BloqueDetalleModal from './BloqueDetalleModal'
import { exportarPDF, exportarExcel, exportarAimharder, exportarWodbuster } from './exporters'

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

  // Programas a los que el cliente tiene acceso HOY: los que vienen de una
  // suscripción suya vigente (hoy dentro de [inicio, fin] y activa).
  const programasVigentes = (() => {
    const ids = new Set<string>()
    suscripciones
      .filter(s => s.clienteId === cliente.id && suscripcionVigente(s))
      .forEach(s => {
        const cat = catalogo.find(c => c.id === s.catalogoId)
        cat?.programas.forEach(pa => ids.add(pa.programaId))
      })
    return ids
  })()

  // Un calendario es visible si su programa está cubierto por una suscripción vigente
  const calVigente = (c: CalendarioCliente) => programasVigentes.has(c.programaId)

  const miscalendarios = todosCalendarios.filter(calVigente)
  const calendariosBloqueados = todosCalendarios.filter(c => !calVigente(c))

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

  const [vista, setVista]         = useState<Vista>('semana')
  const [semanaIdx, setSemanaIdx] = useState(0)

  // Indice del día actual relativo al inicio
  const hoyISO = toISO(new Date())
  // Buscar semana de hoy
  const idxHoy = semanas.findIndex(s =>
    s.dias.some(d => d.fecha === hoyISO)
  )

  // Estado para vista día: índice de día seleccionado dentro de la semana
  const [diaIdx, setDiaIdx] = useState(0)

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
                <h2 className="text-white font-bold text-xl mb-2">Suscripción fuera de fecha</h2>
                <p className="text-tn-muted text-sm mb-4">
                  Tu suscripción no está vigente ahora mismo, así que tu planificación no está disponible.
                </p>
                <div className="bg-tn-dark border border-tn-border rounded-xl p-4 text-left space-y-2">
                  {calendariosBloqueados.map(cal => {
                    // Buscar la suscripción del cliente cuyo catálogo incluye este programa
                    const s = suscripciones
                      .filter(x => x.clienteId === cliente.id)
                      .find(x => {
                        const cat = catalogo.find(c => c.id === x.catalogoId)
                        return cat?.programas.some(pa => pa.programaId === cal.programaId)
                      })
                    return (
                      <div key={cal.id} className="flex items-center justify-between gap-2">
                        <span className="text-white text-sm font-medium truncate">{cal.programaNombre}</span>
                        {s && <span className="text-red-400/80 text-xs whitespace-nowrap">hasta {fmtFecha(s.fechaFin)}</span>}
                      </div>
                    )
                  })}
                </div>
                <p className="text-tn-muted text-xs mt-4">
                  Contacta con tu entrenador para renovarla.
                </p>
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
                <p className="text-tn-muted text-sm">
                  Tu entrenador te asignará un programa muy pronto. ¡Mantente atento!
                </p>
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
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-black text-xl truncate">¡Hola, {cliente.nombre}!</h1>
            <p className="text-tn-muted text-sm capitalize">{fmtFechaLarga(hoyISO)}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
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

function Header({ cliente, onLogout }: { cliente: Cliente; onLogout: () => void }) {
  return (
    <header className="bg-tn-dark border-b border-tn-border px-4 lg:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-tn-yellow rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-tn-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="hidden sm:block">
          <p className="text-white font-bold text-sm leading-tight">Improving Methods</p>
          <p className="text-tn-muted text-xs">Training Norte</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-white text-sm font-semibold">{cliente.nombre} {cliente.apellido}</p>
          <p className="text-tn-muted text-xs">@{cliente.username}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all text-sm font-medium"
          title="Cerrar sesión"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
