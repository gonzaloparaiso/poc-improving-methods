import { useMemo, useState } from 'react'
import { type ContenidoItem } from '../../types'
import { registrarUso, obtenerUsos } from '../../lib/contenidoUsos'
import ContenidoCard from './ContenidoCard'
import ContenidoListItem from './ContenidoListItem'

interface Props {
  clienteId: string
  respiraciones: ContenidoItem[]
  movilidad: ContenidoItem[]
  onAbrir: (item: ContenidoItem) => void
}

function coincide(item: ContenidoItem, q: string): boolean {
  if (!q) return true
  return item.titulo.toLowerCase().includes(q)
    || item.descripcion.toLowerCase().includes(q)
    || item.etiquetas.some(t => t.toLowerCase().includes(q))
}

export default function ContenidoSeccion({ clienteId, respiraciones, movilidad, onAbrir }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [usos, setUsos] = useState(() => obtenerUsos(clienteId))

  const abrir = (item: ContenidoItem) => {
    registrarUso(clienteId, item.id)
    setUsos(obtenerUsos(clienteId))
    onAbrir(item)
  }

  const q = busqueda.trim().toLowerCase()
  const respiracionesFiltradas = useMemo(() => respiraciones.filter(i => coincide(i, q)), [respiraciones, q])
  const movilidadFiltrada = useMemo(() => movilidad.filter(i => coincide(i, q)), [movilidad, q])

  // Accesos rápidos: las respiraciones más abiertas por este cliente
  const favoritas = useMemo(() => (
    respiraciones
      .map(item => ({ item, n: usos[item.id] ?? 0 }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .map(x => x.item)
  ), [respiraciones, usos])

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
        {items.map(item => <ContenidoCard key={item.id} item={item} onAbrir={() => abrir(item)} />)}
      </div>
      {/* Móvil: lista compacta */}
      <div className="sm:hidden space-y-2">
        {items.map(item => <ContenidoListItem key={item.id} item={item} onAbrir={() => abrir(item)} />)}
      </div>
    </div>
  )

  return (
    <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-6 lg:items-start">
      <div className="space-y-6 lg:order-1 min-w-0">
        {/* Buscador */}
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

        {/* Favoritas en móvil: tira horizontal (en escritorio va en la barra lateral) */}
        {favoritas.length > 0 && (
          <div className="lg:hidden space-y-2">
            <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">Tus favoritas</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {favoritas.map(item => (
                <button key={item.id} onClick={() => abrir(item)}
                  className="flex-shrink-0 flex items-center gap-2 bg-tn-card border border-tn-border rounded-xl px-3 py-2 hover:border-tn-yellow transition-all max-w-[220px]">
                  <div className="w-8 h-8 rounded-lg bg-tn-dark flex-shrink-0 overflow-hidden">
                    {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="text-white text-xs font-semibold truncate">{item.titulo}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!hayResultados ? (
          <div className="card py-10 text-center">
            <p className="text-tn-muted text-sm">Sin resultados para "{busqueda}"</p>
          </div>
        ) : (
          <div className="space-y-8">
            {renderGrupo('Respiración', respiracionesFiltradas)}
            {renderGrupo('Movilidad', movilidadFiltrada)}
          </div>
        )}
      </div>

      {/* Favoritas en escritorio: barra lateral derecha */}
      <aside className="hidden lg:block lg:order-2 lg:sticky lg:top-4 space-y-3">
        <p className="text-tn-muted text-xs font-semibold uppercase tracking-wider">Tus favoritas</p>
        {favoritas.length === 0 ? (
          <div className="card p-4">
            <p className="text-tn-muted text-xs">Aún no tienes respiraciones favoritas. Abre alguna y aparecerá aquí.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {favoritas.map((item, i) => (
              <button key={item.id} onClick={() => abrir(item)}
                className="w-full flex items-center gap-3 card p-2.5 text-left group hover:border-tn-yellow/50 transition-all">
                <span className="text-tn-yellow font-black text-sm w-4 flex-shrink-0 text-center">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg bg-tn-dark flex-shrink-0 overflow-hidden">
                  {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
                </div>
                <span className="text-white text-sm font-semibold truncate group-hover:text-tn-yellow transition-colors">{item.titulo}</span>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
