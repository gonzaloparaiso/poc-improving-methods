import { type ContenidoItem } from '../../types'

interface Props {
  item: ContenidoItem
  onAbrir: () => void
  favorito: boolean
  onToggleFavorito: () => void
}

export default function ContenidoCard({ item, onAbrir, favorito, onToggleFavorito }: Props) {
  return (
    // No es <button> a propósito: contiene el botón de favorito, y HTML no permite <button> anidados.
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir() } }}
      className="card overflow-hidden text-left group hover:border-tn-yellow/50 transition-all flex flex-col cursor-pointer"
    >
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
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorito() }}
          title={favorito ? 'Quitar de favoritas' : 'Añadir a favoritas'}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <svg className={`w-4.5 h-4.5 transition-colors ${favorito ? 'text-tn-yellow' : 'text-white/70'}`}
            fill={favorito ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={favorito ? 0 : 2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        {item.mediaTipo && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm">
            {item.mediaTipo === 'audio' ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
            {item.mediaTipo === 'audio' ? 'Audio' : 'Vídeo'}
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="text-white font-bold group-hover:text-tn-yellow transition-colors truncate">{item.titulo}</h4>
        {item.descripcion && <p className="text-tn-muted text-sm mt-1 line-clamp-2">{item.descripcion}</p>}
        {item.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.etiquetas.map(tag => (
              <span key={tag} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-tn-yellow/10 text-tn-yellow">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
