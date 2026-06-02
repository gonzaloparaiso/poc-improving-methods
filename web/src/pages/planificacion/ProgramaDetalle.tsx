import { useState } from 'react'
import { type Programa, type Bloque, DIAS_SEMANA, type Semana } from '../../types'
import { usePlanificacion } from '../../context/PlanificacionContext'
import { EJERCICIOS } from '../../data/ejercicios'
import BloqueModal from '../../components/planificacion/BloqueModal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Props {
  programa: Programa
  onVolver: () => void
}

// ── Tipos de estado del modal ─────────────────────────────────────────────────
type ModalTarget = { semanaId: string; diaIdx: number }
type ModalFase =
  | { fase: 'elegir' }        // dialog: ¿plantilla o nuevo?
  | { fase: 'plantillas' }    // lista de plantillas
  | { fase: 'form'; bloque: Bloque | null }  // formulario (nuevo o editar)

type ModalState = (ModalTarget & ModalFase) | null

// ── Sub-componente: grid semanal ──────────────────────────────────────────────
function GridSemana({
  semana,
  onAñadir,
  onEditar,
  onBorrar,
}: {
  semana: Semana
  onAñadir: (semanaId: string, diaIdx: number) => void
  onEditar: (semanaId: string, diaIdx: number, bloque: Bloque) => void
  onBorrar: (semanaId: string, diaIdx: number, bloque: Bloque) => void
}) {
  return (
    <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {DIAS_SEMANA.map((dia, diaIdx) => {
          const diaData = semana.dias[diaIdx]
          return (
            <div key={dia} className="flex flex-col gap-2">
              {/* Cabecera día */}
              <div className="text-center">
                <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">{dia.slice(0, 3)}</p>
              </div>

              {/* Bloques */}
              <div className="flex-1 space-y-2">
                {diaData?.bloques.map(bloque => (
                  <div key={bloque.id} className="card p-3 group">
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <p className="text-white font-semibold text-xs leading-tight line-clamp-2">{bloque.nombre}</p>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => onEditar(semana.id, diaIdx, bloque)}
                          className="p-1 text-tn-muted hover:text-white rounded transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onBorrar(semana.id, diaIdx, bloque)}
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
                              {ej.series && ej.reps && (
                                <span className="text-tn-muted/60"> {ej.series}×{ej.reps}</span>
                              )}
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

                {/* Botón añadir */}
                <button
                  onClick={() => onAñadir(semana.id, diaIdx)}
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
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ProgramaDetalle({ programa, onVolver }: Props) {
  const { añadirBloqueAlDia, editarBloqueDelDia, borrarBloqueDelDia, añadirSemana, borrarSemana, plantillas } = usePlanificacion()

  const [vista, setVista] = useState<number | 'todas'>(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [borrarBloque, setBorrarBloque] = useState<{ semanaId: string; diaIdx: number; bloque: Bloque } | null>(null)
  const [borrarSemanaConf, setBorrarSemanaConf] = useState<string | null>(null)

  const semanaActual = typeof vista === 'number' ? programa.semanas[vista] : null

  const cerrarModal = () => setModal(null)

  const abrirAñadir = (semanaId: string, diaIdx: number) =>
    setModal({ semanaId, diaIdx, fase: 'elegir' })

  const abrirEditar = (semanaId: string, diaIdx: number, bloque: Bloque) =>
    setModal({ semanaId, diaIdx, fase: 'form', bloque })

  const handleGuardar = (data: Omit<Bloque, 'id' | 'creadoEn'>) => {
    if (!modal) return
    if (modal.fase === 'form' && modal.bloque) {
      editarBloqueDelDia(programa.id, modal.semanaId, modal.diaIdx, modal.bloque.id, data)
    } else {
      añadirBloqueAlDia(programa.id, modal.semanaId, modal.diaIdx, data)
    }
    cerrarModal()
  }

  const usarPlantilla = (plantilla: Bloque) => {
    if (!modal) return
    añadirBloqueAlDia(programa.id, modal.semanaId, modal.diaIdx, { ...plantilla, esPlantilla: false })
    cerrarModal()
  }

  const semanaDelModal = modal ? programa.semanas.find(s => s.id === modal.semanaId) : null

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <button onClick={onVolver} className="p-2 text-tn-muted hover:text-white hover:bg-tn-card rounded-lg transition-all mt-0.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-white truncate">{programa.nombre}</h2>
          {programa.descripcion && <p className="text-tn-muted text-sm mt-0.5">{programa.descripcion}</p>}
        </div>
      </div>

      {/* ── Tabs de semanas ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
        {/* Todas */}
        <button
          onClick={() => setVista('todas')}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            vista === 'todas'
              ? 'bg-tn-yellow text-tn-black'
              : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
          }`}
        >
          Todas
        </button>

        {/* Semanas individuales */}
        {programa.semanas.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setVista(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              vista === i
                ? 'bg-tn-yellow text-tn-black'
                : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
            }`}
          >
            Semana {s.numero}
          </button>
        ))}

        {/* Añadir semana */}
        <button
          onClick={() => añadirSemana(programa.id)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-tn-muted hover:text-tn-yellow hover:bg-tn-yellow/5 border border-dashed border-tn-border hover:border-tn-yellow/40 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Semana
        </button>

        {/* Borrar semana actual (solo en vista individual) */}
        {typeof vista === 'number' && programa.semanas.length > 1 && semanaActual && (
          <button
            onClick={() => setBorrarSemanaConf(semanaActual.id)}
            className="flex-shrink-0 px-3 py-2 rounded-lg text-xs text-tn-muted hover:text-red-400 hover:bg-red-400/5 border border-dashed border-tn-border hover:border-red-400/30 transition-all"
            title="Eliminar semana actual"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Vista: semana individual ─────────────────────────────────────── */}
      {semanaActual && (
        <GridSemana
          semana={semanaActual}
          onAñadir={abrirAñadir}
          onEditar={abrirEditar}
          onBorrar={(sid, di, b) => setBorrarBloque({ semanaId: sid, diaIdx: di, bloque: b })}
        />
      )}

      {/* ── Vista: todas las semanas ─────────────────────────────────────── */}
      {vista === 'todas' && (
        <div className="space-y-8">
          {programa.semanas.map(semana => (
            <div key={semana.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-bold">Semana {semana.numero}</h3>
                <div className="flex-1 h-px bg-tn-border" />
                <span className="text-tn-muted text-xs">
                  {semana.dias.reduce((acc, d) => acc + d.bloques.length, 0)} bloques
                </span>
              </div>
              <GridSemana
                semana={semana}
                onAñadir={abrirAñadir}
                onEditar={abrirEditar}
                onBorrar={(sid, di, b) => setBorrarBloque({ semanaId: sid, diaIdx: di, bloque: b })}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: elegir cómo añadir ────────────────────────────────────── */}
      {modal?.fase === 'elegir' && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-3 shadow-2xl">
            <h3 className="text-white font-bold text-lg">Añadir bloque</h3>
            <p className="text-tn-muted text-sm">
              {DIAS_SEMANA[modal.diaIdx]} · Semana {semanaDelModal?.numero}
            </p>

            <div className="space-y-2 pt-2">
              {plantillas.length > 0 && (
                <button
                  className="w-full card px-4 py-3 text-left hover:border-tn-yellow transition-colors group"
                  onClick={() => setModal({ ...modal, fase: 'plantillas' })}
                >
                  <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">
                    Usar plantilla
                  </p>
                  <p className="text-tn-muted text-xs mt-0.5">
                    {plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''} disponible{plantillas.length !== 1 ? 's' : ''}
                  </p>
                </button>
              )}

              <button
                className="w-full card px-4 py-3 text-left hover:border-tn-yellow transition-colors group"
                onClick={() => setModal({ ...modal, fase: 'form', bloque: null })}
              >
                <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">
                  Crear nuevo bloque
                </p>
                <p className="text-tn-muted text-xs mt-0.5">
                  Diseñarlo desde cero y opcionalmente guardarlo como plantilla
                </p>
              </button>
            </div>

            <button onClick={cerrarModal} className="w-full text-tn-muted text-sm hover:text-white transition-colors pt-1">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: seleccionar plantilla ─────────────────────────────────── */}
      {modal?.fase === 'plantillas' && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-tn-border flex-shrink-0">
              <div>
                <h3 className="text-white font-bold">Seleccionar plantilla</h3>
                <p className="text-tn-muted text-xs mt-0.5">
                  {DIAS_SEMANA[modal.diaIdx]} · Semana {semanaDelModal?.numero}
                </p>
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
                  onClick={() => usarPlantilla(p)}
                  className="w-full card px-4 py-3 text-left hover:border-tn-yellow transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">{p.nombre}</p>
                    {p.cronometro && <span className="text-tn-yellow text-xs font-mono">⏱ {p.cronometro}</span>}
                  </div>
                  <p className="text-tn-muted text-xs mt-0.5">
                    {p.ejercicios.length} ejercicio{p.ejercicios.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-tn-border flex-shrink-0">
              <button
                onClick={() => setModal({ ...modal, fase: 'elegir' })}
                className="btn-secondary w-full"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: formulario crear / editar bloque ──────────────────────── */}
      {modal?.fase === 'form' && (
        <BloqueModal
          bloque={modal.bloque}
          onGuardar={handleGuardar}
          onCancelar={cerrarModal}
        />
      )}

      {/* ── Confirm: borrar bloque ───────────────────────────────────────── */}
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

      {/* ── Confirm: borrar semana ───────────────────────────────────────── */}
      {borrarSemanaConf && semanaActual && (
        <ConfirmDialog
          title="Eliminar semana"
          description={`¿Eliminar la Semana ${semanaActual.numero}? Se perderán todos sus bloques.`}
          confirmLabel="Eliminar semana"
          onConfirm={() => {
            borrarSemana(programa.id, borrarSemanaConf)
            setVista(v => typeof v === 'number' ? Math.max(0, v - 1) : 'todas')
            setBorrarSemanaConf(null)
          }}
          onCancel={() => setBorrarSemanaConf(null)}
        />
      )}
    </div>
  )
}
