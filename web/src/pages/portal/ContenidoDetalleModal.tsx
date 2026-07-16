import { useState } from 'react'
import { type ContenidoItem } from '../../types'
import { DIAS_CORTOS } from '../../lib/contenidoPeriodico'
import VideoPlayer from '../../components/VideoPlayer'

interface Props {
  item: ContenidoItem
  onClose: () => void
  /** Si se pasa, el cliente puede programar este contenido en su calendario.
   *  Devuelve un mensaje de error, o null si se añadió correctamente. */
  onProgramar?: (hora: string, dias: number[]) => string | null
}

export default function ContenidoDetalleModal({ item, onClose, onProgramar }: Props) {
  const [hora, setHora] = useState('08:00')
  const [dias, setDias] = useState<number[]>([])
  const [error, setError] = useState('')
  const [añadida, setAñadida] = useState(false)

  const toggleDia = (d: number) => {
    setAñadida(false); setError('')
    setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const programar = () => {
    if (!onProgramar) return
    const err = onProgramar(hora, dias)
    if (err) { setError(err); setAñadida(false) }
    else { setError(''); setAñadida(true); setDias([]) }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-tn-border flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-xl truncate">{item.titulo}</h3>
          </div>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {item.mediaUrl ? (
            <div className="bg-black p-3 sm:p-4">
              {item.mediaTipo === 'audio' ? (
                <audio src={item.mediaUrl} controls className="w-full" />
              ) : (
                <VideoPlayer url={item.mediaUrl} poster={item.thumbnail} title={item.titulo} />
              )}
            </div>
          ) : item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="w-full max-h-72 object-cover" />
          ) : null}

          <div className="p-6 space-y-5">
            {item.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.etiquetas.map(tag => (
                  <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-tn-yellow/10 text-tn-yellow">{tag}</span>
                ))}
              </div>
            )}
            {item.descripcion && (
              <p className="text-tn-muted text-sm leading-relaxed whitespace-pre-line">{item.descripcion}</p>
            )}

            {/* Programar en mi calendario (solo portal del cliente) */}
            {onProgramar && (
              <div className="bg-sky-400/5 border border-sky-400/20 rounded-xl p-4 space-y-3">
                <p className="text-sky-300 font-bold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Programar en mi calendario
                </p>
                <p className="text-tn-muted text-xs">
                  Elige los días de la semana y la hora: aparecerá cada semana en tu calendario, solo para ti.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {DIAS_CORTOS.map((label, d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDia(d)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold border transition-all ${
                        dias.includes(d)
                          ? 'bg-sky-400 text-tn-black border-sky-400'
                          : 'bg-tn-dark text-tn-muted border-tn-border hover:border-sky-400/50 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <input
                    type="time"
                    value={hora}
                    onChange={e => { setHora(e.target.value); setAñadida(false); setError('') }}
                    className="input-field w-auto py-1.5 px-3 font-mono text-sm"
                  />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                {añadida && <p className="text-green-400 text-xs">Añadida a tu calendario ✓</p>}
                <button
                  type="button"
                  onClick={programar}
                  className="w-full py-2 rounded-xl text-sm font-bold bg-sky-400 text-tn-black hover:bg-sky-300 transition-colors"
                >
                  Añadir a mi calendario
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-tn-border flex-shrink-0">
          <button onClick={onClose} className="btn-primary w-full">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
