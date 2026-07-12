import { useState, useCallback } from 'react'
import { useClientes } from '../../context/ClientesContext'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { useCalendarios, addDays } from '../../context/CalendariosContext'
import { type CatalogoSuscripcion, type ProgramaAsociado, BASIC_PROGRAM_ID, BASIC_PROGRAM_NOMBRE } from '../../types'
import SuscripcionCatalogoModal from '../../components/clientes/SuscripcionCatalogoModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { usePermisos } from '../../hooks/usePermisos'

function TipoBadge({ tipo }: { tipo: 'unico' | 'recurrente' }) {
  return tipo === 'recurrente'
    ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-400/10 text-blue-400">↻ Recurrente</span>
    : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-400/10 text-green-400">✓ Pago único</span>
}

export default function SuscripcionesCatalogo() {
  const { catalogo, borrarCatalogo, suscripciones } = useClientes()
  const { programas } = usePlanificacion()
  const { crearCalendario, calendarios } = useCalendarios()
  const { puede } = usePermisos()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando]   = useState<CatalogoSuscripcion | null>(null)
  const [borrando, setBorrando]   = useState<CatalogoSuscripcion | null>(null)

  /** Tras guardar, crea calendarios para programas recurrentes a clientes activos.
   *  Se incluyen los programas cuya ventana [inicio, inicio + semanas) cubra hoy
   *  (programa completo desde su inicio) y los que empiecen en el futuro. Se
   *  descartan solo los que ya terminaron. */
  const handleSaved = useCallback((catalogoId: string, progsGuardados: ProgramaAsociado[]) => {
    const ahora = new Date()
    const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`

    const aPlanificar = progsGuardados.filter(pa => {
      if (!pa.fechaInicio) return false
      const programa = programas.find(p => p.id === pa.programaId)
      if (!programa) return false
      const finPrograma = addDays(pa.fechaInicio, programa.semanas.length * 7 - 1)
      return finPrograma >= hoyISO   // aún no ha terminado
    })
    if (!aPlanificar.length) return

    const suscsActivas = suscripciones.filter(s => s.catalogoId === catalogoId && s.activa)
    suscsActivas.forEach(s => {
      aPlanificar.forEach(pa => {
        const programa = programas.find(p => p.id === pa.programaId)
        if (!programa) return
        const yaExiste = calendarios.some(
          c => c.suscripcionClienteId === s.id && c.programaId === pa.programaId
        )
        if (!yaExiste) crearCalendario(s.clienteId, s.id, programa, pa.fechaInicio!, undefined)
      })
    })
  }, [suscripciones, programas, calendarios, crearCalendario])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Suscripciones</h2>
          <p className="text-tn-muted text-sm mt-1">
            {catalogo.length === 0
              ? 'Define los tipos de suscripción disponibles'
              : `${catalogo.length} tipo${catalogo.length !== 1 ? 's' : ''} de suscripción`}
          </p>
        </div>
        {puede('suscripciones', 'crear') && (
          <button className="btn-primary flex items-center gap-2 self-start sm:self-auto"
            onClick={() => { setEditando(null); setModalOpen(true) }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nueva suscripción
          </button>
        )}
      </div>

      {catalogo.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-tn-border rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Sin suscripciones</h3>
          <p className="text-tn-muted text-sm mb-6 max-w-sm">
            Define los tipos de suscripción que podrás asignar a tus clientes.
          </p>
          <button className="btn-primary flex items-center gap-2"
            onClick={() => { setEditando(null); setModalOpen(true) }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Crear primera suscripción
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tn-border">
                  {['Suscripción', 'Programa', 'Precio', 'Tipo', 'Clientes', ''].map(h => (
                    <th key={h} className={`text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-4 ${
                      h === 'Programa' ? 'hidden md:table-cell' : ''
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-tn-border">
                {catalogo.map(s => {
                  const clientesConEsta = suscripciones.filter(sc => sc.catalogoId === s.id && sc.activa).length
                  const progsAsoc = s.programas.map(pa =>
                    pa.programaId === BASIC_PROGRAM_ID
                      ? { id: BASIC_PROGRAM_ID, nombre: BASIC_PROGRAM_NOMBRE }
                      : programas.find(p => p.id === pa.programaId),
                  ).filter(Boolean)
                  return (
                    <tr key={s.id} className="hover:bg-tn-dark/40 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-white font-semibold text-sm">{s.nombre}</p>
                        <div className="mt-0.5 md:hidden">
                          {progsAsoc.length === 0
                            ? <span className="text-tn-muted/50 text-xs italic">Sin programa</span>
                            : progsAsoc.map(p => <span key={p!.id} className="text-tn-muted text-xs">{p!.nombre}</span>)}
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {progsAsoc.length === 0
                          ? <span className="text-tn-muted/50 text-sm italic">Sin programa</span>
                          : <div className="flex flex-col gap-0.5">
                              {progsAsoc.map(p => (
                                <span key={p!.id} className="text-tn-muted text-sm">{p!.nombre}</span>
                              ))}
                            </div>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-white font-semibold text-sm">
                            {s.precioMensual ? `${s.precioMensual} €` : '—'}
                            {s.precioMensual ? <span className="text-tn-muted font-normal text-xs">/mes</span> : null}
                          </span>
                          {s.primerMesPrueba && (
                            <span className="text-green-400 text-xs font-medium">1er mes gratis</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4"><TipoBadge tipo={s.tipo} /></td>
                      <td className="px-5 py-4">
                        <span className="text-tn-muted text-sm">{clientesConEsta} activo{clientesConEsta !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          {puede('suscripciones', 'editar') && (
                            <button onClick={() => { setEditando(s); setModalOpen(true) }}
                              className="p-2 text-tn-muted hover:text-white hover:bg-tn-border rounded-lg transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {puede('suscripciones', 'borrar') && (
                            <button onClick={() => setBorrando(s)}
                              className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <SuscripcionCatalogoModal
          item={editando}
          onSaved={handleSaved}
          onClose={() => { setModalOpen(false); setEditando(null) }}
        />
      )}
      {borrando && (
        <ConfirmDialog
          title="Eliminar suscripción"
          description={`¿Eliminar "${borrando.nombre}" del catálogo? Los clientes que ya la tengan asignada no se verán afectados.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrarCatalogo(borrando.id); setBorrando(null) }}
          onCancel={() => setBorrando(null)}
        />
      )}
    </div>
  )
}
