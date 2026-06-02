import { useState } from 'react'
import { useUsers } from '../context/UsersContext'
import { ROLES, type Usuario } from '../types'
import RolBadge from '../components/RolBadge'
import UserModal from '../components/UserModal'
import ConfirmDialog from '../components/ConfirmDialog'

type FiltroRol = 'todos' | string
type FiltroEstado = 'todos' | 'activo' | 'inactivo'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Avatar({ nombre, apellido }: { nombre: string; apellido: string }) {
  const initials = [(nombre[0] ?? ''), (apellido[0] ?? '')].join('').toUpperCase() || '?'
  return (
    <div className="w-9 h-9 rounded-full bg-tn-yellow flex items-center justify-center flex-shrink-0">
      <span className="text-tn-black text-xs font-black">{initials}</span>
    </div>
  )
}

export default function Administracion() {
  const { users, borrar, toggleActivo } = useUsers()

  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [deleteUser, setDeleteUser] = useState<Usuario | null>(null)
  const [toggleUser, setToggleUser] = useState<Usuario | null>(null)

  const [filtroRol, setFiltroRol] = useState<FiltroRol>('todos')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [busqueda, setBusqueda] = useState('')

  const filtered = users.filter(u => {
    if (filtroRol !== 'todos' && u.rol !== filtroRol) return false
    if (filtroEstado === 'activo' && !u.activo) return false
    if (filtroEstado === 'inactivo' && u.activo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const full = `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase()
      if (!full.includes(q)) return false
    }
    return true
  })

  const stats = {
    total: users.length,
    activos: users.filter(u => u.activo).length,
    inactivos: users.filter(u => !u.activo).length,
  }

  const openCreate = () => { setEditUser(null); setModalOpen(true) }
  const openEdit = (u: Usuario) => { setEditUser(u); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditUser(null) }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total usuarios', value: stats.total, color: 'text-white' },
          { label: 'Activos',        value: stats.activos,   color: 'text-green-400' },
          { label: 'Inactivos',      value: stats.inactivos, color: 'text-tn-muted' },
        ].map(s => (
          <div key={s.label} className="card px-5 py-4">
            <p className="text-tn-muted text-xs font-medium mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="input-field pl-9"
            placeholder="Buscar por nombre o email..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        {/* Filtro rol */}
        <select
          className="input-field sm:w-44"
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value)}
        >
          <option value="todos">Todos los roles</option>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Filtro estado */}
        <select
          className="input-field sm:w-40"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}
        >
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>

        <button className="btn-primary flex items-center gap-2 whitespace-nowrap" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-14 h-14 bg-tn-border rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-tn-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-white font-semibold">Sin resultados</p>
            <p className="text-tn-muted text-sm mt-1">Prueba a cambiar los filtros o crea un nuevo usuario</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tn-border">
                  {['Usuario', 'Login', 'Email', 'Rol', 'Estado', 'Alta', 'Baja', ''].map(h => (
                    <th key={h} className={`text-left text-tn-muted text-xs font-semibold uppercase tracking-wider px-5 py-4 ${
                      h === 'Login' ? 'hidden md:table-cell' :
                      h === 'Email' ? 'hidden lg:table-cell' :
                      h === 'Baja'  ? 'hidden xl:table-cell' :
                      h === 'Alta'  ? 'hidden xl:table-cell' :
                      ''
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-tn-border">
                {filtered.map(u => (
                  <tr key={u.id} className={`transition-colors hover:bg-tn-dark/40 ${!u.activo ? 'opacity-60' : ''}`}>
                    {/* Usuario */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={u.nombre} apellido={u.apellido} />
                        <div>
                          <p className="text-white font-semibold text-sm leading-tight">
                            {u.nombre} {u.apellido}
                          </p>
                          <p className="text-tn-muted text-xs sm:hidden">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Login */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="font-mono text-sm text-tn-yellow/80 bg-tn-yellow/5 px-2 py-0.5 rounded">
                        @{u.username}
                      </span>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="text-tn-muted text-sm">{u.email}</span>
                    </td>

                    {/* Rol */}
                    <td className="px-5 py-4">
                      <RolBadge rol={u.rol} />
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-4">
                      {u.activo ? (
                        <span className="badge-active">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                          Activo
                        </span>
                      ) : (
                        <span className="badge-inactive">
                          <span className="w-1.5 h-1.5 rounded-full bg-tn-muted"></span>
                          Inactivo
                        </span>
                      )}
                    </td>

                    {/* Alta */}
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <span className="text-tn-muted text-sm">{fmtDate(u.creadoEn)}</span>
                    </td>

                    {/* Baja */}
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <span className="text-tn-muted text-sm">{fmtDate(u.bajaEn)}</span>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Editar */}
                        <button
                          onClick={() => openEdit(u)}
                          title="Editar"
                          className="p-2 text-tn-muted hover:text-white hover:bg-tn-border rounded-lg transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Toggle activo */}
                        <button
                          onClick={() => setToggleUser(u)}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          className={`p-2 rounded-lg transition-all ${
                            u.activo
                              ? 'text-tn-muted hover:text-red-400 hover:bg-red-400/5'
                              : 'text-tn-muted hover:text-green-400 hover:bg-green-400/5'
                          }`}
                        >
                          {u.activo ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>

                        {/* Borrar */}
                        <button
                          onClick={() => setDeleteUser(u)}
                          title="Eliminar"
                          className="p-2 text-tn-muted hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer tabla */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-tn-border">
            <p className="text-tn-muted text-xs">
              Mostrando <span className="text-white font-semibold">{filtered.length}</span> de{' '}
              <span className="text-white font-semibold">{users.length}</span> usuarios
            </p>
          </div>
        )}
      </div>

      {/* ── Modales ──────────────────────────────────────────────────────── */}
      {modalOpen && (
        <UserModal user={editUser} onClose={closeModal} />
      )}

      {deleteUser && (
        <ConfirmDialog
          title="Eliminar usuario"
          description={`¿Seguro que quieres eliminar a ${deleteUser.nombre} ${deleteUser.apellido}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => { borrar(deleteUser.id); setDeleteUser(null) }}
          onCancel={() => setDeleteUser(null)}
        />
      )}

      {toggleUser && (
        <ConfirmDialog
          title={toggleUser.activo ? 'Desactivar usuario' : 'Activar usuario'}
          description={
            toggleUser.activo
              ? `${toggleUser.nombre} ${toggleUser.apellido} perderá acceso al sistema y se registrará la fecha de baja.`
              : `${toggleUser.nombre} ${toggleUser.apellido} recuperará el acceso al sistema.`
          }
          confirmLabel={toggleUser.activo ? 'Desactivar' : 'Activar'}
          danger={toggleUser.activo}
          onConfirm={() => { toggleActivo(toggleUser.id); setToggleUser(null) }}
          onCancel={() => setToggleUser(null)}
        />
      )}
    </div>
  )
}
