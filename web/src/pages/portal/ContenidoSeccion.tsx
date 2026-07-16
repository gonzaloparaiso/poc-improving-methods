import { useMemo, useState } from 'react'
import { type ContenidoItem } from '../../types'
import { obtenerFavoritos, esFavorito, toggleFavorito } from '../../lib/contenidoFavoritos'
import { type ContenidoPeriodico, resumenDias } from '../../lib/contenidoPeriodico'
import { recomendar } from '../../lib/contenidoRecomendacion'
import ContenidoCard from './ContenidoCard'
import ContenidoListItem from './ContenidoListItem'

interface Props {
  clienteId: string
  respiraciones: ContenidoItem[]
  movilidad: ContenidoItem[]
  onAbrir: (item: ContenidoItem) => void
  periodicas: ContenidoPeriodico[]
  onEliminarPeriodica: (id: string) => void
}

function coincide(item: ContenidoItem, q: string): boolean {
  if (!q) return true
  return item.titulo.toLowerCase().includes(q)
    || item.descripcion.toLowerCase().includes(q)
    || item.etiquetas.some(t => t.toLowerCase().includes(q))
}

export default function ContenidoSeccion({ clienteId, respiraciones, movilidad, onAbrir, periodicas, onEliminarPeriodica }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [favoritos, setFavoritos] = useState(() => obtenerFavoritos(clienteId))

  const toggleFav = (itemId: string) => setFavoritos(toggleFavorito(clienteId, itemId))

  // Programaciones resueltas con su contenido (por si el admin borró el elemento)
  const todosItems = useMemo(() => [...respiraciones, ...movilidad], [respiraciones, movilidad])
  const periodicasConItem = useMemo(() => (
    periodicas
      .map(p => ({ p, item: todosItems.find(i => i.id === p.contenidoId) }))
      .filter((x): x is { p: ContenidoPeriodico; item: ContenidoItem } => !!x.item)
      .sort((a, b) => a.p.hora.localeCompare(b.p.hora))
  ), [periodicas, todosItems])

  const renderPeriodicas = () => periodicasConItem.length === 0 ? null : (
    <div className="space-y-2">
      {periodicasConItem.map(({ p, item }) => (
        <div key={p.id} className="flex items-center gap-3 card p-2.5 border-sky-400/20">
          <div className="w-10 h-10 rounded-lg bg-sky-400/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
            </svg>
          </div>
          <button onClick={() => onAbrir(item)} className="flex-1 min-w-0 text-left group">
            <p className="text-white text-sm font-semibold truncate group-hover:text-sky-300 transition-colors">{item.titulo}</p>
            <p className="text-sky-300/80 text-xs font-mono">{resumenDias(p.dias)} · {p.hora}</p>
          </button>
          <button
            onClick={() => onEliminarPeriodica(p.id)}
            className="p-1.5 text-tn-muted hover:text-red-400 transition-colors flex-shrink-0"
            title="Quitar de mi calendario"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )

  const q = busqueda.trim().toLowerCase()
  const respiracionesFiltradas = useMemo(() => respiraciones.filter(i => coincide(i, q)), [respiraciones, q])
  const movilidadFiltrada = useMemo(() => movilidad.filter(i => coincide(i, q)), [movilidad, q])

  // Favoritas: las que el cliente ha marcado a mano con el corazón (más recientes primero)
  const favoritas = useMemo(() => (
    favoritos.map(id => todosItems.find(i => i.id === id)).filter((x): x is ContenidoItem => !!x)
  ), [favoritos, todosItems])

  // "Es probable que te guste": una sugerencia nueva a partir de favoritas + calendario
  const recomendacion = useMemo(
    () => recomendar(todosItems, favoritos, periodicas),
    [todosItems, favoritos, periodicas],
  )

  const renderRecomendacion = () => !recomendacion ? null : (
    <div className="card p-3 border-fuchsia-400/25 bg-fuchsia-400/5 space-y-2.5">
      <p className="text-fuchsia-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        Es probable que te guste
      </p>
      <button onClick={() => onAbrir(recomendacion.item)} className="w-full flex items-center gap-3 text-left group">
        <div className="w-11 h-11 rounded-lg bg-tn-dark flex-shrink-0 overflow-hidden">
          {recomendacion.item.thumbnail && <img src={recomendacion.item.thumbnail} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate group-hover:text-fuchsia-300 transition-colors">{recomendacion.item.titulo}</p>
          <p className="text-fuchsia-300/70 text-xs truncate">
            {recomendacion.etiquetasComunes.length > 0
              ? `Porque te gusta: ${recomendacion.etiquetasComunes.join(', ')}`
              : 'Para empezar a explorar'}
          </p>
        </div>
      </button>
      {/* En columna: con dos botones lado a lado el texto se partía en dos líneas en pantallas estrechas */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => toggleFav(recomendacion.item.id)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border border-tn-yellow/40 text-tn-yellow hover:bg-tn-yellow/10 transition-colors whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Añadir a favoritas
        </button>
        <button
          onClick={() => onAbrir(recomendacion.item)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border border-sky-400/40 text-sky-300 hover:bg-sky-400/10 transition-colors whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Programar
        </button>
      </div>
    </div>
  )

  const hayContenido = respiraciones.length > 0 || movilidad.length > 0
  const hayResultados = respiracionesFiltradas.length > 0 || movilidadFiltrada.length > 0

  if (!hayContenido) {
    return (
      <div className="card py-12 text-center">
        <p className="text-tn-muted text-sm">Todavía no hay contenido disponible.</p>
      </div>
    )
  }

  const renderGrupo = (titulo: string, items: ContenidoItem[]) => items.length === 0 ? null : (
    <div className="space-y-3">
      <h3 className="text-white font-bold text-lg">{titulo}</h3>
      {/* Escritorio: cuadrícula con miniaturas */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <ContenidoCard key={item.id} item={item} onAbrir={() => onAbrir(item)}
            favorito={esFavorito(favoritos, item.id)} onToggleFavorito={() => toggleFav(item.id)} />
        ))}
      </div>
      {/* Móvil: lista compacta */}
      <div className="sm:hidden space-y-2">
        {items.map(item => (
          <ContenidoListItem key={item.id} item={item} onAbrir={() => onAbrir(item)}
            favorito={esFavorito(favoritos, item.id)} onToggleFavorito={() => toggleFav(item.id)} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Buscador: ancho completo */}
      <div className="relative">
        <svg className="w-4 h-4 text-tn-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, descripción o etiqueta…"
          className="input-field pl-10 w-full"
        />
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-6 lg:items-start">
        <div className="space-y-8 lg:order-1 min-w-0">
          {/* Favoritas en móvil: lista a ancho completo (en escritorio va en la barra lateral) */}
          {favoritas.length > 0 && (
            <div className="lg:hidden space-y-2">
              <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">Tus favoritas</p>
              <div className="space-y-2">
                {favoritas.map(item => (
                  <div key={item.id} className="w-full flex items-center gap-3 card p-2.5 hover:border-tn-yellow/50 transition-all">
                    <button onClick={() => onAbrir(item)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                      <div className="w-11 h-11 rounded-lg bg-tn-dark flex-shrink-0 overflow-hidden">
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <span className="text-white text-sm font-semibold truncate">{item.titulo}</span>
                    </button>
                    <button onClick={() => toggleFav(item.id)} title="Quitar de favoritas" className="p-1.5 flex-shrink-0">
                      <svg className="w-5 h-5 text-tn-yellow" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Periódicas en móvil: bajo las favoritas (en escritorio van en la barra lateral) */}
          {periodicasConItem.length > 0 && (
            <div className="lg:hidden space-y-2">
              <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">En tu calendario</p>
              {renderPeriodicas()}
            </div>
          )}

          {/* Recomendación en móvil (en escritorio va en la barra lateral) */}
          {recomendacion && <div className="lg:hidden">{renderRecomendacion()}</div>}

          {!hayResultados ? (
            <div className="card py-10 text-center">
              <p className="text-tn-muted text-sm">Sin resultados para "{busqueda}"</p>
            </div>
          ) : (
            <>
              {renderGrupo('Respiración', respiracionesFiltradas)}
              {renderGrupo('Movilidad', movilidadFiltrada)}
            </>
          )}
        </div>

        {/* Favoritas en escritorio: barra lateral derecha, alineada con las miniaturas (debajo del título "Respiración") */}
        <aside className="hidden lg:block lg:order-2 space-y-3">
          <h3 className="invisible text-lg" aria-hidden>&nbsp;</h3>
          <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">Tus favoritas</p>
          {favoritas.length === 0 ? (
            <div className="card p-4">
              <p className="text-tn-muted text-xs">Marca el corazón de una respiración para tenerla aquí a mano.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {favoritas.map(item => (
                <div key={item.id} className="w-full flex items-center gap-3 card p-2.5 group hover:border-tn-yellow/50 transition-all">
                  <button onClick={() => onAbrir(item)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-lg bg-tn-dark flex-shrink-0 overflow-hidden">
                      {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-white text-sm font-semibold truncate group-hover:text-tn-yellow transition-colors">{item.titulo}</span>
                  </button>
                  <button onClick={() => toggleFav(item.id)} title="Quitar de favoritas" className="p-1 flex-shrink-0">
                    <svg className="w-4.5 h-4.5 text-tn-yellow" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Programaciones periódicas del cliente */}
          <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider pt-2">En tu calendario</p>
          {periodicasConItem.length === 0 ? (
            <div className="card p-4">
              <p className="text-tn-muted text-xs">
                Abre una respiración y prográmala para que aparezca cada semana en tu calendario.
              </p>
            </div>
          ) : renderPeriodicas()}

          {/* Recomendación */}
          {recomendacion && (
            <>
              <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider pt-2">Para ti</p>
              {renderRecomendacion()}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
