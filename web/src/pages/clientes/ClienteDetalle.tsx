import { useState, type FormEvent } from 'react'
import { type Cliente, type CalendarioCliente, type CatalogoSuscripcion, type SuscripcionCliente, type ContactoCliente, CALENDAR_COLORS, BASIC_PROGRAM_ID, BASIC_PROGRAM_NOMBRE } from '../../types'
import { useClientes, suscripcionVigente } from '../../context/ClientesContext'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { useCalendarios, fmtFecha, siguienteLunes } from '../../context/CalendariosContext'
import { usePermisos } from '../../hooks/usePermisos'
import { apiAssignSubscription, apiAddCredencialCliente, apiRemoveCredencialCliente, refreshFromServer } from '../../lib/storage'
import PasswordRequisitos from '../../components/PasswordRequisitos'
import { errorPassword } from '../../lib/passwordPolicy'
import ClienteModal from '../../components/clientes/ClienteModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import CalendarioClienteView from './CalendarioClienteView'
import CalendarioCombinado from './CalendarioCombinado'
import LunesPicker, { getLunes } from '../../components/LunesPicker'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

type Tab = 'info' | 'suscripciones' | 'contactos' | 'dinero' | 'entrenadores'

interface Props {
  cliente: Cliente
  onVolver: () => void
}

