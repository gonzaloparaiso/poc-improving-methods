import { type Ejercicio } from '../../data/ejercicios'

interface Props {
  ejercicio: Ejercicio
  series?: string
  reps?: string
  descanso?: string
  notas?: string
  onClose: () => void
}

// Convierte URLs de YouTube/Vimeo a embed
function toEmbed(url: string): string | null {
  if (!url) return null
  // YouTube
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([^&?\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}

export default function EjercicioDetalleModal({ ejercicio, series, reps, descanso, notas, onClose }: Props) {
  const embedUrl = toEmbed(ejercicio.video)

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="card w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl rounded-b-none sm:rounded-b-xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-tn-border flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-xl truncate">{ejercicio.nombre}</h3>
            <p className="text-tn-muted text-xs mt-0.5">Ejercicio</p>
          </div>
          <button onClick={onClose} className="text-tn-muted hover:text-white p-1 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Vídeo */}
          {embedUrl ? (
            <div className="relative bg-tn-black" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title={ejercicio.nombre}
              />
            </div>
          ) : (
            <div className="bg-tn-dark border-b border-tn-border py-12 flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-tn-border rounded-xl flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-tn-muted text-sm">Vídeo no disponible</p>
            </div>
          )}

          {/* Contenido */}
          <div className="p-6 space-y-5">

            {/* Prescripción si la hay */}
            {(series || reps || descanso) && (
              <div className="grid grid-cols-3 gap-3">
                {series && (
                  <div className="bg-tn-dark border border-tn-border rounded-xl p-3 text-center">
                    <p className="text-tn-muted text-xs mb-1">Series</p>
                    <p className="text-tn-yellow font-bold text-lg">{series}</p>
                  </div>
                )}
                {reps && (
                  <div className="bg-tn-dark border border-tn-border rounded-xl p-3 text-center">
                    <p className="text-tn-muted text-xs mb-1">Reps</p>
                    <p className="text-tn-yellow font-bold text-lg">{reps}</p>
                  </div>
                )}
                {descanso && (
                  <div className="bg-tn-dark border border-tn-border rounded-xl p-3 text-center">
                    <p className="text-tn-muted text-xs mb-1">Descanso</p>
                    <p className="text-tn-yellow font-bold text-lg">{descanso}</p>
                  </div>
                )}
              </div>
            )}

            {/* Explicación */}
            {ejercicio.explicacion && (
              <div>
                <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-tn-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cómo se hace
                </h4>
                <p className="text-tn-muted text-sm leading-relaxed whitespace-pre-line">
                  {ejercicio.explicacion}
                </p>
              </div>
            )}

            {/* Notas del entrenador */}
            {notas && (
              <div className="bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-4">
                <h4 className="text-tn-yellow font-bold text-sm mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Notas de tu entrenador
                </h4>
                <p className="text-white/90 text-sm leading-relaxed">{notas}</p>
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
