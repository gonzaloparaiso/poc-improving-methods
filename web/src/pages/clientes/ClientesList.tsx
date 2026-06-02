import { useState } from 'react'
import { useClientes } from '../../context/ClientesContext'
import { type Cliente } from '../../types'
import ClienteModal from '../../components/clientes/ClienteModal'
import ConfirmDialog from '../../components/ConfirmDialog'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Avatar({ nombre, apellido }: { nombre: string; apellido: string }) {
  const initials = [nombre[0] ?? '', apellido[0] ?? ''].join('').toUpperCase() || '?'
  return (
    <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
      <span className="text-blue-400 text-xs font-black">{initials}</span>
    </div>
  )
}

export default function ClientesList() {
  const { clientes, borrarCliente, toggleActivoCliente, suscripciones, catalogo } = useClientes()

  const [modal, setModal]         = useState(false)
  const [editando, setEditando]   = useState<Cliente | null>(null)
  const [borrando, setBorrando]   = useState<Cliente | null>(null)
  const [toggle, setToggle]       = useState<Cliente | null>(null)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')

  const filtered = clientes.filter(c => {
    if (filtroEstado === 'activo' && !c.activo) return false
    if (filtroEstado === 'inactivo' && c.activo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!`${c.nombre} ${c.apellido} ${c.email}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = { total: clientes.length, activos: clientes.filter(c => c.activo).length }

  const getSuscripcionesActivas = (clienteId: string) =>
    suscripciones.filter(s => s.clienteId === clienteId && s.activa)

  const openCreate = () => { setEditando(null); setModal(true) }
  const openEdit   = (c: Cliente) => { setEditando(c); setModal(true) }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total clientes', value: stats.total, color: 'text-white' },
          { label: 'Activos', value: stats.activos, color: 'text-green-400' },
          { label: 'Inactivos', value: stats.total - stats.activos, color: 'text-tn-muted' },
        ].map(s => (
          <div key={s.label} className="card px-5 py-4">
            <p className="text-tn-muted text-xs font-medium mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" className="input-field pl-9" placeholder="Buscar por nombre o email..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input-field sm:w-40" value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}>
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <button className="btn-primary flex items-center gap-2 whitespace-nowrap" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-14 h-14 bg-tn-border rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-white font-semibold">
              {clientes.length === 0 ? 'Sin clientes' : 'Sin resultados'}
            </p>
            <p className="text-tn-muted text-sm mt-1">
              {clientes.length === 0
                ? 'Añade tu primer cliente para empezar'
                : 'Prueba a cambiar los filtros'}
            </p>
            {clientes.length === 0 && (
              <button className="btn-primary flex items-center gap-2 mt-4" onClick={openCreate}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Añadir primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tn-border">
                  {['Cliente', 'Email', 'Suscripciones', 'Estado', 'Alta', ''].map(h => (
                    <th key={h} className={`text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-4 ${
                      h === 'Email' ? 'hidden md:table-cell' :
                      h === 'Alta'  ? 'hidden lg:table-cell' : ''
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-tn-border">
                {filtered.map(c => {
                  const suscsActivas = getSuscripcionesActivas(c.id)
                  return (
                    <tr key={c.id} className={`hover:bg-tn-dark/40 transition-colors ${!c.activo ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar nombre={c.nombre} apellido={c.apellido} />
                          <div>
                            <p className="text-white font-semibold text-sm">{c.nombre} {c.apellido}</p>
                            <p className="text-tn-muted text-xs font-mono">@{c.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-tn-muted text-sm">{c.email}</span>
                      </td>
                      <td className="px-5 py-4">
                        {suscsActivas.length === 0
                          ? <span className="text-tn-muted/50 text-sm italic">Sin suscripción</span>
                          : (
                            <div className="flex flex-wrap gap-1">
                              {suscsActivas.slice(0, 2).map(s => {
                                const cat = catalogo.find(cat => cat.id === s.catalogoId)
                                return (
                                  <span key={s.id} className="text-xs bg-tn-yellow/10 text-tn-yellow px-2 py-0.5 rounded-full font-medium">
                                    {cat?.nombre ?? '—'}
                                  </span>
                                )
                              })}
                              {suscsActivas.length > 2 && (
                                <span className="text-xs text-tn-muted">+{suscsActivas.length - 2}</span>
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-5 py-4">
                        {c.activo
                          ? <span className="badge-active"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Activo</span>
                          : <span className="badge-inactive"><span className="w-1.5 h-1.5 rounded-full bg-tn-muted" />Inactivo</span>}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="text-tn-muted text-sm">{fmtDate(c.creadoEn)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(c)}
                            className="p-2 text-tn-muted hover:text-white hover:bg-tn-border rounded-lg transition-all" title="Editar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setToggle(c)}
                            className={`p-2 rounded-lg transition-all ${c.activo ? 'text-tn-muted hover:text-red-400 hover:bg-red-400/5' : 'text-tn-muted hover:text-green-400 hover:bg-green-400/5'}`}
                            title={c.activo ? 'Desactivar' : 'Activar'}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {c.activo
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                            </svg>
                          </button>
                          <button onClick={() => setBorrando(c)}
                            className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all" title="Eliminar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-tn-border">
            <p className="text-tn-muted text-xs">
              Mostrando <span className="text-white font-semibold">{filtered.length}</span> de{' '}
              <span className="text-white font-semibold">{clientes.length}</span> clientes
            </p>
          </div>
        )}
      </div>

      {modal && <ClienteModal cliente={editando} onClose={() => { setModal(false); setEditando(null) }} />}

      {borrando && (
        <ConfirmDialog
          title="Eliminar cliente"
          description={`¿Eliminar a ${borrando.nombre} ${borrando.apellido}? Se perderán sus datos y suscripciones.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrarCliente(borrando.id); setBorrando(null) }}
          onCancel={() => setBorrando(null)}
        />
      )}
      {toggle && (
        <ConfirmDialog
          title={toggle.activo ? 'Desactivar cliente' : 'Activar cliente'}
          description={toggle.activo
            ? `${toggle.nombre} perderá acceso al portal cliente.`
            : `${toggle.nombre} recuperará acceso al portal cliente.`}
          confirmLabel={toggle.activo ? 'Desactivar' : 'Activar'}
          danger={toggle.activo}
          onConfirm={() => { toggleActivoCliente(toggle.id); setToggle(null) }}
          onCancel={() => setToggle(null)}
        />
      )}
    </div>
  )
}