export default function ClienteDetalle({ cliente, onVolver }: Props) {
  const {
    catalogo, suscripciones,
    desactivarSuscripcion, borrarSuscripcion, editarFechas, editarCliente,
    clientes,
  } = useClientes()
  const { programas } = usePlanificacion()
  const { calendariosDeCliente, borrarCalendario } = useCalendarios()
  const { esAdmin } = usePermisos()

  const clienteActual = clientes.find(c => c.id === cliente.id) ?? cliente

  const [tab, setTab]                     = useState<Tab>('info')
  const [editModal, setEditModal]         = useState(false)
  const [asignarModal, setAsignarModal]   = useState(false)
  const [quitarSusc, setQuitarSusc]       = useState<string | null>(null)
  const [calendarioAbierto, setCalendarioAbierto] = useState<CalendarioCliente | null>(null)
  const [borrarCal, setBorrarCal]         = useState<CalendarioCliente | null>(null)
  const [seleccion, setSeleccion]         = useState<Set<string>>(new Set())
  const [vistaCombi, setVistaCombi]       = useState(false)

  const [catPendiente, setCatPendiente]   = useState<CatalogoSuscripcion | null>(null)
  const [fechaPendiente, setFechaPendiente] = useState('')

  const [editFechas, setEditFechas]       = useState<SuscripcionCliente | null>(null)
  const [nuevoInicio, setNuevoInicio]     = useState('')
  const [nuevaFin, setNuevaFin]           = useState('')

  // Contactos
  const [contactoEdit, setContactoEdit]   = useState<ContactoCliente | 'nuevo' | null>(null)
  const [borrarContacto, setBorrarContacto] = useState<ContactoCliente | null>(null)

  // Entrenadores (credenciales extra de un box)
  const [nuevoEntrenador, setNuevoEntrenador] = useState(false)
  const [entEmail, setEntEmail]           = useState('')
  const [entPassword, setEntPassword]     = useState('')
  const [entConfirm, setEntConfirm]       = useState('')
  const [entError, setEntError]           = useState('')
  const [entGuardando, setEntGuardando]   = useState(false)
  const [borrarEntrenador, setBorrarEntrenador] = useState<{ id: string; email: string } | null>(null)
  const [confirmarQuitarBox, setConfirmarQuitarBox] = useState(false)

  const missSuscs = suscripciones.filter(s => s.clienteId === clienteActual.id)
  const missSuscsActivas = missSuscs.filter(s => s.activa)
  const misCalendarios = calendariosDeCliente(clienteActual.id)
  const contactos = clienteActual.contactos ?? []

  const catalogoDisponible = catalogo.filter(
    cat => !missSuscsActivas.some(s => s.catalogoId === cat.id),
  )

  // ── Pagos (derivados de las suscripciones) ──────────────────────────────────
  const pagos = missSuscs
    .map(s => {
      const cat = catalogo.find(c => c.id === s.catalogoId)
      if (!cat) return null
      const gratis = cat.primerMesPrueba || (cat.precioMensual ?? 0) === 0
      return {
        id: s.id,
        catalogoId: cat.id,
        fecha: s.fechaInicio,
        concepto: cat.nombre,
        tipo: cat.tipo as 'unico' | 'recurrente',
        importe: gratis ? 0 : cat.precioMensual,
        gratis,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  // Lifetime value = suma histórica de todo lo pagado
  const totalPagado = pagos.reduce((acc, p) => acc + p.importe, 0)
  // Precio medio mensual = media de los pagos no gratuitos
  const pagosConCoste = pagos.filter(p => !p.gratis)
  const precioMedioMensual = pagosConCoste.length
    ? Math.round(totalPagado / pagosConCoste.length)
    : 0

  // Color estable por catálogo (para diferenciar visualmente cada suscripción)
  const catalogosEnPagos = [...new Set(pagos.map(p => p.catalogoId))]
  const colorDeCatalogo = (catId: string) =>
    CALENDAR_COLORS[catalogosEnPagos.indexOf(catId) % CALENDAR_COLORS.length]

  // ── Recomendación: producto más probable que compre ahora ──────────────────
  // Heurística: popularidad de cada catálogo entre TODOS los clientes (suscs activas),
  // excluyendo los que este cliente ya tiene activos, la prueba 'Test' y los gratuitos.
  const popularidad: Record<string, number> = {}
  suscripciones.filter(s => s.activa).forEach(s => {
    popularidad[s.catalogoId] = (popularidad[s.catalogoId] ?? 0) + 1
  })
  const yaActivos = new Set(missSuscsActivas.map(s => s.catalogoId))
  const candidatos = catalogo
    .filter(c => !yaActivos.has(c.id) && c.nombre !== 'Test' && (c.precioMensual ?? 0) > 0)
    .sort((a, b) =>
      (popularidad[b.id] ?? 0) - (popularidad[a.id] ?? 0) ||
      (b.precioMensual ?? 0) - (a.precioMensual ?? 0))
  const recomendado = candidatos[0] ?? null
  const totalActivasGlobal = Object.values(popularidad).reduce((a, b) => a + b, 0) || 1
  const afinidad = recomendado
    ? Math.min(96, Math.max(42, Math.round(((popularidad[recomendado.id] ?? 0) / totalActivasGlobal) * 100) + 42))
    : 0

  // ── Asignar producto: pasa por la API (crea suscripción + calendarios server-side) ──
  const asignarPorAPI = async (catalogoId: string, fechaInicio?: string) => {
    try {
      await apiAssignSubscription(clienteActual.id, fechaInicio ? { catalogoId, fechaInicio } : { catalogoId })
      await refreshFromServer()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo asignar el producto')
    }
  }

  const seleccionarCatalogo = (cat: CatalogoSuscripcion) => {
    // "Basic" nunca lleva fecha (no se programa por semanas) — se ignora en este check
    const tieneRecurrenteSinFecha = cat.tipo === 'recurrente' &&
      cat.programas.some(p => p.programaId && p.programaId !== BASIC_PROGRAM_ID && !p.fechaInicio)
    if (cat.tipo === 'recurrente' && cat.programas.length > 0 && tieneRecurrenteSinFecha) {
      setCatPendiente(cat)
      setFechaPendiente(cat.programas[0]?.fechaInicio ?? siguienteLunes())
      setAsignarModal(false)
    } else {
      setAsignarModal(false)
      void asignarPorAPI(cat.id)
    }
  }

  const confirmarRecurrente = () => {
    if (!catPendiente) return
    const fecha = getLunes(fechaPendiente)
    const catId = catPendiente.id
    setCatPendiente(null)
    void asignarPorAPI(catId, fecha)
  }

  // ── Contactos ────────────────────────────────────────────────────────────────
  const guardarContacto = (data: ContactoCliente) => {
    const lista = clienteActual.contactos ?? []
    const existe = lista.some(c => c.id === data.id)
    const next = existe ? lista.map(c => c.id === data.id ? data : c) : [...lista, data]
    editarCliente(clienteActual.id, { contactos: next })
    setContactoEdit(null)
  }
  const eliminarContacto = (id: string) => {
    editarCliente(clienteActual.id, { contactos: (clienteActual.contactos ?? []).filter(c => c.id !== id) })
    setBorrarContacto(null)
  }

  // ── Entrenadores (credenciales extra de un box) ───────────────────────────────
  const crearEntrenador = async (e: FormEvent) => {
    e.preventDefault()
    setEntError('')
    if (!entEmail.trim()) return setEntError('El email es obligatorio')
    const err = errorPassword(entPassword)
    if (err) return setEntError(err)
    if (entPassword !== entConfirm) return setEntError('Las contraseñas no coinciden')
    setEntGuardando(true)
    try {
      await apiAddCredencialCliente(clienteActual.id, entEmail.trim(), entPassword)
      await refreshFromServer()
      setNuevoEntrenador(false); setEntEmail(''); setEntPassword(''); setEntConfirm('')
    } catch (err) {
      setEntError(err instanceof Error ? err.message : 'No se pudo añadir el entrenador')
    } finally {
      setEntGuardando(false)
    }
  }
  const eliminarEntrenador = async (credId: string) => {
    try {
      await apiRemoveCredencialCliente(clienteActual.id, credId)
      await refreshFromServer()
    } finally {
      setBorrarEntrenador(null)
    }
  }
  const toggleEsBox = () => {
    // Al quitar "box" con entrenadores ya dados de alta, avisamos: no se borran,
    // pero dejan de poder entrar hasta que se vuelva a marcar como box.
    if (clienteActual.esBox && (clienteActual.credencialesExtra ?? []).length > 0) {
      setConfirmarQuitarBox(true)
    } else {
      editarCliente(clienteActual.id, { esBox: !clienteActual.esBox })
    }
  }

  // ── Vistas a pantalla completa ────────────────────────────────────────────────
  if (vistaCombi && seleccion.size > 0) {
    const calsSeleccionados = misCalendarios.filter(c => seleccion.has(c.id))
    return <CalendarioCombinado calendarios={calsSeleccionados} onVolver={() => setVistaCombi(false)} />
  }
  if (calendarioAbierto) {
    return <CalendarioClienteView calendario={calendarioAbierto} onVolver={() => setCalendarioAbierto(null)} />
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Información', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    ) },
    { id: 'suscripciones', label: 'Suscripciones', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
    ) },
    { id: 'contactos', label: 'Contactos', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    ) },
    { id: 'dinero', label: 'Dinero', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) },
    ...(clienteActual.esBox ? [{ id: 'entrenadores' as Tab, label: 'Entrenadores', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M9 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M13 7a3 3 0 11-6 0 3 3 0 016 0zm7 3a2 2 0 11-4 0 2 2 0 014 0zM6 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    ) }] : []),
  ]

  const inicial = (clienteActual.nombre[0] ?? '?').toUpperCase()

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <button onClick={onVolver}
          className="p-2 text-tn-muted hover:text-white hover:bg-tn-card rounded-lg transition-all mt-0.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-400 font-black">{inicial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-black text-white">{clienteActual.nombre} {clienteActual.apellido}</h2>
            {clienteActual.activo
              ? <span className="badge-active text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Activo</span>
              : <span className="badge-inactive text-xs"><span className="w-1.5 h-1.5 rounded-full bg-tn-muted" />Inactivo</span>}
            {clienteActual.esBox && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-tn-yellow/10 text-tn-yellow">Box</span>
            )}
          </div>
          <p className="text-tn-muted text-sm mt-0.5 font-mono">{clienteActual.email}</p>
        </div>
        <button onClick={() => setEditModal(true)} className="btn-secondary flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-tn-dark border border-tn-border rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-tn-yellow text-tn-black' : 'text-tn-muted hover:text-white'
            }`}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════ TAB: INFORMACIÓN ════════════ */}
      {tab === 'info' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Datos personales
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Nombre', value: `${clienteActual.nombre} ${clienteActual.apellido}` },
                { label: 'Email', value: clienteActual.email },
                { label: 'Teléfono', value: clienteActual.telefono || '—' },
                { label: 'DNI', value: clienteActual.dni || '—' },
                { label: 'Dirección', value: clienteActual.direccion || '—' },
                { label: 'Alta', value: fmtDate(clienteActual.creadoEn) },
                { label: 'Baja', value: fmtDate(clienteActual.bajaEn) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-tn-muted text-xs font-medium mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-white break-words">{value}</p>
                </div>
              ))}
            </div>

            {/* Es un box: toggle directo, sin pasar por Editar */}
            <div className="mt-5 pt-4 border-t border-tn-border flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-semibold">Es un box</p>
                <p className="text-tn-muted text-xs mt-0.5">
                  Podrá dar de alta entrenadores con el mismo acceso que esta cuenta.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={clienteActual.esBox === true}
                onClick={toggleEsBox}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${clienteActual.esBox ? 'bg-tn-yellow' : 'bg-tn-border'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${clienteActual.esBox ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>

          {/* Facturación */}
          <div className="card p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
              Facturación
            </h3>
            {!clienteActual.razonSocial && !clienteActual.nif && !clienteActual.direccionFacturacion && !clienteActual.emailFacturacion ? (
              <p className="text-tn-muted text-sm">Sin datos de facturación. Pulsa <span className="text-tn-yellow">Editar</span> para añadirlos.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Razón social', value: clienteActual.razonSocial || '—' },
                  { label: 'NIF / CIF', value: clienteActual.nif || '—' },
                  { label: 'Email facturación', value: clienteActual.emailFacturacion || '—' },
                  { label: 'Dirección fiscal', value: clienteActual.direccionFacturacion || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-tn-muted text-xs font-medium mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-white break-words">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════ TAB: SUSCRIPCIONES ════════════ */}
      {tab === 'suscripciones' && (
        <div className="space-y-6">
          {/* Suscripciones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                Suscripciones y productos
                {missSuscsActivas.length > 0 && (
                  <span className="text-tn-muted font-normal text-sm">({missSuscsActivas.length} activa{missSuscsActivas.length !== 1 ? 's' : ''})</span>
                )}
              </h3>
              {catalogoDisponible.length > 0 && (
                <button className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4" onClick={() => setAsignarModal(true)}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Asignar
                </button>
              )}
            </div>

            {missSuscs.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-tn-border rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                </div>
                <p className="text-white font-semibold text-sm mb-1">Sin suscripciones</p>
                <p className="text-tn-muted text-xs mb-4">
                  {catalogo.length === 0 ? 'Crea suscripciones en el catálogo primero' : 'Asigna una suscripción del catálogo a este cliente'}
                </p>
                {catalogoDisponible.length > 0 && (
                  <button className="btn-primary flex items-center gap-2 text-sm py-2 px-4" onClick={() => setAsignarModal(true)}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
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
                    <div key={s.id} className={`card p-4 flex items-center gap-4 transition-all ${vigente ? '' : 'opacity-70 border-red-400/30 bg-red-400/[0.03]'}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cat?.tipo === 'recurrente' ? 'bg-blue-400/10' : 'bg-green-400/10'}`}>
                        {cat?.tipo === 'recurrente' ? (
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">{cat?.nombre ?? '—'}</p>
                          {vigente
                            ? <span className="badge-active text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Vigente</span>
                            : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-400/10 text-red-400 inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{s.activa ? 'Fuera de fecha' : 'Desactivada'}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {cat?.programas.map(pa => {
                            if (pa.programaId === BASIC_PROGRAM_ID) {
                              return <span key={pa.programaId} className="text-tn-muted text-xs">🌬️ {BASIC_PROGRAM_NOMBRE}</span>
                            }
                            const pr = programas.find(p => p.id === pa.programaId)
                            return pr ? <span key={pa.programaId} className="text-tn-muted text-xs">📋 {pr.nombre}</span> : null
                          })}
                          <span className={`text-xs ${vigente ? 'text-tn-muted' : 'text-red-400/80'}`}>{fmtDate(s.fechaInicio)} → {fmtDate(s.fechaFin)}</span>
                          {cat?.precioMensual ? <span className="text-tn-muted text-xs">{cat.precioMensual} €/mes</span> : null}
                          {cat?.tipo && <span className={`text-xs font-medium ${cat.tipo === 'recurrente' ? 'text-blue-400' : 'text-green-400'}`}>{cat.tipo === 'recurrente' ? '↻ Recurrente' : '✓ Pago único'}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {esAdmin && (
                          <button onClick={() => { setEditFechas(s); setNuevoInicio(s.fechaInicio.split('T')[0]); setNuevaFin(s.fechaFin) }}
                            title="Editar fechas" className="p-2 text-tn-muted hover:text-tn-yellow hover:bg-tn-yellow/5 rounded-lg transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        )}
                        {s.activa && (
                          <button onClick={() => setQuitarSusc(s.id)} title="Desactivar suscripción" className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          </button>
                        )}
                        <button onClick={() => borrarSuscripcion(s.id)} title="Eliminar" className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Calendarios */}
          {misCalendarios.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Calendarios <span className="text-tn-muted font-normal text-sm">({misCalendarios.length})</span>
                </h3>
                {seleccion.size > 0 && (
                  <button onClick={() => setVistaCombi(true)} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    Ver combinado ({seleccion.size})
                  </button>
                )}
              </div>
              {misCalendarios.length > 1 && seleccion.size === 0 && (
                <p className="text-tn-muted text-xs">Marca varios calendarios para verlos juntos y comprobar el equilibrio semanal.</p>
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
                    <div key={cal.id} onClick={toggleSeleccion}
                      className={`card p-4 flex items-center justify-between gap-4 transition-all group cursor-pointer border ${checked ? colorDef.cls + ' opacity-100' : 'border-tn-border hover:border-tn-border/80'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'border-transparent' : 'border-tn-border group-hover:border-tn-muted'}`}
                          style={checked ? { backgroundColor: colorDef.accent, borderColor: colorDef.accent } : {}}>
                          {checked && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className={`w-8 h-8 rounded-lg ${colorDef.badge} flex items-center justify-center flex-shrink-0`}>
                          <svg className="w-4 h-4" style={{ color: colorDef.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{cal.programaNombre}</p>
                          <p className="text-tn-muted text-xs">Desde {fmtFecha(cal.fechaInicio)} · {cal.semanas.length} semanas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setCalendarioAbierto(cal)} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          Ver
                        </button>
                        <button onClick={() => setBorrarCal(cal)} className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Eliminar calendario">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════ TAB: CONTACTOS ════════════ */}
      {tab === 'contactos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Contactos {contactos.length > 0 && <span className="text-tn-muted font-normal text-sm">({contactos.length})</span>}
            </h3>
            <button className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4" onClick={() => setContactoEdit('nuevo')}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Nuevo contacto
            </button>
          </div>

          {contactos.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-tn-border rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-white font-semibold text-sm mb-1">Sin contactos</p>
              <p className="text-tn-muted text-xs">Añade contactos asociados a este cliente (familiares, emergencia, comercial...)</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contactos.map(c => (
                <div key={c.id} className="card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-tn-border flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">{(c.nombre[0] ?? '?').toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{c.nombre}</p>
                      {c.relacion && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-tn-yellow/10 text-tn-yellow">{c.relacion}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.telefono && <span className="text-tn-muted text-xs">📞 {c.telefono}</span>}
                      {c.email && <span className="text-tn-muted text-xs">✉ {c.email}</span>}
                    </div>
                    {c.notas && <p className="text-tn-muted text-xs mt-1 italic">{c.notas}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    <button title="Iniciar onboarding (próximamente)"
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Iniciar onboarding
                    </button>
                    <button title="Iniciar contacto (próximamente)"
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Iniciar contacto
                    </button>
                    <button title="Contactar con ScaleX (próximamente)"
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" />
                      </svg>
                      Contactar con ScaleX
                    </button>
                    <button onClick={() => setContactoEdit(c)} title="Editar" className="p-2 text-tn-muted hover:text-white hover:bg-tn-border rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => setBorrarContacto(c)} title="Eliminar" className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════ TAB: DINERO ════════════ */}
      {tab === 'dinero' && (
        <div className="space-y-4">
          {/* Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Lifetime value */}
            <div className="card px-5 py-4 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-tn-yellow/10" />
              <p className="text-tn-muted text-xs font-medium mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Lifetime value
              </p>
              <p className="text-2xl font-black text-tn-yellow relative">{totalPagado} €</p>
              <p className="text-tn-muted/60 text-xs mt-0.5 relative">Total histórico pagado</p>
            </div>
            {/* Precio medio mensual */}
            <div className="card px-5 py-4">
              <p className="text-tn-muted text-xs font-medium mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                Precio medio mensual
              </p>
              <p className="text-2xl font-black text-white">{precioMedioMensual} €</p>
              <p className="text-tn-muted/60 text-xs mt-0.5">Media por suscripción</p>
            </div>
            {/* Pagos */}
            <div className="card px-5 py-4 col-span-2 lg:col-span-1">
              <p className="text-tn-muted text-xs font-medium mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Pagos registrados
              </p>
              <p className="text-2xl font-black text-white">{pagos.length}</p>
              <p className="text-tn-muted/60 text-xs mt-0.5">{missSuscsActivas.length} activa{missSuscsActivas.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Recomendación: próxima compra probable */}
          {recomendado && (
            <div className="card p-5 relative overflow-hidden border-tn-yellow/30">
              <div className="absolute inset-0 bg-gradient-to-r from-tn-yellow/[0.07] to-transparent pointer-events-none" />
              <div className="flex items-center justify-between gap-4 flex-wrap relative">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-tn-yellow/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">Próxima compra probable</p>
                    <p className="text-white font-black text-lg truncate">{recomendado.nombre}</p>
                    <p className="text-tn-muted text-xs">
                      {recomendado.precioMensual} €{recomendado.tipo === 'recurrente' ? '/mes' : ' · pago único'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-tn-yellow font-black text-2xl">{afinidad}%</p>
                  <p className="text-tn-muted text-xs">afinidad</p>
                </div>
              </div>
              {/* Barra de afinidad */}
              <div className="mt-3 h-1.5 bg-tn-border rounded-full overflow-hidden relative">
                <div className="h-full bg-tn-yellow rounded-full transition-all" style={{ width: `${afinidad}%` }} />
              </div>
            </div>
          )}

          {/* Tabla de pagos */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-tn-border">
              <h3 className="text-white font-bold flex items-center gap-2">
                <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Pagos por suscripciones
              </h3>
            </div>
            {pagos.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-tn-muted text-sm">Este cliente todavía no tiene pagos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-tn-border">
                      {['Fecha', 'Concepto', 'Tipo', 'Importe'].map(h => (
                        <th key={h} className={`text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-3 ${h === 'Importe' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tn-border">
                    {pagos.map(p => {
                      const color = colorDeCatalogo(p.catalogoId)
                      return (
                        <tr key={p.id} className="hover:bg-tn-dark/40 transition-colors">
                          <td className="px-5 py-3 text-tn-muted text-sm whitespace-nowrap">{fmtDate(p.fecha)}</td>
                          <td className="px-5 py-3">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color.accent }} />
                              <span className="text-white text-sm font-medium">{p.concepto}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium ${p.tipo === 'recurrente' ? 'text-blue-400' : 'text-green-400'}`}>
                              {p.tipo === 'recurrente' ? '↻ Recurrente' : '✓ Pago único'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            {p.gratis
                              ? <span className="text-tn-muted text-sm italic">Gratis (prueba)</span>
                              : <span className="font-semibold text-sm" style={{ color: color.accent }}>{p.importe} €</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-tn-border bg-tn-dark/30">
                      <td colSpan={3} className="px-5 py-3 text-tn-muted text-sm font-semibold text-right">Total</td>
                      <td className="px-5 py-3 text-right text-tn-yellow font-black">{totalPagado} €</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════ TAB: ENTRENADORES ════════════ */}
      {tab === 'entrenadores' && clienteActual.esBox && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M9 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M13 7a3 3 0 11-6 0 3 3 0 016 0zm7 3a2 2 0 11-4 0 2 2 0 014 0zM6 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  Entrenadores
                </h3>
                <p className="text-tn-muted text-xs mt-0.5">
                  Acceden con su propio email y contraseña, con el mismo acceso que {clienteActual.nombre}.
                </p>
              </div>
              {!nuevoEntrenador && (
                <button type="button" onClick={() => setNuevoEntrenador(true)} className="btn-secondary flex items-center gap-2 text-sm py-2 px-3 whitespace-nowrap">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Añadir entrenador
                </button>
              )}
            </div>

            {nuevoEntrenador && (
              <form onSubmit={crearEntrenador} className="border border-tn-border rounded-xl p-4 space-y-3 mb-4">
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input-field" placeholder="entrenador@ejemplo.com" autoFocus
                    value={entEmail} onChange={e => setEntEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Contraseña *</label>
                    <input type="password" className="input-field" placeholder="••••••••" autoComplete="new-password"
                      value={entPassword} onChange={e => setEntPassword(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Confirmar *</label>
                    <input type="password" className="input-field" placeholder="••••••••" autoComplete="new-password"
                      value={entConfirm} onChange={e => setEntConfirm(e.target.value)} required />
                  </div>
                </div>
                {entPassword && <PasswordRequisitos password={entPassword} />}
                {entError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{entError}</div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" className="btn-secondary flex-1"
                    onClick={() => { setNuevoEntrenador(false); setEntError(''); setEntEmail(''); setEntPassword(''); setEntConfirm('') }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={entGuardando}>
                    {entGuardando ? 'Guardando...' : 'Añadir'}
                  </button>
                </div>
              </form>
            )}

            {(clienteActual.credencialesExtra ?? []).length === 0 ? (
              <p className="text-tn-muted text-sm text-center py-6">Todavía no hay entrenadores dados de alta.</p>
            ) : (
              <div className="divide-y divide-tn-border">
                {(clienteActual.credencialesExtra ?? []).map(cr => (
                  <div key={cr.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{cr.email}</p>
                      <p className="text-tn-muted text-xs">Alta: {fmtDate(cr.creadoEn)}</p>
                    </div>
                    <button type="button" onClick={() => setBorrarEntrenador({ id: cr.id, email: cr.email })}
                      className="p-2 text-tn-muted hover:text-red-400 transition-colors flex-shrink-0" title="Eliminar entrenador">
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
      )}

      {/* ════════════ MODALES ════════════ */}

      {/* Asignar suscripción */}
      {asignarModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-tn-border flex-shrink-0">
              <div>
                <h3 className="text-white font-bold">Asignar suscripción</h3>
                <p className="text-tn-muted text-xs mt-0.5">{clienteActual.nombre} {clienteActual.apellido}</p>
              </div>
              <button onClick={() => setAsignarModal(false)} className="text-tn-muted hover:text-white p-1 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {catalogoDisponible.length === 0 ? (
                <div className="text-center py-8"><p className="text-tn-muted text-sm">Este cliente ya tiene todas las suscripciones activas</p></div>
              ) : (
                catalogoDisponible.map(cat => {
                  const progsAsoc = cat.programas.map(pa =>
                    pa.programaId === BASIC_PROGRAM_ID
                      ? { id: BASIC_PROGRAM_ID, nombre: BASIC_PROGRAM_NOMBRE }
                      : programas.find(p => p.id === pa.programaId),
                  ).filter(Boolean)
                  return (
                    <button key={cat.id} onClick={() => seleccionarCatalogo(cat)} className="w-full card px-4 py-4 text-left hover:border-tn-yellow transition-all group">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cat.tipo === 'recurrente' ? 'bg-blue-400/10' : 'bg-green-400/10'}`}>
                          {cat.tipo === 'recurrente' ? (
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          ) : (
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">{cat.nombre}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-medium ${cat.tipo === 'recurrente' ? 'text-blue-400' : 'text-green-400'}`}>{cat.tipo === 'recurrente' ? '↻ Recurrente' : '✓ Pago único'}</span>
                            {cat.precioMensual ? <span className="text-tn-muted text-xs">{cat.precioMensual} €/mes</span> : null}
                            {progsAsoc.map(p => <span key={p!.id} className="text-tn-muted text-xs">· {p!.nombre}</span>)}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-tn-muted group-hover:text-tn-yellow transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            <div className="p-4 border-t border-tn-border flex-shrink-0">
              <button onClick={() => setAsignarModal(false)} className="btn-secondary w-full">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Elegir lunes para recurrente */}
      {catPendiente && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-white font-bold text-lg">Fecha de inicio</h3>
              <p className="text-tn-muted text-sm mt-0.5">Suscripción: <span className="text-white font-medium">{catPendiente.nombre}</span></p>
            </div>
            <LunesPicker value={fechaPendiente} onChange={setFechaPendiente} label="Lunes de inicio *" hint="El programa comenzará en este lunes para este cliente" />
            <div className="bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-3">
              <p className="text-tn-yellow/80 text-xs">El calendario personal del cliente se generará automáticamente a partir de este lunes.</p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setCatPendiente(null)}>Cancelar</button>
              <button className="btn-primary flex-1" disabled={!fechaPendiente} onClick={confirmarRecurrente}>Asignar y crear calendario</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm borrar calendario */}
      {borrarCal && (
        <ConfirmDialog title="Eliminar calendario"
          description={`¿Eliminar el calendario "${borrarCal.programaNombre}"? Se perderán todos los entrenamientos personalizados.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrarCalendario(borrarCal.id); setBorrarCal(null) }}
          onCancel={() => setBorrarCal(null)} />
      )}

      {/* Confirm desactivar suscripción */}
      {quitarSusc && (
        <ConfirmDialog title="Desactivar suscripción"
          description="¿Desactivar esta suscripción? El cliente perderá acceso al programa asociado."
          confirmLabel="Desactivar"
          onConfirm={() => { desactivarSuscripcion(quitarSusc); setQuitarSusc(null) }}
          onCancel={() => setQuitarSusc(null)} />
      )}

      {/* Editar cliente */}
      {editModal && <ClienteModal cliente={clienteActual} onClose={() => setEditModal(false)} />}

      {/* Editar fechas suscripción */}
      {editFechas && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-white font-bold text-lg">Editar fechas</h3>
              <p className="text-tn-muted text-sm mt-0.5">{catalogo.find(c => c.id === editFechas.catalogoId)?.nombre ?? 'Suscripción'}</p>
            </div>
            <div>
              <label className="label">Fecha de inicio</label>
              <input type="date" className="input-field" value={nuevoInicio} onChange={e => setNuevoInicio(e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de fin</label>
              <input type="date" className="input-field" value={nuevaFin} min={nuevoInicio} onChange={e => setNuevaFin(e.target.value)} />
            </div>
            {nuevoInicio && nuevaFin && nuevaFin < nuevoInicio && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">La fecha de fin no puede ser anterior a la de inicio</div>
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setEditFechas(null)}>Cancelar</button>
              <button className="btn-primary flex-1" disabled={!nuevoInicio || !nuevaFin || nuevaFin < nuevoInicio}
                onClick={() => {
                  const horaOriginal = editFechas.fechaInicio.includes('T') ? editFechas.fechaInicio.split('T')[1] : '00:00:00.000Z'
                  editarFechas(editFechas.id, `${nuevoInicio}T${horaOriginal}`, nuevaFin)
                  setEditFechas(null)
                }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal contacto (crear/editar) */}
      {contactoEdit && (
        <ContactoModal
          contacto={contactoEdit === 'nuevo' ? null : contactoEdit}
          onGuardar={guardarContacto}
          onCancelar={() => setContactoEdit(null)}
        />
      )}

      {/* Confirm borrar contacto */}
      {borrarContacto && (
        <ConfirmDialog title="Eliminar contacto"
          description={`¿Eliminar a "${borrarContacto.nombre}" de los contactos del cliente?`}
          confirmLabel="Eliminar"
          onConfirm={() => eliminarContacto(borrarContacto.id)}
          onCancel={() => setBorrarContacto(null)} />
      )}

      {/* Confirm borrar entrenador */}
      {borrarEntrenador && (
        <ConfirmDialog title="Eliminar entrenador"
          description={`¿Eliminar el acceso de "${borrarEntrenador.email}"? Dejará de poder entrar con esas credenciales.`}
          confirmLabel="Eliminar"
          onConfirm={() => void eliminarEntrenador(borrarEntrenador.id)}
          onCancel={() => setBorrarEntrenador(null)} />
      )}

      {/* Confirm quitar "box" teniendo entrenadores dados de alta */}
      {confirmarQuitarBox && (
        <ConfirmDialog title='Quitar "Es un box"'
          description={`Este cliente tiene ${(clienteActual.credencialesExtra ?? []).length} entrenador(es) dado(s) de alta. Dejarán de poder entrar hasta que vuelvas a marcarlo como box (no se borran).`}
          confirmLabel="Quitar de todos modos"
          onConfirm={() => { editarCliente(clienteActual.id, { esBox: false }); setConfirmarQuitarBox(false) }}
          onCancel={() => setConfirmarQuitarBox(false)} />
      )}
    </div>
  )
}

// ─── Modal de contacto ──────────────────────────────────────────────────────
function ContactoModal({ contacto, onGuardar, onCancelar }: {
  contacto: ContactoCliente | null
  onGuardar: (c: ContactoCliente) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre]     = useState(contacto?.nombre ?? '')
  const [relacion, setRelacion] = useState(contacto?.relacion ?? '')
  const [telefono, setTelefono] = useState(contacto?.telefono ?? '')
  const [email, setEmail]       = useState(contacto?.email ?? '')
  const [notas, setNotas]       = useState(contacto?.notas ?? '')
  const [error, setError]       = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    onGuardar({
      id: contacto?.id ?? genId(),
      nombre: nombre.trim(), relacion: relacion.trim(),
      telefono: telefono.trim(), email: email.trim(), notas: notas.trim(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-tn-border">
          <h3 className="text-white font-bold text-lg">{contacto ? 'Editar contacto' : 'Nuevo contacto'}</h3>
          <button onClick={onCancelar} className="text-tn-muted hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input type="text" className="input-field" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus required />
            </div>
            <div>
              <label className="label">Relación</label>
              <input type="text" className="input-field" placeholder="Familiar, Emergencia..." value={relacion} onChange={e => setRelacion(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input type="tel" className="input-field" placeholder="+34 600 000 000" value={telefono} onChange={e => setTelefono(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input-field" placeholder="correo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input-field resize-none h-20" placeholder="Notas opcionales..." value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onCancelar}>Cancelar</button>
            <button type="submit" className="btn-primary flex-1">{contacto ? 'Guardar' : 'Añadir contacto'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
