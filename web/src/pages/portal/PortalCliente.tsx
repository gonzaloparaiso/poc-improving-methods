import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react'
import { type Cliente, type CredencialExtra, DIAS_SEMANA, CALENDAR_COLORS, type CalendarioCliente, type ContenidoItem, BASIC_PROGRAM_ID } from '../../types'
import { useCalendarios, fmtFecha, addDays } from '../../context/CalendariosContext'
import { useEjercicios } from '../../context/EjerciciosContext'
import { useClientes, suscripcionVigente } from '../../context/ClientesContext'
import { useContenido } from '../../context/ContenidoContext'
import { fusionarCalendarios, toISO, lunesDe, type SemanaFusion, type BloqueConColor } from '../../lib/calendario'
import { obtenerPeriodicas, añadirPeriodica, eliminarPeriodica, periodicasDeDia } from '../../lib/contenidoPeriodico'
import BloqueDetalleModal from './BloqueDetalleModal'
import ContenidoSeccion from './ContenidoSeccion'
import ContenidoDetalleModal from './ContenidoDetalleModal'
import { exportarPDF, exportarExcel } from './exporters'
import { apiPortalChangePassword, apiPortalRenew, apiPortalAddCredencial, apiPortalRemoveCredencial } from '../../lib/storage'
import PasswordInput from '../../components/PasswordInput'
import PasswordRequisitos from '../../components/PasswordRequisitos'
import ConfirmDialog from '../../components/ConfirmDialog'
import { errorPassword } from '../../lib/passwordPolicy'

interface Props {
  cliente: Cliente
  onLogout: () => void
}

function fmtFechaLarga(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long',
  })
}

type Vista = 'semana' | 'todas' | 'dia'
type Seccion = 'entrenamiento' | 'contenido'

