import { useState } from 'react'
import { type CalendarioCliente, type Bloque, type SemanaCalendario, DIAS_SEMANA, CALENDAR_COLORS } from '../../types'
import { useCalendarios, fmtFecha, addDays } from '../../context/CalendariosContext'
import { useEjercicios } from '../../context/EjerciciosContext'
import BloqueModal from '../../components/planificacion/BloqueModal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Props {
  calendario: CalendarioCliente
  onVolver: () => void
}

type ModalFase =
  | { fase: 'form'; bloque: Bloque | null; semanaId: string; diaIdx: number }
  | null

function GridSemana({
  semana,
  onAñadir,
  onEditar,
  onBorrar,
}: {
  semana: SemanaCalendario
  onAñadir: (semanaId: string, diaIdx: number) => void
  onEditar: (semanaId: string, diaIdx: number, bloque: Bloque) => void
  onBorrar: (semanaId: string, diaIdx: number, bloqueId: string, nombre: string) => void
}) {
  const { ejercicios } = useEjercicios()
  return (
    <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {DIAS_SEMANA.map((dia, diaIdx) => {
          const diaData = semana.dias[diaIdx]
          const fecha = diaData?.fecha ?? addDays(semana.fechaLunes, diaIdx)
          const esHoy = fecha === new Date().toISOString().split('T')[0]

          return (
            <div key={dia} className="flex flex-col gap-2">
              {/* Cabecera día con fecha real */}
              <div className={`text-center rounded-lg py-1.5 ${esHoy ? 'bg-tn-yellow/10 border border-tn-yellow/30' : ''}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${esHoy ? 'text-tn-yellow' : 'text-tn-muted'}`}>
                  {dia.slice(0, 3)}
                </p>
                <p className={`text-xs mt-0.5 ${esHoy ? 'text-tn-yellow font-semibold' : 'text-tn-muted/60'}`}>
                  {fmtFecha(fecha)}
                </p>
              </div>

              {/* Bloques */}
              <div className="flex-1 space-y-2">
                {diaData?.bloques.map(bloque => (
                  <div key={bloque.id} className="card p-3 group">
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <p className="text-white font-semibold text-xs leading-tight line-clamp-2">{bloque.nombre}</p>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => onEditar(semana.id, diaIdx, bloque)}
                          className="p-1 text-tn-muted hover:text-white rounded transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => onBorrar(semana.id, diaIdx, bloque.id, bloque.nombre)}
                          className="p-1 text-tn-muted hover:text-red-400 rounded transition-colors">
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
                  </div>
                ))}

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

export default function CalendarioClienteView({ calendario, onVolver }: Props) {
  const { añadirBloque, editarBloque, borrarBloque, calendarios } = useCalendarios()

  // Siempre usar la versión actualizada del calendario
  const cal = calendarios.find(c => c.id === calendario.id) ?? calendario

  const [vista, setVista]           = useState<number | 'todas'>(0)
  const [modal, setModal]           = useState<ModalFase>(null)
  const [borrarConf, setBorrarConf] = useState<{
    semanaId: string; diaIdx: number; bloqueId: string; nombre: string
  } | null>(null)

  const semanaActual = typeof vista === 'number' ? cal.semanas[vista] : null

  const cerrarModal = () => setModal(null)

  const handleGuardar = (data: Omit<Bloque, 'id' | 'creadoEn'>) => {
    if (!modal) return
    if (modal.bloque) {
      editarBloque(cal.id, modal.semanaId, modal.diaIdx, modal.bloque.id, data)
    } else {
      añadirBloque(cal.id, modal.semanaId, modal.diaIdx, data)
    }
    cerrarModal()
  }

  // Rango de fechas del calendario
  const ultimaSemana = cal.semanas[cal.semanas.length - 1]
  const fechaFin = ultimaSemana ? addDays(ultimaSemana.fechaLunes, 6) : cal.fechaInicio

  const colorDef = CALENDAR_COLORS.find(c => c.key === cal.colorKey) ?? CALENDAR_COLORS[0]

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={`flex items-start gap-4 p-4 rounded-xl border ${colorDef.cls}`}>
        <button onClick={onVolver}
          className="p-2 text-tn-muted hover:text-white hover:bg-tn-card rounded-lg transition-all mt-0.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-black text-white truncate">{cal.programaNombre}</h2>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorDef.badge}`}>
              {colorDef.key}
            </span>
          </div>
          <p className="text-tn-muted text-sm mt-0.5">
            {fmtFecha(cal.fechaInicio)} → {fmtFecha(fechaFin)}
            <span className="mx-2">·</span>
            {cal.semanas.length} semana{cal.semanas.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Adjuntos del calendario ─────────────────────────────────────── */}
      {cal.adjuntos && cal.adjuntos.length > 0 && (
        <div className="space-y-2">
          <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">Documentos</p>
          <div className="flex flex-wrap gap-2">
            {cal.adjuntos.map(a => (
              <button key={a.id}
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = a.dataUrl; link.download = a.nombre
                  document.body.appendChild(link); link.click(); document.body.removeChild(link)
                }}
                className="flex items-center gap-2 bg-tn-card border border-tn-border rounded-xl px-3 py-2 hover:border-tn-yellow transition-all group">
                <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
                  </svg>
                </div>
                <span className="text-white text-sm font-semibold truncate max-w-[200px] group-hover:text-tn-yellow transition-colors">
                  {a.nombre}
                </span>
                <svg className="w-3.5 h-3.5 text-tn-muted group-hover:text-tn-yellow flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs semanas ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
        <button
          onClick={() => setVista('todas')}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            vista === 'todas' ? 'bg-tn-yellow text-tn-black' : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
          }`}
        >
          Todas
        </button>
        {cal.semanas.map((s, i) => (
          <button key={s.id} onClick={() => setVista(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              vista === i ? 'bg-tn-yellow text-tn-black' : 'text-tn-muted hover:text-white hover:bg-tn-card border border-tn-border'
            }`}
          >
            <span>Sem {s.numero}</span>
            <span className="hidden sm:inline text-xs ml-1.5 opacity-70">{fmtFecha(s.fechaLunes)}</span>
          </button>
        ))}
      </div>

      {/* ── Vista semana individual ─────────────────────────────────────── */}
      {semanaActual && (
        <GridSemana
          semana={semanaActual}
          onAñadir={(sid, di) => setModal({ fase: 'form', bloque: null, semanaId: sid, diaIdx: di })}
          onEditar={(sid, di, b) => setModal({ fase: 'form', bloque: b, semanaId: sid, diaIdx: di })}
          onBorrar={(sid, di, bid, nombre) => setBorrarConf({ semanaId: sid, diaIdx: di, bloqueId: bid, nombre })}
        />
      )}

      {/* ── Vista todas las semanas ─────────────────────────────────────── */}
      {vista === 'todas' && (
        <div className="space-y-8">
          {cal.semanas.map(semana => (
            <div key={semana.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-bold whitespace-nowrap">
                  Semana {semana.numero}
                </h3>
                <span className="text-tn-muted text-xs">{fmtFecha(semana.fechaLunes)} → {fmtFecha(addDays(semana.fechaLunes, 6))}</span>
                <div className="flex-1 h-px bg-tn-border" />
                <span className="text-tn-muted text-xs whitespace-nowrap">
                  {semana.dias.reduce((acc, d) => acc + d.bloques.length, 0)} bloques
                </span>
              </div>
              <GridSemana
                semana={semana}
                onAñadir={(sid, di) => setModal({ fase: 'form', bloque: null, semanaId: sid, diaIdx: di })}
                onEditar={(sid, di, b) => setModal({ fase: 'form', bloque: b, semanaId: sid, diaIdx: di })}
                onBorrar={(sid, di, bid, nombre) => setBorrarConf({ semanaId: sid, diaIdx: di, bloqueId: bid, nombre })}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── BloqueModal ──────────────────────────────────────────────────── */}
      {modal?.fase === 'form' && (
        <BloqueModal
          bloque={modal.bloque}
          mostrarGuardarComoPlantilla={false}
          onGuardar={handleGuardar}
          onCancelar={cerrarModal}
        />
      )}

      {/* ── Confirm borrar bloque ────────────────────────────────────────── */}
      {borrarConf && (
        <ConfirmDialog
          title="Eliminar bloque"
          description={`¿Eliminar "${borrarConf.nombre}" de este día del calendario?`}
          confirmLabel="Eliminar"
          onConfirm={() => {
            borrarBloque(cal.id, borrarConf.semanaId, borrarConf.diaIdx, borrarConf.bloqueId)
            setBorrarConf(null)
          }}
          onCancel={() => setBorrarConf(null)}
        />
      )}
    </div>
  )
}
