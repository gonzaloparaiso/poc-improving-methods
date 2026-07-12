import { type ContenidoItem } from '../../types'
import VideoPlayer from '../../components/VideoPlayer'

interface Props {
  item: ContenidoItem
  onClose: () => void
}

export default function ContenidoDetalleModal({ item, onClose }: Props) {
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
          </div>
        </div>

        <div className="p-4 border-t border-tn-border flex-shrink-0">
          <button onClick={onClose} className="btn-primary w-full">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