export default function PortalCliente({ cliente, onLogout }: Props) {
  const { calendariosDeCliente } = useCalendarios()
  const { ejercicios } = useEjercicios()
  const { suscripciones, catalogo } = useClientes()
  const { respiraciones, movilidad } = useContenido()
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

  // "Basic" da acceso a Contenido (Respiración/Movilidad) en vez de un calendario
  const tieneAccesoContenido = programasVigentes.has(BASIC_PROGRAM_ID)

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

  // Las vistas Semana/Todas solo en escritorio (en móvil no caben bien)
  const [esEscritorio, setEsEscritorio] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const h = () => setEsEscritorio(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  // Sección principal: Entrenamiento (planificación) o Contenido (Respiración/Movilidad).
  // Si no hay calendarios pero sí acceso a Contenido (solo "Basic"), abrir en Contenido.
  const [seccion, setSeccion] = useState<Seccion>(() =>
    miscalendarios.length === 0 && tieneAccesoContenido ? 'contenido' : 'entrenamiento')

  // En móvil abrimos en vista 'día' (más cómoda); en escritorio, semana completa.
  const [vista, setVista]         = useState<Vista>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'dia' : 'semana')
  const [semanaIdx, setSemanaIdx] = useState(0)
  // En móvil se fuerza siempre la vista por día
  const vistaEfectiva: Vista = esEscritorio ? vista : 'dia'

  // Respiraciones programadas por el cliente en su calendario (solo suyas, locales)
  const [periodicas, setPeriodicas] = useState(() => obtenerPeriodicas(cliente.id))

  // Indice del día actual relativo al inicio
  const hoyISO = toISO(new Date())
  // Buscar semana de hoy
  const idxHoy = semanas.findIndex(s =>
    s.dias.some(d => d.fecha === hoyISO)
  )

  // El calendario nunca "acaba": si el cliente navega con las flechas más allá de
  // las semanas reales del programa (antes del inicio o después del fin de la
  // suscripción), se generan semanas vacías al vuelo — no se guarda nada.
  const semanaVirtual = (idx: number): SemanaFusion => {
    const base = semanas.length === 0
      ? addDays(lunesDe(hoyISO), 7 * idx)
      : idx >= semanas.length
        ? addDays(semanas[semanas.length - 1].fechaLunes, 7 * (idx - (semanas.length - 1)))
        : addDays(semanas[0].fechaLunes, 7 * idx) // idx < 0
    return {
      fechaLunes: base,
      dias: DIAS_SEMANA.map((_, i) => ({ fecha: addDays(base, i), diaSemana: i, bloques: [] })),
    }
  }
  const obtenerSemana = (idx: number): SemanaFusion =>
    idx >= 0 && idx < semanas.length ? semanas[idx] : semanaVirtual(idx)

  // Vista "Todas": nº de semanas virtuales extra añadidas al final (en bloques de 4).
  const [semanasExtra, setSemanasExtra] = useState(0)
  const semanasTodas = useMemo<SemanaFusion[]>(() => [
    ...semanas,
    ...Array.from({ length: semanasExtra }, (_, k) => semanaVirtual(semanas.length + k)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [semanas, semanasExtra])

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

  // Elemento de Contenido (Respiración/Movilidad) seleccionado para ver detalle
  const [contenidoSel, setContenidoSel] = useState<ContenidoItem | null>(null)

  const todosContenidos = useMemo(() => [...respiraciones, ...movilidad], [respiraciones, movilidad])

  const programarContenido = (contenidoId: string) => (hora: string, dias: number[]): string | null => {
    const res = añadirPeriodica(cliente.id, contenidoId, hora, dias)
    if (!res.ok) return res.error
    setPeriodicas(obtenerPeriodicas(cliente.id))
    return null
  }
  const quitarPeriodica = (id: string) => {
    setPeriodicas(eliminarPeriodica(cliente.id, id))
  }

  // Menú de exportar
  const [menuExport, setMenuExport] = useState(false)

  // Renovación de suscripción
  const [renovar, setRenovar] = useState<{ catalogoId: string; nombre: string; precio: number; mode: 'renew' | 'resubscribe' } | null>(null)

  const nombreCompleto = `${cliente.nombre}${cliente.apellido ? ' ' + cliente.apellido : ''}`
  const calsAExportar = calsActivos.length > 0 ? calsActivos : miscalendarios

  const handleExport = (tipo: 'pdf' | 'excel') => {
    setMenuExport(false)
    if (tipo === 'pdf')   exportarPDF(calsAExportar, nombreCompleto, ejercicios)
    if (tipo === 'excel') exportarExcel(calsAExportar, nombreCompleto, ejercicios)
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

  // Respiraciones periódicas del cliente para un día de la semana (0=Lun…6=Dom).
  // Estilo propio (cian) para distinguirlas de los bloques de los programas.
  // Se colocan respecto al entreno según su hora: antes de las 12:00 van antes
  // del/de los bloque(s) del día; a partir de las 12:00 van después.
  const renderPeriodicasDia = (diaSemana: number, momento: 'antes' | 'despues') => {
    if (!tieneAccesoContenido) return null
    const delDia = periodicasDeDia(periodicas, diaSemana)
      .filter(p => (momento === 'antes' ? p.hora < '12:00' : p.hora >= '12:00'))
      .map(p => ({ p, item: todosContenidos.find(i => i.id === p.contenidoId) }))
      .filter(x => x.item)
    if (delDia.length === 0) return null
    return delDia.map(({ p, item }) => (
      <button
        key={p.id}
        onClick={() => setContenidoSel(item!)}
        className="w-full text-left rounded-xl p-3 border border-sky-400/30 bg-sky-400/10 hover:border-sky-400/70 transition-all group cursor-pointer"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
          </svg>
          <span className="text-sky-300 text-xs font-mono font-bold">{p.hora}</span>
        </div>
        <p className="text-sky-100 font-semibold text-sm leading-tight group-hover:text-sky-300 transition-colors">
          {item!.titulo}
        </p>
      </button>
    ))
  }

  const renderSemanaGrid = (semana: SemanaFusion) => (
    <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
      <div className="grid grid-cols-7 gap-2 min-w-[800px]">
        {semana.dias.map(dia => {
          const esHoy = dia.fecha === hoyISO
          return (
            <div key={dia.fecha} className="flex flex-col gap-2">
              {/* "Hoy" en blanco sólido a propósito: no coincide con ningún color de programa (amarillo/azul/morado/verde/naranja) */}
              <div className={`text-center rounded-lg py-2 ${esHoy ? 'bg-white border border-white' : 'bg-tn-dark border border-tn-border'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${esHoy ? 'text-tn-black' : 'text-tn-muted'}`}>
                  {DIAS_SEMANA[dia.diaSemana].slice(0, 3)}
                </p>
                <p className={`text-sm font-black mt-0.5 ${esHoy ? 'text-tn-black' : 'text-white'}`}>
                  {new Date(dia.fecha + 'T00:00:00').getDate()}
                </p>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {dia.bloques.length === 0 && periodicasDeDia(periodicas, dia.diaSemana).length === 0
                  ? <div className="border border-dashed border-tn-border/40 rounded-xl h-12 flex items-center justify-center">
                      <span className="text-tn-muted/40 text-xs">descanso</span>
                    </div>
                  : (
                    <>
                      {renderPeriodicasDia(dia.diaSemana, 'antes')}
                      {dia.bloques.map(b => renderBloque(b, dia.fecha))}
                      {renderPeriodicasDia(dia.diaSemana, 'despues')}
                    </>
                  )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ─── Render principal ───────────────────────────────────────────────────────

  if (miscalendarios.length === 0 && !tieneAccesoContenido) {
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
                          onClick={() => setRenovar({ catalogoId: cat!.id, nombre: cat!.nombre, precio: cat!.precioMensual, mode: 'renew' })}
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

  const semanaActual = obtenerSemana(semanaIdx)

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
              <p className="text-tn-yellow font-black text-2xl leading-none">{misSuscripcionesVigentes.length}</p>
              <p className="text-tn-muted text-xs">suscripci{misSuscripcionesVigentes.length !== 1 ? 'ones' : 'ón'} activa{misSuscripcionesVigentes.length !== 1 ? 's' : ''}</p>
            </div>
            {/* Botón exportar: solo tiene sentido viendo el entrenamiento */}
            {seccion === 'entrenamiento' && miscalendarios.length > 0 && (
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
                        { id: 'pdf' as const,   label: 'PDF',   desc: 'Documento imprimible', color: 'text-red-400' },
                        { id: 'excel' as const, label: 'Excel', desc: 'Hoja por programa',    color: 'text-green-400' },
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
            )}
          </div>
        </div>

        {/* Mis suscripciones: una sola tarjeta con todas las vigentes */}
        {misSuscripcionesVigentes.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 lg:px-5 py-3 border-b border-tn-border flex items-center justify-between gap-3 flex-wrap">
              <p className="text-white font-bold text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Mis suscripciones
                <span className="text-tn-muted font-normal">({misSuscripcionesVigentes.length})</span>
              </p>
              <a
                href="https://trainingnorte.com/tn-box/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-tn-muted text-xs font-semibold hover:text-tn-yellow transition-colors flex items-center gap-1"
              >
                Ver otras suscripciones
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
            <div className="divide-y divide-tn-border">
              {misSuscripcionesVigentes.map(({ susc, cat }) => {
                const esUnico = cat!.tipo === 'unico'
                return (
                  <div key={susc.id} className="px-4 lg:px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${esUnico ? 'bg-green-400' : 'bg-tn-yellow'}`} />
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{cat!.nombre}</p>
                        <p className="text-tn-muted text-xs">
                          {esUnico
                            ? 'Acceso permanente'
                            : `Se renueva automáticamente el ${fmtFecha(susc.fechaFin)}`}
                        </p>
                      </div>
                    </div>
                    {esUnico ? (
                      <a
                        href="https://trainingnorte.com/atletas/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
                      >
                        Ver programas para atletas
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Próximamente"
                        className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 whitespace-nowrap opacity-40 cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Renovar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Navegación principal: Entrenamiento / Contenido */}
        {miscalendarios.length > 0 && tieneAccesoContenido && (
          <nav className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            {([
              {
                id: 'entrenamiento' as Seccion,
                label: 'Entrenamiento',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                id: 'contenido' as Seccion,
                label: 'Contenido',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
                  </svg>
                ),
              },
            ]).map(s => (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border transition-all ${
                  seccion === s.id
                    ? 'bg-tn-yellow text-tn-black border-tn-yellow'
                    : 'bg-tn-card text-tn-muted border-tn-border hover:text-white hover:border-tn-muted'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </nav>
        )}

        {/* Selector de programas */}
        {seccion === 'entrenamiento' && miscalendarios.length > 1 && (
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
        {seccion === 'entrenamiento' && (() => {
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

        {/* Selector vista (Semana/Todas solo en escritorio) */}
        {seccion === 'entrenamiento' && (
        <>
        <div className="flex gap-1 bg-tn-dark border border-tn-border rounded-xl p-1 w-fit flex-wrap">
          {([
            { id: 'dia' as Vista,    label: 'Día'    },
            ...(esEscritorio ? [
              { id: 'semana' as Vista, label: 'Semana' },
              { id: 'todas' as Vista,  label: 'Todas'  },
            ] : []),
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

        {/* Aviso solo en móvil: la vista semanal es de escritorio */}
        {!esEscritorio && (
          <p className="text-tn-muted text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            La vista semanal y de programa completo está disponible desde un ordenador.
          </p>
        )}

        {/* Vista DÍA */}
        {vistaEfectiva === 'dia' && semanaActual && (
          <div className="space-y-4">
            {/* Navegación día */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  if (diaIdx > 0) setDiaIdx(diaIdx - 1)
                  else { setSemanaIdx(semanaIdx - 1); setDiaIdx(6) }
                }}
                className="p-3 text-tn-muted hover:text-tn-yellow transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex-1 text-center">
                {semanaActual.dias[diaIdx] && (
                  <>
                    {semanaIdx >= 0 && semanaIdx < semanas.length && (
                      <p className="text-tn-muted text-xs uppercase tracking-wider">
                        Semana {semanaIdx + 1}
                      </p>
                    )}
                    <h2 className="text-white font-black text-xl capitalize mt-1">
                      {fmtFechaLarga(semanaActual.dias[diaIdx].fecha)}
                    </h2>
                    {semanaActual.dias[diaIdx].fecha === hoyISO && (
                      <span className="inline-block mt-1 bg-white text-tn-black text-xs font-bold px-2 py-0.5 rounded-full">
                        HOY
                      </span>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  if (diaIdx < 6) setDiaIdx(diaIdx + 1)
                  else { setSemanaIdx(semanaIdx + 1); setDiaIdx(0) }
                }}
                className="p-3 text-tn-muted hover:text-tn-yellow transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Bloques del día (+ respiraciones periódicas del cliente) */}
            {semanaActual.dias[diaIdx] && (
              <div className="space-y-3 max-w-2xl mx-auto">
                {semanaActual.dias[diaIdx].bloques.length === 0
                  && periodicasDeDia(periodicas, semanaActual.dias[diaIdx].diaSemana).length === 0 ? (
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
                  <>
                    {renderPeriodicasDia(semanaActual.dias[diaIdx].diaSemana, 'antes')}
                    {semanaActual.dias[diaIdx].bloques.map(b =>
                      <div key={b.id + b.calId}>{renderBloque(b, semanaActual.dias[diaIdx].fecha)}</div>
                    )}
                    {renderPeriodicasDia(semanaActual.dias[diaIdx].diaSemana, 'despues')}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vista SEMANA */}
        {vistaEfectiva === 'semana' && semanaActual && (
          <div className="space-y-4">
            {/* Navegación semana a semana (el calendario continúa, aunque vacío, más allá del programa) */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setSemanaIdx(semanaIdx - 1)}
                className="p-3 text-tn-muted hover:text-tn-yellow transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 text-center">
                {semanaIdx >= 0 && semanaIdx < semanas.length && (
                  <p className="text-tn-muted text-xs uppercase tracking-wider">Semana {semanaIdx + 1}</p>
                )}
                <h2 className="text-white font-black text-lg mt-0.5">
                  {fmtFecha(semanaActual.fechaLunes)} → {fmtFecha(addDays(semanaActual.fechaLunes, 6))}
                </h2>
              </div>
              <button
                onClick={() => setSemanaIdx(semanaIdx + 1)}
                className="p-3 text-tn-muted hover:text-tn-yellow transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {/* Accesos rápidos a las semanas reales del programa */}
            {semanas.length > 1 && (
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
            )}
            {renderSemanaGrid(semanaActual)}
          </div>
        )}

        {/* Vista TODAS */}
        {vistaEfectiva === 'todas' && (
          <div className="space-y-8">
            {semanasTodas.map((s, i) => {
              const esVirtual = i >= semanas.length
              return (
                <div key={s.fechaLunes} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-bold whitespace-nowrap">Semana {i + 1}</h3>
                    <span className="text-tn-muted text-xs">
                      {fmtFecha(s.fechaLunes)} → {fmtFecha(addDays(s.fechaLunes, 6))}
                    </span>
                    <div className="flex-1 h-px bg-tn-border" />
                    <span className="text-tn-muted text-xs whitespace-nowrap">
                      {esVirtual ? 'sin planificación' : `${s.dias.reduce((a, d) => a + d.bloques.length, 0)} bloques`}
                    </span>
                  </div>
                  {renderSemanaGrid(s)}
                </div>
              )
            })}
            {/* Cargar / ocultar 4 semanas más allá del programa (siempre disponible) */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {semanasExtra > 0 && (
                <button
                  onClick={() => setSemanasExtra(n => Math.max(0, n - 4))}
                  className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Mostrar menos
                </button>
              )}
              <button
                onClick={() => setSemanasExtra(n => n + 4)}
                className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
              >
                Ver 4 semanas más
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {seleccionados.size === 0 && (
          <div className="card py-10 text-center">
            <p className="text-tn-muted text-sm">Selecciona al menos un programa para ver tu entrenamiento</p>
          </div>
        )}
        </>
        )}

        {/* Sección CONTENIDO (Respiración / Movilidad, acceso vía "Basic") */}
        {seccion === 'contenido' && (
          <ContenidoSeccion
            clienteId={cliente.id}
            respiraciones={respiraciones}
            movilidad={movilidad}
            onAbrir={item => setContenidoSel(item)}
            periodicas={periodicas}
            onEliminarPeriodica={quitarPeriodica}
          />
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
                    onClick={() => setRenovar({ catalogoId: cat!.id, nombre: cat!.nombre, precio: cat!.precioMensual, mode: 'resubscribe' })}
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

      {/* Pie: contacto de soporte */}
      <footer className="max-w-7xl w-full mx-auto px-4 lg:px-8 pb-6 lg:pb-8">
        <div className="card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-tn-yellow/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">¿Algo no funciona bien o tienes feedback?</p>
              <p className="text-tn-muted text-xs mt-0.5">Escríbenos y te ayudamos encantados</p>
            </div>
          </div>
          <a
            href="mailto:soporte@academiatn.com"
            className="btn-secondary flex items-center gap-2 text-sm py-2.5 px-4 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            soporte@academiatn.com
          </a>
        </div>
      </footer>

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

      {contenidoSel && (
        <ContenidoDetalleModal
          item={contenidoSel}
          onClose={() => setContenidoSel(null)}
          onProgramar={tieneAccesoContenido ? programarContenido(contenidoSel.id) : undefined}
        />
      )}

      {renovar && (
        <RenovarModal
          catalogoId={renovar.catalogoId}
          nombre={renovar.nombre}
          precio={renovar.precio}
          mode={renovar.mode}
          onClose={() => setRenovar(null)}
        />
      )}
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function RenovarModal({ catalogoId, nombre, precio, mode, onClose }: { catalogoId: string; nombre: string; precio: number; mode: 'renew' | 'resubscribe'; onClose: () => void }) {
  const [estado, setEstado] = useState<'confirm' | 'loading' | 'paid'>('confirm')
  const [error, setError] = useState('')
  const esReactivar = mode === 'resubscribe'

  const confirmar = async () => {
    setError(''); setEstado('loading')
    try {
      const r = await apiPortalRenew(catalogoId, mode)
      if (r.status === 'paid') { setEstado('paid'); return }
      if (r.status === 'needs_action' && r.payment_url) { window.location.href = r.payment_url; return }
      setError('No se pudo completar la renovación'); setEstado('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo renovar'); setEstado('confirm')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl">
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <h3 className="text-white font-bold text-lg">{esReactivar ? 'Reactivar suscripción' : 'Renovar suscripción'}</h3>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1" disabled={estado === 'loading'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {estado === 'paid' ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-3 mx-auto">
              <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-bold">{esReactivar ? '¡Suscripción reactivada!' : '¡Renovación completada!'}</p>
            <p className="text-tn-muted text-sm mt-1">Hemos cobrado tu cuota habitual. Gracias 💪</p>
            <button onClick={onClose} className="btn-primary w-full mt-6">Cerrar</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-tn-muted text-sm">
              Vas a {esReactivar ? <>crear una <span className="text-white font-semibold">nueva suscripción</span> de</> : 'renovar'} <span className="text-white font-semibold">{nombre}</span>
              {precio ? <> por <span className="text-white font-semibold">{precio} €</span></> : null}. Se cobrará a tu <span className="text-white">método de pago habitual</span>; no tienes que introducir nada.
            </p>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={estado === 'loading'}>Cancelar</button>
              <button type="button" className="btn-primary flex-1" onClick={confirmar} disabled={estado === 'loading'}>
                {estado === 'loading' ? 'Procesando…' : 'Confirmar y pagar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
    const err = errorPassword(nueva)
    if (err) return setError(err)
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
              <PasswordRequisitos password={nueva} />
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

// Gestión de entrenadores (credenciales extra de un box): mismo acceso que la
// cuenta principal, pero con su propio email y contraseña.
function EntrenadoresModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const [lista, setLista] = useState<CredencialExtra[]>(cliente.credencialesExtra ?? [])
  const [nuevo, setNuevo] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState<CredencialExtra | null>(null)

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('El email es obligatorio')
    const err = errorPassword(password)
    if (err) return setError(err)
    if (password !== confirmar) return setError('Las contraseñas no coinciden')
    setGuardando(true)
    try {
      const actualizado = await apiPortalAddCredencial(email.trim(), password) as Cliente
      setLista(actualizado.credencialesExtra ?? [])
      setNuevo(false); setEmail(''); setPassword(''); setConfirmar('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo añadir el entrenador')
    } finally {
      setGuardando(false)
    }
  }
  const eliminar = async (credId: string) => {
    try {
      const actualizado = await apiPortalRemoveCredencial(credId) as Cliente
      setLista(actualizado.credencialesExtra ?? [])
    } finally {
      setABorrar(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <div>
            <h3 className="text-white font-bold text-lg">Entrenadores</h3>
            <p className="text-tn-muted text-xs mt-0.5">Acceden con su propio email y la misma cuenta</p>
          </div>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!nuevo && (
            <button type="button" onClick={() => setNuevo(true)} className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Añadir entrenador
            </button>
          )}

          {nuevo && (
            <form onSubmit={crear} className="border border-tn-border rounded-xl p-4 space-y-3">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input-field" placeholder="entrenador@ejemplo.com" autoFocus
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <PasswordInput value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                <PasswordRequisitos password={password} />
              </div>
              <div>
                <label className="label">Repetir contraseña</label>
                <PasswordInput value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1"
                  onClick={() => { setNuevo(false); setError(''); setEmail(''); setPassword(''); setConfirmar('') }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Añadir'}
                </button>
              </div>
            </form>
          )}

          {lista.length === 0 ? (
            <p className="text-tn-muted text-sm text-center py-4">Todavía no has añadido ningún entrenador.</p>
          ) : (
            <div className="divide-y divide-tn-border">
              {lista.map(cr => (
                <div key={cr.id} className="py-3 flex items-center justify-between gap-3">
                  <p className="text-white text-sm font-semibold truncate">{cr.email}</p>
                  <button type="button" onClick={() => setABorrar(cr)}
                    className="p-1.5 text-tn-muted hover:text-red-400 transition-colors flex-shrink-0" title="Eliminar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {aBorrar && (
        <ConfirmDialog title="Eliminar entrenador"
          description={`¿Eliminar el acceso de "${aBorrar.email}"?`}
          confirmLabel="Eliminar"
          onConfirm={() => void eliminar(aBorrar.id)}
          onCancel={() => setABorrar(null)} />
      )}
    </div>
  )
}

function Header({ cliente, onLogout }: { cliente: Cliente; onLogout: () => void }) {
  const [menu, setMenu] = useState(false)
  const [cambiarPass, setCambiarPass] = useState(false)
  const [entrenadores, setEntrenadores] = useState(false)
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
            <p className="text-tn-muted text-xs">{cliente.email}</p>
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
                <p className="text-tn-muted text-xs">{cliente.email}</p>
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
              {cliente.esBox && (
                <button
                  onClick={() => { setMenu(false); setEntrenadores(true) }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-tn-dark transition-colors text-left text-white text-sm"
                >
                  <svg className="w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M9 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M13 7a3 3 0 11-6 0 3 3 0 016 0zm7 3a2 2 0 11-4 0 2 2 0 014 0zM6 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Entrenadores
                </button>
              )}
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
      {entrenadores && <EntrenadoresModal cliente={cliente} onClose={() => setEntrenadores(false)} />}
    </header>
  )
}
