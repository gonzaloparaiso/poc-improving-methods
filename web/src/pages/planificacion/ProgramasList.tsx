import { useState, type FormEvent } from 'react'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { type Programa } from '../../types'
import ConfirmDialog from '../../components/ConfirmDialog'
import ProgramaDetalle from './ProgramaDetalle'
import { usePermisos } from '../../hooks/usePermisos'

function ProgramaCard({ programa, onAbrir, onBorrar, puedeBorrar }: {
  programa: Programa
  onAbrir: () => void
  onBorrar: () => void
  puedeBorrar: boolean
}) {
  const totalBloques = programa.semanas.reduce((acc, s) =>
    acc + s.dias.reduce((a, d) => a + d.bloques.length, 0), 0)

  return (
    <div
      onClick={onAbrir}
      className="card p-5 hover:border-tn-yellow/50 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-lg group-hover:text-tn-yellow transition-colors truncate">
            {programa.nombre}
          </h3>
          {programa.descripcion && (
            <p className="text-tn-muted text-sm mt-1 line-clamp-2">{programa.descripcion}</p>
          )}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-tn-muted text-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {programa.semanas.length} semana{programa.semanas.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 text-tn-muted text-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {totalBloques} bloque{totalBloques !== 1 ? 's' : ''}
            </span>
            <span className="text-tn-muted/60 text-xs">
              {new Date(programa.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        {puedeBorrar && (
          <button
            onClick={e => { e.stopPropagation(); onBorrar() }}
            className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function ProgramasList() {
  const { programas, crearPrograma, borrarPrograma } = usePlanificacion()
  const { puede } = usePermisos()
  const [programaAbierto, setProgramaAbierto] = useState<Programa | null>(null)
  const [modalNuevo, setModalNuevo]           = useState(false)
  const [nombre, setNombre]                   = useState('')
  const [descripcion, setDescripcion]         = useState('')
  const [borrando, setBorrando]               = useState<Programa | null>(null)

  const handleCrear = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    const p = crearPrograma(nombre.trim(), descripcion.trim())
    setNombre(''); setDescripcion(''); setModalNuevo(false)
    setProgramaAbierto(p)
  }

  // Vista de detalle
  if (programaAbierto) {
    // Buscar el programa actualizado en la lista (puede haber cambiado)
    const programaActualizado = programas.find(p => p.id === programaAbierto.id) ?? programaAbierto
    return <ProgramaDetalle programa={programaActualizado} onVolver={() => setProgramaAbierto(null)} />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Programas</h2>
          <p className="text-tn-muted text-sm mt-1">
            {programas.length === 0
              ? 'Crea tu primer programa de entrenamiento'
              : `${programas.length} programa${programas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {puede('planificaciones', 'crear') && (
          <button
            className="btn-primary flex items-center gap-2 self-start sm:self-auto"
            onClick={() => setModalNuevo(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo programa
          </button>
        )}
      </div>

      {programas.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-tn-border rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Sin programas</h3>
          <p className="text-tn-muted text-sm mb-6 max-w-sm">
            Crea un programa para organizar el entrenamiento semanal durante varias semanas.
          </p>
          <button className="btn-primary flex items-center gap-2" onClick={() => setModalNuevo(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Crear primer programa
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {programas.map(p => (
            <ProgramaCard
              key={p.id}
              programa={p}
              onAbrir={() => setProgramaAbierto(p)}
              onBorrar={() => setBorrando(p)}
              puedeBorrar={puede('planificaciones', 'borrar')}
            />
          ))}
        </div>
      )}

      {/* Modal nuevo programa */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="card w-full sm:max-w-md sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl">
            <div className="flex items-center justify-between p-6 border-b border-tn-border">
              <h3 className="text-white font-bold text-lg">Nuevo programa</h3>
              <button onClick={() => setModalNuevo(false)} className="text-tn-muted hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCrear} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input
                  type="text" className="input-field"
                  placeholder="Ej: CrossFit Q1 2025"
                  value={nombre} onChange={e => setNombre(e.target.value)}
                  autoFocus required
                />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea
                  className="input-field resize-none h-20"
                  placeholder="Objetivo del programa, nivel recomendado..."
                  value={descripcion} onChange={e => setDescripcion(e.target.value)}
                />
              </div>
              <div className="bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-4">
                <p className="text-tn-yellow/80 text-xs">
                  Se crearán <strong>4 semanas</strong> con 7 días cada una. Podrás añadir más semanas después.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={() => setModalNuevo(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Crear programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {borrando && (
        <ConfirmDialog
          title="Eliminar programa"
          description={`¿Eliminar "${borrando.nombre}"? Se perderán todas las semanas y bloques del programa.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrarPrograma(borrando.id); setBorrando(null) }}
          onCancel={() => setBorrando(null)}
        />
      )}
    </div>
  )
}
