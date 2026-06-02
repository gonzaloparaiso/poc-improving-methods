import { useState } from 'react'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { EJERCICIOS } from '../../data/ejercicios'
import { type Bloque } from '../../types'
import BloqueModal from '../../components/planificacion/BloqueModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { usePermisos } from '../../hooks/usePermisos'

function BloqueCard({ bloque, onEditar, onBorrar, puedeEditar, puedeBorrar }: {
  bloque: Bloque
  onEditar: () => void
  onBorrar: () => void
  puedeEditar: boolean
  puedeBorrar: boolean
}) {
  const [expandido, setExpandido] = useState(false)

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-white font-bold">{bloque.nombre}</h4>
            {bloque.cronometro && (
              <span className="flex items-center gap-1 text-tn-yellow text-xs font-mono bg-tn-yellow/10 px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {bloque.cronometro}
              </span>
            )}
          </div>
          <p className="text-tn-muted text-sm mt-1">
            {bloque.ejercicios.length} ejercicio{bloque.ejercicios.length !== 1 ? 's' : ''}
            {bloque.instrucciones && ` · ${bloque.instrucciones.slice(0, 60)}${bloque.instrucciones.length > 60 ? '…' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpandido(e => !e)}
            className="p-2 text-tn-muted hover:text-white rounded-lg hover:bg-tn-border transition-all"
            title={expandido ? 'Colapsar' : 'Ver ejercicios'}
          >
            <svg className={`w-4 h-4 transition-transform ${expandido ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {puedeEditar && (
            <button onClick={onEditar} className="p-2 text-tn-muted hover:text-white rounded-lg hover:bg-tn-border transition-all" title="Editar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {puedeBorrar && (
            <button onClick={onBorrar} className="p-2 text-tn-muted hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-all" title="Eliminar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expandido && bloque.ejercicios.length > 0 && (
        <div className="border-t border-tn-border px-5 py-3 space-y-2 bg-tn-dark/30">
          {bloque.ejercicios.map((ej, i) => {
            const ejercicio = EJERCICIOS.find(e => e.id === ej.ejercicioId)
            return (
              <div key={ej.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-tn-yellow/10 text-tn-yellow text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-white font-medium flex-1">{ejercicio?.nombre ?? '—'}</span>
                <span className="text-tn-muted text-xs">
                  {ej.series && `${ej.series}×`}{ej.reps}
                  {ej.descanso && ` · ${ej.descanso}`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function BloquesList() {
  const { plantillas, crearPlantilla, editarPlantilla, borrarPlantilla } = usePlanificacion()
  const { puede } = usePermisos()
  const [modalOpen, setModalOpen]   = useState(false)
  const [editando, setEditando]     = useState<Bloque | null>(null)
  const [borrando, setBorrando]     = useState<Bloque | null>(null)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Plantillas de bloques</h2>
          <p className="text-tn-muted text-sm mt-1">
            {plantillas.length === 0
              ? 'Crea bloques reutilizables para tus programas'
              : `${plantillas.length} plantilla${plantillas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {puede('planificaciones', 'crear') && (
          <button className="btn-primary flex items-center gap-2 self-start sm:self-auto"
            onClick={() => { setEditando(null); setModalOpen(true) }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nueva plantilla
          </button>
        )}
      </div>

      {plantillas.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-tn-border rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Sin plantillas</h3>
          <p className="text-tn-muted text-sm mb-6 max-w-sm">
            Crea bloques de entrenamiento reutilizables para añadirlos rápidamente a cualquier programa.
          </p>
          <button className="btn-primary flex items-center gap-2"
            onClick={() => { setEditando(null); setModalOpen(true) }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Crear primera plantilla
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plantillas.map(p => (
            <BloqueCard
              key={p.id}
              bloque={p}
              onEditar={() => { setEditando(p); setModalOpen(true) }}
              onBorrar={() => setBorrando(p)}
              puedeEditar={puede('planificaciones', 'editar')}
              puedeBorrar={puede('planificaciones', 'borrar')}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <BloqueModal
          bloque={editando}
          modoPlantilla
          mostrarGuardarComoPlantilla={false}
          onGuardar={data => {
            if (editando) editarPlantilla(editando.id, data)
            else crearPlantilla(data)
            setModalOpen(false); setEditando(null)
          }}
          onCancelar={() => { setModalOpen(false); setEditando(null) }}
        />
      )}

      {borrando && (
        <ConfirmDialog
          title="Eliminar plantilla"
          description={`¿Eliminar la plantilla "${borrando.nombre}"? Los bloques ya añadidos a programas no se verán afectados.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrarPlantilla(borrando.id); setBorrando(null) }}
          onCancel={() => setBorrando(null)}
        />
      )}
    </div>
  )
}
