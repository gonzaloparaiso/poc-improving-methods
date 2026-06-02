import { useState } from 'react'
import { type Programa, type Bloque, DIAS_SEMANA } from '../../types'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { EJERCICIOS } from '../../data/ejercicios'
import BloqueModal from '../../components/planificacion/BloqueModal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Props {
  programa: Programa
  onVolver: () => void
}

type ModalState =
  | { tipo: 'nuevo'; semanaId: string; diaIdx: number }
  | { tipo: 'editar'; semanaId: string; diaIdx: number; bloque: Bloque }
  | { tipo: 'plantilla'; semanaId: string; diaIdx: number }
  | null

export default function ProgramaDetalle({ programa, onVolver }: Props) {
  const {
    añadirBloqueAlDia, editarBloqueDelDia, borrarBloqueDelDia,
    añadirSemana, borrarSemana, plantillas,
  } = usePlanificacion()

  const [semanaIdx, setSemanaIdx]       = useState(0)
  const [modal, setModal]               = useState<ModalState>(null)
  const [borrarBloque, setBorrarBloque] = useState<{ semanaId: string; diaIdx: number; bloque: Bloque } | null>(null)
  const [borrarSemanaConf, setBorrarSemanaConf] = useState<string | null>(null)
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false)

  const semana = programa.semanas[semanaIdx]

  const cerrarModal = () => { setModal(null); setMostrarPlantillas(false) }

  const handleGuardarBloque = (data: Omit<Bloque, 'id' | 'creadoEn'>) => {
    if (!modal) return
    if (modal.tipo === 'editar') {
      editarBloqueDelDia(programa.id, modal.semanaId, modal.diaIdx, modal.bloque.id, data)
    } else {
      añadirBloqueAlDia(programa.id, modal.semanaId, modal.diaIdx, data)
    }
    cerrarModal()
  }

  const usarPlantilla = (plantilla: Bloque, semanaId: string, diaIdx: number) => {
    añadirBloqueAlDia(programa.id, semanaId, diaIdx, { ...plantilla, esPlantilla: false })
    cerrarModal()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={onVolver} className="p-2 text-tn-muted hover:text-white hover:bg-tn-card rounded-lg transition-all mt-0.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-white truncate">{programa.nombre}</h2>
          {programa.descripcion && (
            <p className="text-tn-muted text-sm mt-0.5">{programa.descripcion}</p>
          )}
        </div>
      </div>

      {/* Semanas tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {programa.semanas.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSemanaIdx(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              semanaIdx === i
                ? 'bg-tn-yellow text-tn-black'
                : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
            }`}
          >
            Semana {s.numero}
          </button>
        ))}
        <button
          onClick={() => añadirSemana(programa.id)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-tn-muted hover:text-tn-yellow hover:bg-tn-yellow/5 border border-dashed border-tn-border hover:border-tn-yellow/40 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Semana
        </button>
        {programa.semanas.length > 1 && (
          <button
            onClick={() => setBorrarSemanaConf(semana.id)}
            className="flex-shrink-0 px-3 py-2 rounded-lg text-xs text-tn-muted hover:text-red-400 hover:bg-red-400/5 border border-dashed border-tn-border hover:border-red-400/30 transition-all"
            title="Eliminar semana actual"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Grid de días */}
      {semana && (
        <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
          <div className="grid grid-cols-7 gap-2 min-w-[700px]">
            {DIAS_SEMANA.map((dia, diaIdx) => {
              const diaData = semana.dias[diaIdx]
              return (
                <div key={dia} className="flex flex-col gap-2">
                  {/* Cabecera día */}
                  <div className="text-center">
                    <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">{dia.slice(0, 3)}</p>
                    <p className="text-tn-muted/50 text-xs hidden lg:block">{dia}</p>
                  </div>

                  {/* Bloques del día */}
                  <div className="flex-1 space-y-2">
                    {diaData?.bloques.map(bloque => (
                      <div key={bloque.id} className="card p-3 group">
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <p className="text-white font-semibold text-xs leading-tight line-clamp-2">{bloque.nombre}</p>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => setModal({ tipo: 'editar', semanaId: semana.id, diaIdx, bloque })}
                              className="p-1 text-tn-muted hover:text-white rounded transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setBorrarBloque({ semanaId: semana.id, diaIdx, bloque })}
                              className="p-1 text-tn-muted hover:text-red-400 rounded transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {bloque.cronometro && (
                          <p className="text-tn-yellow text-xs font-mono mb-1">⏱ {bloque.cronometro}</p>
                        )}

                        {bloque.ejercicios.length > 0 && (
                          <div className="space-y-0.5">
                            {bloque.ejercicios.slice(0, 3).map(ej => {
                              const ejercicio = EJERCICIOS.find(e => e.id === ej.ejercicioId)
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
                      </div>
                    ))}

                    {/* Botón añadir bloque */}
                    <button
                      onClick={() => setModal({ tipo: 'nuevo', semanaId: semana.id, diaIdx })}
                      className="w-full border border-dashed border-tn-border rounded-xl py-3 text-tn-muted/60 hover:text-tn-yellow hover:border-tn-yellow/40 text-xs transition-all flex flex-col items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="hidden lg:block">Añadir</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal añadir bloque — elige entre nuevo o plantilla */}
      {modal && modal.tipo === 'nuevo' && !mostrarPlantillas && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-3 shadow-2xl">
            <h3 className="text-white font-bold text-lg">Añadir bloque</h3>
            <p className="text-tn-muted text-sm">{DIAS_SEMANA[modal.diaIdx]} · Semana {semana?.numero}</p>
            <div className="space-y-2 pt-2">
              {plantillas.length > 0 && (
                <button
                  className="w-full card px-4 py-3 text-left hover:border-tn-yellow transition-colors group"
                  onClick={() => setMostrarPlantillas(true)}
                >
                  <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">
                    Usar plantilla
                  </p>
                  <p className="text-tn-muted text-xs mt-0.5">{plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''} disponible{plantillas.length !== 1 ? 's' : ''}</p>
                </button>
              )}
              <button
                className="w-full card px-4 py-3 text-left hover:border-tn-yellow transition-colors group"
                onClick={() => setModal({ ...modal, tipo: 'nuevo' })}
              >
                <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">Crear nuevo bloque</p>
                <p className="text-tn-muted text-xs mt-0.5">Diseñarlo desde cero y opcionalmente guardarlo como plantilla</p>
              </button>
            </div>
            <button onClick={cerrarModal} className="w-full text-tn-muted text-sm hover:text-white transition-colors pt-1">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Selector de plantillas */}
      {modal && mostrarPlantillas && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-tn-border flex-shrink-0">
              <div>
                <h3 className="text-white font-bold">Seleccionar plantilla</h3>
                <p className="text-tn-muted text-xs mt-0.5">{DIAS_SEMANA[modal.diaIdx]} · Semana {semana?.numero}</p>
              </div>
              <button onClick={cerrarModal} className="text-tn-muted hover:text-white p-1 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {plantillas.map(p => (
                <button
                  key={p.id}
                  onClick={() => usarPlantilla(p, modal.semanaId, modal.diaIdx)}
                  className="w-full card px-4 py-3 text-left hover:border-tn-yellow transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">{p.nombre}</p>
                    {p.cronometro && <span className="text-tn-yellow text-xs font-mono">⏱ {p.cronometro}</span>}
                  </div>
                  <p className="text-tn-muted text-xs mt-0.5">{p.ejercicios.length} ejercicio{p.ejercicios.length !== 1 ? 's' : ''}</p>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-tn-border flex-shrink-0">
              <button onClick={() => setMostrarPlantillas(false)} className="btn-secondary w-full">Volver</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar bloque */}
      {modal && (modal.tipo === 'editar' || (modal.tipo === 'nuevo' && !mostrarPlantillas)) && (
        !mostrarPlantillas && modal.tipo !== 'nuevo' || modal.tipo === 'editar' ? (
          <BloqueModal
            bloque={modal.tipo === 'editar' ? modal.bloque : null}
            onGuardar={handleGuardarBloque}
            onCancelar={cerrarModal}
          />
        ) : null
      )}

      {/* Confirm borrar bloque */}
      {borrarBloque && (
        <ConfirmDialog
          title="Eliminar bloque"
          description={`¿Eliminar "${borrarBloque.bloque.nombre}" de este día?`}
          confirmLabel="Eliminar"
          onConfirm={() => {
            borrarBloqueDelDia(programa.id, borrarBloque.semanaId, borrarBloque.diaIdx, borrarBloque.bloque.id)
            setBorrarBloque(null)
          }}
          onCancel={() => setBorrarBloque(null)}
        />
      )}

      {/* Confirm borrar semana */}
      {borrarSemanaConf && (
        <ConfirmDialog
          title="Eliminar semana"
          description={`¿Eliminar la Semana ${semana?.numero}? Se perderán todos los bloques de esa semana.`}
          confirmLabel="Eliminar semana"
          onConfirm={() => {
            borrarSemana(programa.id, borrarSemanaConf)
            setSemanaIdx(s => Math.max(0, s - 1))
            setBorrarSemanaConf(null)
          }}
          onCancel={() => setBorrarSemanaConf(null)}
        />
      )}
    </div>
  )
}
