import { useState } from 'react'
import { useClientes } from '../context/ClientesContext'
import { CALENDAR_COLORS } from '../types'
import { saveKV } from '../lib/storage'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function diasEntre(aISO: string, bISO: string) {
  const a = new Date(aISO.split('T')[0]).getTime()
  const b = new Date(bISO.split('T')[0]).getTime()
  return Math.round((b - a) / 86400000)
}

type Prioridad = 'alta' | 'media' | 'baja'
interface Tarea {
  id: string
  prioridad: Prioridad
  tipo: string
  titulo: string
  detalle: string
  fecha: string   // fecha de referencia (para ordenar desc)
}

const KEY_COMPLETADAS = 'im_tareas_completadas'
function loadCompletadas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY_COMPLETADAS) ?? '{}') } catch { return {} }
}
const PRIO_STYLE: Record<Prioridad, { dot: string; label: string; cls: string }> = {
  alta:  { dot: 'bg-red-400',    label: 'Alta',  cls: 'text-red-400' },
  media: { dot: 'bg-tn-yellow',  label: 'Media', cls: 'text-tn-yellow' },
  baja:  { dot: 'bg-blue-400',   label: 'Baja',  cls: 'text-blue-400' },
}

export default function Dashboard() {
  const { catalogo, suscripciones, clientes } = useClientes()

  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [completadas, setCompletadas] = useState<Record<string, string>>(loadCompletadas)

  const HOY = hoyISO()

  const toggleTarea = (id: string) => {
    setCompletadas(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = new Date().toISOString()
      saveKV(KEY_COMPLETADAS, next)
      return next
    })
  }

  // Filtro por fecha de compra (fechaInicio de la suscripción)
  const enRango = (iso: string) => {
    const d = iso.split('T')[0]
    if (desde && d < desde) return false
    if (hasta && d > hasta) return false
    return true
  }
  const suscsFiltradas = suscripciones.filter(s => enRango(s.fechaInicio))

  // Agregado por catálogo
  const filas = catalogo
    .filter(c => !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .map((c, i) => {
      const suyas = suscsFiltradas.filter(s => s.catalogoId === c.id)
      const dinero = suyas.reduce(acc => acc + (c.primerMesPrueba || !c.precioMensual ? 0 : c.precioMensual), 0)
      return { cat: c, compras: suyas.length, dinero, color: CALENDAR_COLORS[i % CALENDAR_COLORS.length] }
    })
    .sort((a, b) => b.dinero - a.dinero || b.compras - a.compras)

  const totalCompras = filas.reduce((a, f) => a + f.compras, 0)
  const totalDinero = filas.reduce((a, f) => a + f.dinero, 0)
  const maxDinero = Math.max(1, ...filas.map(f => f.dinero))

  // ── Tareas sugeridas ──────────────────────────────────────────────────────
  const tareas: Tarea[] = []
  suscripciones.forEach(s => {
    const cat = catalogo.find(c => c.id === s.catalogoId)
    const cli = clientes.find(c => c.id === s.clienteId)
    if (!cat || !cli || !cli.activo || cat.tipo !== 'recurrente' || !s.activa) return
    const nombre = `${cli.nombre} ${cli.apellido}`.trim()
    const dias = diasEntre(HOY, s.fechaFin) // >0 futuro, <0 pasado
    const esTest = cat.nombre === 'Test'

    if (dias >= 0 && dias <= 7) {
      tareas.push({
        id: 'fin-' + s.id,
        prioridad: dias <= 3 ? 'alta' : 'media',
        tipo: esTest ? 'Fin de prueba' : 'Renovación',
        titulo: esTest ? `Termina la prueba de ${nombre}` : `Renovación próxima · ${nombre}`,
        detalle: `${cat.nombre} ${dias === 0 ? 'caduca hoy' : `caduca en ${dias} día${dias !== 1 ? 's' : ''}`} (${fmtDate(s.fechaFin)})`,
        fecha: s.fechaFin,
      })
    } else if (dias < 0 && dias >= -30 && !esTest) {
      tareas.push({
        id: 'cad-' + s.id,
        prioridad: 'alta',
        tipo: 'Caducada',
        titulo: `Renovar suscripción · ${nombre}`,
        detalle: `${cat.nombre} caducó el ${fmtDate(s.fechaFin)} — contactar para renovar`,
        fecha: s.fechaFin,
      })
    }
  })
  // Seguimiento de clientes recurrentes veteranos
  clientes.filter(c => c.activo).forEach(cli => {
    const recActiva = suscripciones.some(s => {
      const cat = catalogo.find(c => c.id === s.catalogoId)
      return s.clienteId === cli.id && s.activa && cat?.tipo === 'recurrente' && cat?.nombre !== 'Test'
    })
    const dias = diasEntre(cli.creadoEn, HOY)
    if (recActiva && dias > 60) {
      tareas.push({
        id: 'seg-' + cli.id,
        prioridad: 'baja',
        tipo: 'Seguimiento',
        titulo: `Contactar a ${cli.nombre} ${cli.apellido}`.trim(),
        detalle: `Cliente recurrente desde hace ${Math.round(dias / 30)} meses · seguimiento de fidelización`,
        fecha: cli.creadoEn,
      })
    }
  })
  // Ocultar las completadas hace 2 días o más; ordenar por fecha descendente
  const tareasVisibles = tareas.filter(t => {
    const done = completadas[t.id]
    return !done || diasEntre(done, new Date().toISOString()) < 2
  })
  tareasVisibles.sort((a, b) => b.fecha.localeCompare(a.fecha))
  const tareasTop = tareasVisibles.slice(0, 12)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white">Dashboard</h2>
        <p className="text-tn-muted text-sm mt-1">Resumen de suscripciones y tareas sugeridas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ingresos totales', value: `${totalDinero} €`, color: 'text-tn-yellow' },
          { label: 'Compras', value: totalCompras, color: 'text-white' },
          { label: 'Suscripciones', value: catalogo.length, color: 'text-white' },
        ].map(k => (
          <div key={k.label} className="card px-5 py-4">
            <p className="text-tn-muted text-xs font-medium mb-1">{k.label}</p>
            <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" className="input-field pl-9" placeholder="Buscar suscripción..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <div>
            <input type="date" className="input-field" value={desde} onChange={e => setDesde(e.target.value)} title="Compras desde" />
          </div>
          <span className="text-tn-muted text-sm">→</span>
          <div>
            <input type="date" className="input-field" value={hasta} onChange={e => setHasta(e.target.value)} title="Compras hasta" />
          </div>
          {(desde || hasta) && (
            <button onClick={() => { setDesde(''); setHasta('') }}
              className="p-2 text-tn-muted hover:text-white transition-colors" title="Limpiar fechas">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de suscripciones */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-tn-border">
          <h3 className="text-white font-bold flex items-center gap-2">
            <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            Suscripciones
            <span className="text-tn-muted font-normal text-sm">({filas.length})</span>
          </h3>
        </div>
        {filas.length === 0 ? (
          <div className="py-12 text-center"><p className="text-tn-muted text-sm">Sin suscripciones que coincidan</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tn-border">
                  <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-3">Suscripción</th>
                  <th className="text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Tipo</th>
                  <th className="text-right text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-3">Compras</th>
                  <th className="text-right text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-3">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tn-border">
                {filas.map(f => (
                  <tr key={f.cat.id} className="hover:bg-tn-dark/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color.accent }} />
                        <span className="text-white text-sm font-medium">{f.cat.nombre}</span>
                        {f.cat.precioMensual ? <span className="text-tn-muted text-xs">· {f.cat.precioMensual} €</span> : <span className="text-tn-muted/60 text-xs">· Gratis</span>}
                      </div>
                      {/* Barra de ingresos */}
                      <div className="mt-1.5 h-1 bg-tn-border rounded-full overflow-hidden max-w-xs">
                        <div className="h-full rounded-full" style={{ width: `${(f.dinero / maxDinero) * 100}%`, backgroundColor: f.color.accent }} />
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium ${f.cat.tipo === 'recurrente' ? 'text-blue-400' : 'text-green-400'}`}>
                        {f.cat.tipo === 'recurrente' ? '↻ Recurrente' : '✓ Pago único'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-white text-sm font-semibold">{f.compras}</td>
                    <td className="px-5 py-3 text-right font-bold text-sm" style={{ color: f.color.accent }}>{f.dinero} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-tn-border bg-tn-dark/30">
                  <td className="px-5 py-3 text-tn-muted text-sm font-semibold" colSpan={2}>Total</td>
                  <td className="px-5 py-3 text-right text-white font-bold text-sm">{totalCompras}</td>
                  <td className="px-5 py-3 text-right text-tn-yellow font-black">{totalDinero} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Tareas sugeridas */}
      <div className="space-y-3">
        <h3 className="text-white font-bold flex items-center gap-2">
          <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Tareas sugeridas
          {tareasTop.length > 0 && <span className="text-tn-muted font-normal text-sm">({tareasTop.length})</span>}
        </h3>

        {tareasTop.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-green-400/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white font-semibold text-sm">Todo al día</p>
            <p className="text-tn-muted text-xs mt-1">No hay tareas pendientes ahora mismo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tareasTop.map(t => {
              const st = PRIO_STYLE[t.prioridad]
              const hecha = Boolean(completadas[t.id])
              return (
                <div key={t.id} className={`card p-4 flex items-center gap-4 transition-all ${hecha ? 'opacity-50' : ''}`}>
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTarea(t.id)}
                    title={hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      hecha ? 'bg-green-400 border-green-400' : 'border-tn-border hover:border-tn-yellow'
                    }`}
                  >
                    {hecha && (
                      <svg className="w-4 h-4 text-tn-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  {!hecha && <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${hecha ? 'text-tn-muted line-through' : 'text-white'}`}>{t.titulo}</p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-tn-border/50 text-tn-muted">{t.tipo}</span>
                    </div>
                    <p className="text-tn-muted text-xs mt-0.5">{t.detalle}</p>
                  </div>
                  {hecha
                    ? <span className="text-xs font-semibold text-green-400 flex-shrink-0">Hecha</span>
                    : <span className={`text-xs font-semibold ${st.cls} flex-shrink-0`}>{st.label}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
