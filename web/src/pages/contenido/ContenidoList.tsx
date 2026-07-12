import { useState, type ReactNode } from 'react'
import { type ContenidoItem } from '../../types'
import ContenidoCard from '../../components/contenido/ContenidoCard'
import ContenidoModal from '../../components/contenido/ContenidoModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { usePermisos } from '../../hooks/usePermisos'

type Datos = Omit<ContenidoItem, 'id' | 'creadoEn'>

interface Props {
  items: ContenidoItem[]
  onCrear: (data: Datos) => ContenidoItem
  onEditar: (id: string, data: Partial<Datos>) => void
  onBorrar: (id: string) => void
  titulo: string             // "Respiración" / "Movilidad"
  nuevoLabel: string         // "Nueva respiración" / "Nueva movilidad"
  emptyTitulo: string
  emptyDescripcion: string
  icon: ReactNode
}

export default function ContenidoList({
  items, onCrear, onEditar, onBorrar, titulo, nuevoLabel, emptyTitulo, emptyDescripcion, icon,
}: Props) {
  const { puede } = usePermisos()
  const puedeCrear = puede('contenido', 'crear')
  const puedeEditar = puede('contenido', 'editar')
  const puedeBorrar = puede('contenido', 'borrar')

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ContenidoItem | null>(null)
  const [borrando, setBorrando] = useState<ContenidoItem | null>(null)

  const abrirNuevo = () => { setEditando(null); setModalOpen(true) }
  const abrirEditar = (item: ContenidoItem) => { setEditando(item); setModalOpen(true) }

  const guardar = (data: Datos) => {
    if (editando) onEditar(editando.id, data)
    else onCrear(data)
    setModalOpen(false); setEditando(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">{titulo}</h2>
          <p className="text-tn-muted text-sm mt-1">
            {items.length === 0 ? `Sin ${titulo.toLowerCase()} todavía` : `${items.length} elemento${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {puedeCrear && (
          <button className="btn-primary flex items-center gap-2 self-start sm:self-auto" onClick={abrirNuevo}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {nuevoLabel}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-tn-border rounded-2xl flex items-center justify-center mb-4 text-tn-muted">
            {icon}
          </div>
          <h3 className="text-white font-bold text-lg mb-2">{emptyTitulo}</h3>
          <p className="text-tn-muted text-sm mb-6 max-w-sm">{emptyDescripcion}</p>
          {puedeCrear && (
            <button className="btn-primary flex items-center gap-2" onClick={abrirNuevo}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {nuevoLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <ContenidoCard
              key={item.id}
              item={item}
              onEditar={() => abrirEditar(item)}
              onBorrar={() => setBorrando(item)}
              puedeEditar={puedeEditar}
              puedeBorrar={puedeBorrar}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <ContenidoModal
          item={editando}
          tituloModal={editando ? `Editar ${titulo.toLowerCase()}` : nuevoLabel}
          etiquetaCampo={titulo}
          onGuardar={guardar}
          onCancelar={() => { setModalOpen(false); setEditando(null) }}
        />
      )}

      {borrando && (
        <ConfirmDialog
          title={`Eliminar ${titulo.toLowerCase()}`}
          description={`¿Eliminar "${borrando.titulo}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => { onBorrar(borrando.id); setBorrando(null) }}
          onCancel={() => setBorrando(null)}
        />
      )}
    </div>
  )
}
