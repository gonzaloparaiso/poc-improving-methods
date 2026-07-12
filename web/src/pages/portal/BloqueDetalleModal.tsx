import { useEffect, useRef, useState } from 'react'
import { type Bloque, CALENDAR_COLORS } from '../../types'
import { useEjercicios } from '../../context/EjerciciosContext'
import { type Ejercicio } from '../../types'
import EjercicioDetalleModal from './EjercicioDetalleModal'
import { textoBloque } from './exporters'
import { copiarAlPortapapeles } from '../../lib/clipboard'

interface Props {
  bloque: Bloque
  programaNombre: string
  colorKey: string
  fecha: string
  onClose: () => void
}

function fmtFechaLarga(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })
}

export default function BloqueDetalleModal({ bloque, programaNombre, colorKey, fecha, onClose }: Props) {
  const { ejercicios } = useEjercicios()
  const colorDef = CALENDAR_COLORS.find(c => c.key === colorKey) ?? CALENDAR_COLORS[0]
  const [ejercicioSel, setEjercicioSel] = useState<{
    ej: Ejercicio
    series?: string; reps?: string; descanso?: string; notas?: string
  } | null>(null)

  const [copiado, setCopiado] = useState<'aimharder' | 'wodbuster' | null>(null)
  const copiadoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copiadoTimeout.current) clearTimeout(copiadoTimeout.current) }, [])

  const copiar = async (destino: 'aimharder' | 'wodbuster') => {
    const ok = await copiarAlPortapapeles(textoBloque(bloque, ejercicios))
    if (!ok) return
    setCopiado(destino)
    if (copiadoTimeout.current) clearTimeout(copiadoTimeout.current)
    copiadoTimeout.current = setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header coloreado */}
        <div
          className="p-6 border-b border-tn-border flex-shrink-0"
          style={{
            backgroundColor: `${colorDef.accent}10`,
            borderLeft: `4px solid ${colorDef.accent}`,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorDef.accent }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colorDef.accent }}>
                  {programaNombre}
                </span>
              </div>
              <h3 className="text-white font-black text-xl">{bloque.nombre}</h3>
              <p className="text-tn-muted text-sm mt-1 capitalize">{fmtFechaLarga(fecha)}</p>
            </div>
            <button onClick={onClose} className="text-tn-muted hover:text-white p-1 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {bloque.cronometro && (
            <div className="mt-4 inline-flex items-center gap-2 bg-tn-black/40 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-tn-yellow font-mono font-bold">{bloque.cronometro}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Descripción: copiar el WOD como texto plano (Aimharder/Wodbuster no permiten importar vía API) */}
          <div className="bg-tn-dark border border-tn-border rounded-xl p-4">
            <h4 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Descripción
            </h4>
            <p className="text-tn-muted text-xs mb-3">
              Copia esta sesión para pegarla como texto en Aimharder o Wodbuster.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => copiar('aimharder')}
                className="flex-1 min-w-[140px] btn-secondary flex items-center justify-center gap-2 text-sm py-2"
              >
                {copiado === 'aimharder' ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar para Aimharder
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => copiar('wodbuster')}
                className="flex-1 min-w-[140px] btn-secondary flex items-center justify-center gap-2 text-sm py-2"
              >
                {copiado === 'wodbuster' ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar para Wodbuster
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instrucciones */}
          {bloque.instrucciones && (
            <div className="bg-tn-dark border border-tn-border rounded-xl p-4">
              <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Instrucciones
              </h4>
              <p className="text-tn-muted text-sm leading-relaxed whitespace-pre-line">
                {bloque.instrucciones}
              </p>
            </div>
          )}

          {/* Notas del bloque */}
          {bloque.notas && (
            <div className="bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-4">
              <h4 className="text-tn-yellow font-bold text-sm mb-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                Notas
              </h4>
              <p className="text-white/90 text-sm leading-relaxed">{bloque.notas}</p>
            </div>
          )}

          {/* Ejercicios */}
          {bloque.ejercicios.length > 0 && (
            <div>
              <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Ejercicios ({bloque.ejercicios.length})
              </h4>
              <div className="space-y-2">
                {bloque.ejercicios.map((ej, idx) => {
                  const ejercicio = ejercicios.find(e => e.id === ej.ejercicioId)
                  if (!ejercicio) return null
                  return (
                    <button
                      key={ej.id}
                      onClick={() => setEjercicioSel({
                        ej: ejercicio, series: ej.series, reps: ej.reps, descanso: ej.descanso, notas: ej.notas,
                      })}
                      className="w-full bg-tn-dark border border-tn-border rounded-xl p-4 text-left hover:border-tn-yellow transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-tn-yellow/10 text-tn-yellow text-sm font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        {ejercicio.thumbnail && (
                          <img src={ejercicio.thumbnail} alt="" loading="lazy"
                            className="w-12 h-12 rounded-lg object-cover bg-tn-card flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-white font-semibold text-sm group-hover:text-tn-yellow transition-colors">
                              {ejercicio.nombre}
                            </p>
                            {ejercicio.video && (
                              <span className="inline-flex items-center gap-1 text-xs text-tn-yellow/70">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                                Vídeo
                              </span>
                            )}
                          </div>
                          {(ej.series || ej.reps || ej.descanso) && (
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {ej.series && ej.reps && (
                                <span className="text-tn-muted text-xs">
                                  <span className="text-white font-semibold">{ej.series}×{ej.reps}</span>
                                </span>
                              )}
                              {ej.descanso && (
                                <span className="text-tn-muted text-xs">descanso {ej.descanso}</span>
                              )}
                            </div>
                          )}
                          {ej.notas && (
                            <p className="text-tn-yellow/70 text-xs mt-1 italic">💡 {ej.notas}</p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-tn-muted group-hover:text-tn-yellow flex-shrink-0 transition-colors"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-tn-muted/60 text-xs mt-3 text-center">
                Toca un ejercicio para ver la explicación y el vídeo
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-tn-border flex-shrink-0">
          <button onClick={onClose} className="btn-primary w-full">Cerrar</button>
        </div>
      </div>

      {ejercicioSel && (
        <EjercicioDetalleModal
          ejercicio={ejercicioSel.ej}
          series={ejercicioSel.series}
          reps={ejercicioSel.reps}
          descanso={ejercicioSel.descanso}
          notas={ejercicioSel.notas}
          onClose={() => setEjercicioSel(null)}
        />
      )}
    </div>
  )
}
