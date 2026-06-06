import { useState } from 'react'
import { type Cliente, type CalendarioCliente, type CatalogoSuscripcion, type SuscripcionCliente, CALENDAR_COLORS } from '../../types'
import { useClientes, suscripcionVigente } from '../../context/ClientesContext'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { useCalendarios, fmtFecha, siguienteLunes, addDays } from '../../context/CalendariosContext'
import { usePermisos } from '../../hooks/usePermisos'
import ClienteModal from '../../components/clientes/ClienteModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import CalendarioClienteView from './CalendarioClienteView'
import CalendarioCombinado from './CalendarioCombinado'
import LunesPicker, { getLunes } from '../../components/LunesPicker'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  cliente: Cliente
  onVolver: () => void
}

export default function ClienteDetalle({ cliente, onVolver }: Props) {
  const {
    catalogo, suscripciones,
    asignarSuscripcion, desactivarSuscripcion, borrarSuscripcion, editarFechas,
    clientes,
  } = useClientes()
  const { programas } = usePlanificacion()
  const { crearCalendario, calendariosDeCliente, borrarCalendario } = useCalendarios()
  const { esAdmin } = usePermisos()

  // Refresco del cliente desde el store (puede haber sido editado)
  const clienteActual = clientes.find(c => c.id === cliente.id) ?? cliente

  const [editModal, setEditModal]         = useState(false)
  const [asignarModal, setAsignarModal]   = useState(false)
  const [quitarSusc, setQuitarSusc]       = useState<string | null>(null)
  const [calendarioAbierto, setCalendarioAbierto] = useState<CalendarioCliente | null>(null)
  const [borrarCal, setBorrarCal]         = useState<CalendarioCliente | null>(null)
  const [seleccion, setSeleccion]         = useState<Set<string>>(new Set())
  const [vistaCombi, setVistaCombi]       = useState(false)

  // Para recurrentes: paso intermedio de elección de fecha
  const [catPendiente, setCatPendiente]   = useState<CatalogoSuscripcion | null>(null)
  const [fechaPendiente, setFechaPendiente] = useState('')

  // Editar fechas de una suscripción (solo admin)
  const [editFechas, setEditFechas]       = useState<SuscripcionCliente | null>(null)
  const [nuevoInicio, setNuevoInicio]     = useState('')
  const [nuevaFin, setNuevaFin]           = useState('')

  const missSuscs = suscripciones.filter(s => s.clienteId === clienteActual.id)
  const missSuscsActivas = missSuscs.filter(s => s.activa)
  const misCalendarios = calendariosDeCliente(clienteActual.id)

  // Catálogo que aún no tiene asignado (activo) este cliente
  const catalogoDisponible = catalogo.filter(
    cat => !missSuscsActivas.some(s => s.catalogoId === cat.id),
  )

  /** Crea calendarios para todos los programas de una suscripción recién asignada.
   *  Recurrentes: se asigna el programa COMPLETO (desde su fecha de inicio) de cada
   *  programa cuya ventana de validez [inicio, inicio + semanas) cubra la fecha de
   *  compra (hoy), más todos los que empiecen en el futuro. Se descartan solo los
   *  que ya terminaron antes de la compra. */
  const crearCalendariosParaCat = (cat: CatalogoSuscripcion, scId: string, fechaOverride?: string) => {
    const ahora = new Date()
    const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`

    cat.programas.forEach(pa => {
      const programa = programas.find(p => p.id === pa.programaId)
      if (!programa) return

      let fecha: string
      if (fechaOverride) {
        fecha = fechaOverride
      } else if (cat.tipo === 'recurrente') {
        // Si no tiene fecha en el catálogo → siguiente lunes
        if (!pa.fechaInicio) {
          fecha = siguienteLunes()
        } else {
          // Último día planificado del programa: inicio + (semanas * 7) - 1
          const finPrograma = addDays(pa.fechaInicio, programa.semanas.length * 7 - 1)
          // Si el programa ya terminó antes de la compra → no asignar
          if (finPrograma < hoyISO) return
          // Si no, asignar el programa COMPLETO desde su fecha de inicio original
          fecha = pa.fechaInicio
        }
      } else {
        // Pago único: todos desde el siguiente lunes
        fecha = siguienteLunes()
      }
      crearCalendario(clienteActual.id, scId, programa, fecha)
    })
  }

  /** Lee la última suscripción asignada al cliente para un catálogo (desde localStorage, post-update) */
  const getLastSc = (catalogoId: string) =>
    [...(JSON.parse(localStorage.getItem('im_suscripciones_clientes') ?? '[]') as {id:string;clienteId:string;catalogoId:string;activa:boolean}[])]
      .filter(s => s.clienteId === clienteActual.id && s.catalogoId === catalogoId && s.activa)
      .at(-1)

  /** Al pulsar una suscripción en el modal de asignar */
  const seleccionarCatalogo = (cat: CatalogoSuscripcion) => {
    const tieneRecurrenteSinFecha = cat.tipo === 'recurrente' && cat.programas.some(p => p.programaId && !p.fechaInicio)

    if (cat.tipo === 'recurrente' && cat.programas.length > 0 && tieneRecurrenteSinFecha) {
      // Algún programa no tiene fecha → pedir fecha global
      setCatPendiente(cat)
      setFechaPendiente(cat.programas[0]?.fechaInicio ?? siguienteLunes())
      setAsignarModal(false)
    } else {
      // Pago único, o recurrente con todas las fechas ya fijadas en el catálogo
      asignarSuscripcion(clienteActual.id, cat.id)
      setTimeout(() => {
        const sc = getLastSc(cat.id)
        if (sc) crearCalendariosParaCat(cat, sc.id)
      }, 0)
      setAsignarModal(false)
    }
  }

  /** Confirmar la fecha cuando el recurrente no la tenía en el catálogo */
  const confirmarRecurrente = () => {
    if (!catPendiente) return
    const fecha = getLunes(fechaPendiente)
    asignarSuscripcion(clienteActual.id, catPendiente.id)
    setTimeout(() => {
      const sc = getLastSc(catPendiente.id)
      if (sc) crearCalendariosParaCat(catPendiente, sc.id, fecha)
    }, 0)
    setCatPendiente(null)
  }

  // Vista combinada
  if (vistaCombi && seleccion.size > 0) {
    const calsSeleccionados = misCalendarios.filter(c => seleccion.has(c.id))
    return (
      <CalendarioCombinado
        calendarios={calsSeleccionados}
        onVolver={() => setVistaCombi(false)}
      />
    )
  }

  // Vista de calendario individual
  if (calendarioAbierto) {
    return (
      <CalendarioClienteView
        calendario={calendarioAbierto}
        onVolver={() => setCalendarioAbierto(null)}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <button
          onClick={onVolver}
          className="p-2 text-tn-muted hover:text-white hover:bg-tn-card rounded-lg transition-all mt-0.5"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-white">
            {clienteActual.nombre} {clienteActual.apellido}
          </h2>
          <p className="text-tn-muted text-sm mt-0.5 font-mono">@{clienteActual.username}</p>
        </div>
        <button
          onClick={() => setEditModal(true)}
          className="btn-secondary flex items-center gap-2 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </button>
      </div>

      {/* ── Datos del cliente ────────────────────────────────────────────── */}
      <div className="card p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Datos personales
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Email', value: clienteActual.email },
            { label: 'Usuario', value: `@${clienteActual.username}` },
            { label: 'Estado', value: clienteActual.activo ? 'Activo' : 'Inactivo' },
            { label: 'Alta', value: fmtDate(clienteActual.creadoEn) },
            { label: 'Baja', value: fmtDate(clienteActual.bajaEn) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-tn-muted text-xs font-medium mb-0.5">{label}</p>
              <p className={`text-sm font-semibold ${
                label === 'Estado'
                  ? clienteActual.activo ? 'text-green-400' : 'text-red-400'
                  : 'text-white'
              }`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Suscripciones ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            Suscripciones
            {missSuscsActivas.length > 0 && (
              <span className="text-tn-muted font-normal text-sm">
                ({missSuscsActivas.length} activa{missSuscsActivas.length !== 1 ? 's' : ''})
              </span>
            )}
          </h3>
          {catalogoDisponible.length > 0 && (
            <button
              className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4"
              onClick={() => setAsignarModal(true)}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Asignar
            </button>
          )}
        </div>

        {missSuscs.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-tn-border rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <p className="text-white font-semibold text-sm mb-1">Sin suscripciones</p>
            <p className="text-tn-muted text-xs mb-4">
              {catalogo.length === 0
                ? 'Crea suscripciones en el catálogo primero'
                : 'Asigna una suscripción del catálogo a este cliente'}
            </p>
            {catalogoDisponible.length > 0 && (
              <button
                className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
                onClick={() => setAsignarModal(true)}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Asignar suscripción
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {missSuscs.map(s => {
              const cat = catalogo.find(c => c.id === s.catalogoId)
              const vigente = suscripcionVigente(s)
              return (
                <div key={s.id} className={`card p-4 flex items-center gap-4 transition-all ${
                  vigente ? '' : 'opacity-70 border-red-400/30 bg-red-400/[0.03]'
                }`}>
                  {/* Icono tipo */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    cat?.tipo === 'recurrente' ? 'bg-blue-400/10' : 'bg-green-400/10'
                  }`}>
                    {cat?.tipo === 'recurrente' ? (
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{cat?.nombre ?? '—'}</p>
                      {vigente
                        ? <span className="badge-active text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Vigente</span>
                        : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-400/10 text-red-400 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {s.activa ? 'Fuera de fecha' : 'Desactivada'}
                          </span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {cat?.programas.map(pa => {
                        const pr = programas.find(p => p.id === pa.programaId)
                        return pr ? <span key={pa.programaId} className="text-tn-muted text-xs">📋 {pr.nombre}</span> : null
                      })}
                      <span className={`text-xs ${vigente ? 'text-tn-muted' : 'text-red-400/80'}`}>
                        {fmtDate(s.fechaInicio)} → {fmtDate(s.fechaFin)}
                      </span>
                      {cat?.precioMensual ? (
                        <span className="text-tn-muted text-xs">{cat.precioMensual} €/mes</span>
                      ) : null}
                      {cat?.tipo && (
                        <span className={`text-xs font-medium ${cat.tipo === 'recurrente' ? 'text-blue-400' : 'text-green-400'}`}>
                          {cat.tipo === 'recurrente' ? '↻ Recurrente' : '✓ Pago único'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {esAdmin && (
                      <button
                        onClick={() => { setEditFechas(s); setNuevoInicio(s.fechaInicio.split('T')[0]); setNuevaFin(s.fechaFin) }}
                        title="Editar fechas"
                        className="p-2 text-tn-muted hover:text-tn-yellow hover:bg-tn-yellow/5 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {s.activa && (
                      <button
                        onClick={() => setQuitarSusc(s.id)}
                        title="Desactivar suscripción"
                        className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => borrarSuscripcion(s.id)}
                      title="Eliminar"
                      className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: asignar suscripción ────────────────────────────────────── */}
      {asignarModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-tn-border flex-shrink-0">
              <div>
                <h3 className="text-white font-bold">Asignar suscripción</h3>
                <p className="text-tn-muted text-xs mt-0.5">
                  {clienteActual.nombre} {clienteActual.apellido}
                </p>
              </div>
              <button onClick={() => setAsignarModal(false)} className="text-tn-muted hover:text-white p-1 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {catalogoDisponible.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-tn-muted text-sm">Este cliente ya tiene todas las suscripciones activas</p>
                </div>
              ) : (
                catalogoDisponible.map(cat => {
                  const progsAsoc = cat.programas.map(pa => programas.find(p => p.id === pa.programaId)).filter(Boolean)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => seleccionarCatalogo(cat)}
                      className="w-full card px-4 py-4 text-left hover:border-tn-yellow transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          cat.tipo === 'recurrente' ? 'bg-blue-400/10' : 'bg-green-400/10'
                        }`}>
                          {cat.tipo === 'recurrente' ? (
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">
                            {cat.nombre}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-medium ${cat.tipo === 'recurrente' ? 'text-blue-400' : 'text-green-400'}`}>
                              {cat.tipo === 'recurrente' ? '↻ Recurrente' : '✓ Pago único'}
                            </span>
                            {progsAsoc.map(p => (
                              <span key={p!.id} className="text-tn-muted text-xs">· {p!.nombre}</span>
                            ))}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-tn-muted group-hover:text-tn-yellow transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div className="p-4 border-t border-tn-border flex-shrink-0">
              <button onClick={() => setAsignarModal(false)} className="btn-secondary w-full">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Calendarios ─────────────────────────────────────────────────── */}
      {misCalendarios.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendarios
              <span className="text-tn-muted font-normal text-sm">({misCalendarios.length})</span>
            </h3>
            {seleccion.size > 0 && (
              <button
                onClick={() => setVistaCombi(true)}
                className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Ver combinado ({seleccion.size})
              </button>
            )}
          </div>

          {misCalendarios.length > 1 && seleccion.size === 0 && (
            <p className="text-tn-muted text-xs">
              Marca varios calendarios para verlos juntos y comprobar el equilibrio semanal.
            </p>
          )}

          <div className="space-y-2">
            {misCalendarios.map(cal => {
              const colorDef = CALENDAR_COLORS.find(c => c.key === cal.colorKey) ?? CALENDAR_COLORS[0]
              const checked = seleccion.has(cal.id)
              const toggleSeleccion = () => {
                const next = new Set(seleccion)
                if (checked) next.delete(cal.id); else next.add(cal.id)
                setSeleccion(next)
              }
              return (
              <div
                key={cal.id}
                onClick={toggleSeleccion}
                className={`card p-4 flex items-center justify-between gap-4 transition-all group cursor-pointer border ${
                  checked ? colorDef.cls + ' opacity-100' : 'border-tn-border hover:border-tn-border/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Checkbox visual */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checked ? 'border-transparent' : 'border-tn-border group-hover:border-tn-muted'
                  }`}
                    style={checked ? { backgroundColor: colorDef.accent, borderColor: colorDef.accent } : {}}
                  >
                    {checked && (
                      <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  <div className={`w-8 h-8 rounded-lg ${colorDef.badge} flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-4 h-4" style={{ color: colorDef.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{cal.programaNombre}</p>
                    <p className="text-tn-muted text-xs">
                      Desde {fmtFecha(cal.fechaInicio)} · {cal.semanas.length} semanas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setCalendarioAbierto(cal)}
                    className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Ver
                  </button>
                  <button
                    onClick={() => setBorrarCal(cal)}
                    className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Eliminar calendario"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal: elegir lunes para suscripción recurrente ─────────────── */}
      {catPendiente && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-white font-bold text-lg">Fecha de inicio</h3>
              <p className="text-tn-muted text-sm mt-0.5">
                Suscripción: <span className="text-white font-medium">{catPendiente.nombre}</span>
              </p>
            </div>

            <LunesPicker
              value={fechaPendiente}
              onChange={setFechaPendiente}
              label="Lunes de inicio *"
              hint="El programa comenzará en este lunes para este cliente"
            />

            <div className="bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-3">
              <p className="text-tn-yellow/80 text-xs">
                El calendario personal del cliente se generará automáticamente a partir de este lunes.
              </p>
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setCatPendiente(null)}>Cancelar</button>
              <button
                className="btn-primary flex-1"
                disabled={!fechaPendiente}
                onClick={confirmarRecurrente}
              >
                Asignar y crear calendario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm borrar calendario ────────────────────────────────────── */}
      {borrarCal && (
        <ConfirmDialog
          title="Eliminar calendario"
          description={`¿Eliminar el calendario "${borrarCal.programaNombre}"? Se perderán todos los entrenamientos personalizados.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrarCalendario(borrarCal.id); setBorrarCal(null) }}
          onCancel={() => setBorrarCal(null)}
        />
      )}

      {/* ── Confirm desactivar suscripción ───────────────────────────────── */}
      {quitarSusc && (
        <ConfirmDialog
          title="Desactivar suscripción"
          description="¿Desactivar esta suscripción? El cliente perderá acceso al programa asociado."
          confirmLabel="Desactivar"
          onConfirm={() => { desactivarSuscripcion(quitarSusc); setQuitarSusc(null) }}
          onCancel={() => setQuitarSusc(null)}
        />
      )}

      {/* ── Modal editar cliente ─────────────────────────────────────────── */}
      {editModal && (
        <ClienteModal
          cliente={clienteActual}
          onClose={() => setEditModal(false)}
        />
      )}

      {/* ── Modal: editar fechas (solo admin) ────────────────────────────── */}
      {editFechas && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-white font-bold text-lg">Editar fechas</h3>
              <p className="text-tn-muted text-sm mt-0.5">
                {catalogo.find(c => c.id === editFechas.catalogoId)?.nombre ?? 'Suscripción'}
              </p>
            </div>

            <div>
              <label className="label">Fecha de inicio</label>
              <input
                type="date"
                className="input-field"
                value={nuevoInicio}
                onChange={e => setNuevoInicio(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Fecha de fin</label>
              <input
                type="date"
                className="input-field"
                value={nuevaFin}
                min={nuevoInicio}
                onChange={e => setNuevaFin(e.target.value)}
              />
            </div>

            {nuevoInicio && nuevaFin && nuevaFin < nuevoInicio && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
                La fecha de fin no puede ser anterior a la de inicio
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setEditFechas(null)}>Cancelar</button>
              <button
                className="btn-primary flex-1"
                disabled={!nuevoInicio || !nuevaFin || nuevaFin < nuevoInicio}
                onClick={() => {
                  // Conservar la hora original del inicio si solo cambia el día
                  const horaOriginal = editFechas.fechaInicio.includes('T')
                    ? editFechas.fechaInicio.split('T')[1]
                    : '00:00:00.000Z'
                  const inicioISO = `${nuevoInicio}T${horaOriginal}`
                  editarFechas(editFechas.id, inicioISO, nuevaFin)
                  setEditFechas(null)
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
