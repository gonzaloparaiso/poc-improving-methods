import { type ContenidoItem } from '../../types'

interface Props {
  item: ContenidoItem
  onEditar: () => void
  onBorrar: () => void
  puedeEditar: boolean
  puedeBorrar: boolean
}

export default function ContenidoCard({ item, onEditar, onBorrar, puedeEditar, puedeBorrar }: Props) {
  return (
    <div className="card overflow-hidden group flex flex-col">
      <div className="aspect-video bg-tn-dark relative flex-shrink-0">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-tn-yellow/10 to-tn-dark">
            <svg className="w-10 h-10 text-tn-yellow/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {item.mediaTipo && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm">
            {item.mediaTipo === 'audio' ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {item.mediaTipo === 'audio' ? 'Audio' : 'Vídeo'}
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h4 className="text-white font-bold truncate">{item.titulo}</h4>
        {item.descripcion && (
          <p className="text-tn-muted text-sm mt-1 line-clamp-2">{item.descripcion}</p>
        )}
        {item.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.etiquetas.map(tag => (
              <span key={tag} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-tn-yellow/10 text-tn-yellow">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 mt-auto pt-3 justify-end">
          {puedeEditar && (
            <button onClick={onEditar} title="Editar"
              className="p-2 text-tn-muted hover:text-white rounded-lg hover:bg-tn-border transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {puedeBorrar && (
            <button onClick={onBorrar} title="Eliminar"
              className="p-2 text-tn-muted hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
