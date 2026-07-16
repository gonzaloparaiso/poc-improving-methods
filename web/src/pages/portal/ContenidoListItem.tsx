import { type ContenidoItem } from '../../types'

interface Props {
  item: ContenidoItem
  onAbrir: () => void
  favorito: boolean
  onToggleFavorito: () => void
}

export default function ContenidoListItem({ item, onAbrir, favorito, onToggleFavorito }: Props) {
  return (
    // No es <button> a propósito: contiene el botón de favorito, y HTML no permite <button> anidados.
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir() } }}
      className="w-full flex items-center gap-3 card p-3 text-left group hover:border-tn-yellow/50 transition-all cursor-pointer"
    >
      <div className="w-14 h-14 rounded-lg bg-tn-dark flex-shrink-0 overflow-hidden">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-tn-yellow/10 to-tn-dark">
            <svg className="w-6 h-6 text-tn-yellow/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-white font-bold text-sm truncate group-hover:text-tn-yellow transition-colors">{item.titulo}</h4>
          {item.mediaTipo && (
            <span className="text-tn-muted flex-shrink-0">
              {item.mediaTipo === 'audio' ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </span>
          )}
        </div>
        {item.descripcion && <p className="text-tn-muted text-xs mt-0.5 line-clamp-1">{item.descripcion}</p>}
        {item.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.etiquetas.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-tn-yellow/10 text-tn-yellow">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorito() }}
        title={favorito ? 'Quitar de favoritas' : 'Añadir a favoritas'}
        className="p-1.5 flex-shrink-0"
      >
        <svg className={`w-5 h-5 transition-colors ${favorito ? 'text-tn-yellow' : 'text-tn-muted'}`}
          fill={favorito ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={favorito ? 0 : 2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
      <svg className="w-4 h-4 text-tn-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}
